/**
 * Inbound keyCRM webhook core ("order.change_order_status").
 *
 * Flow: secret → event/status filter → re-fetch the order via API → verify the
 * live status → normalize phone → upsert into public.customers.
 * Idempotent: customers.phone is UNIQUE and the upsert ignores duplicates.
 *
 * No customer data or secrets in logs.
 */

import { createHash, timingSafeEqual as cryptoTimingSafeEqual } from 'node:crypto';
import { normalizeCustomerPhone } from '@/lib/cart/customer-phone';
import { parseStatusIdList } from './config';

export interface KeyCrmWebhookOrder {
  id: number;
  status_id?: number;
  buyer?: { phone?: string | null; full_name?: string | null } | null;
}

export interface KeyCrmWebhookDeps {
  getOrder: (orderId: number) => Promise<KeyCrmWebhookOrder>;
  upsertCustomer: (input: { phone: string; fullName: string; source: string; imported: boolean }) => Promise<unknown>;
  env?: NodeJS.ProcessEnv;
  logError?: (message: string, detail: string) => void;
}

export interface KeyCrmWebhookResult {
  status: number;
  body: { ok?: boolean; skipped?: string; error?: string };
}

const WINDOW_MS = 60_000;
const MAX_AUTHENTICATED_HITS = 120;
const MAX_UNAUTHORIZED_HITS_PER_IP = 30;
const MAX_TRACKED_IPS = 500;

let authenticatedBucket: { count: number; resetAt: number } | null = null;
const unauthorizedHits = new Map<string, { count: number; resetAt: number }>();

export function isKeyCrmUnauthorizedFlood(ip: string, now: number = Date.now()): boolean {
  const key = ip.trim() || 'unknown';
  const bucket = unauthorizedHits.get(key);
  if (bucket && bucket.resetAt > now) {
    bucket.count += 1;
    return bucket.count > MAX_UNAUTHORIZED_HITS_PER_IP;
  }

  if (unauthorizedHits.size >= MAX_TRACKED_IPS) {
    unauthorizedHits.forEach((v, k) => {
      if (v.resetAt <= now) unauthorizedHits.delete(k);
    });
    if (unauthorizedHits.size >= MAX_TRACKED_IPS) {
      const oldestKey = unauthorizedHits.keys().next().value;
      if (oldestKey !== undefined) unauthorizedHits.delete(oldestKey);
    }
  }

  unauthorizedHits.set(key, { count: 1, resetAt: now + WINDOW_MS });
  return false;
}

export function isKeyCrmAuthenticatedRateLimited(now: number = Date.now()): boolean {
  if (!authenticatedBucket || authenticatedBucket.resetAt <= now) {
    authenticatedBucket = { count: 1, resetAt: now + WINDOW_MS };
    return false;
  }
  authenticatedBucket.count += 1;
  return authenticatedBucket.count > MAX_AUTHENTICATED_HITS;
}

/** Test helper to reset webhook rate-limit buckets. */
export function resetKeyCrmWebhookRateLimitForTests(): void {
  authenticatedBucket = null;
  unauthorizedHits.clear();
}

/**
 * Constant-time secret comparison using SHA-256 digests so secrets of
 * different lengths never leak the configured secret length via timing (C-08).
 */
export function constantTimeSecretEquals(a: string, b: string): boolean {
  const left = createHash('sha256').update(a, 'utf8').digest();
  const right = createHash('sha256').update(b, 'utf8').digest();
  return cryptoTimingSafeEqual(left, right);
}

/**
 * Extracts the webhook secret from optional headers first, falling back to
 * the existing `?secret=...` query parameter for 100% backward compatibility
 * with the live keyCRM webhook URL.
 */
export function extractKeyCrmWebhookSecret(request: Request): string | null {
  const headerSecret =
    request.headers.get('x-keycrm-secret')?.trim() ||
    request.headers.get('x-webhook-secret')?.trim() ||
    null;
  if (headerSecret) return headerSecret;
  try {
    return new URL(request.url).searchParams.get('secret');
  } catch {
    return null;
  }
}

export type KeyCrmWebhookAuthCheck =
  | { ok: true; loyaltyStatusIds: number[] }
  | { ok: false; status: 401 | 503; body: { error: 'unauthorized' | 'not_configured' } };

/**
 * Verifies webhook configuration and secret BEFORE consuming authenticated
 * rate-limit quota or parsing request JSON (C-08).
 */
export function verifyKeyCrmWebhookAuth(
  secret: string | null,
  env: Partial<NodeJS.ProcessEnv> = process.env,
): KeyCrmWebhookAuthCheck {
  const expectedSecret = env.KEYCRM_WEBHOOK_SECRET?.trim() || null;
  const loyaltyStatusIds = parseStatusIdList(env.KEYCRM_LOYALTY_STATUS_IDS);

  if (!expectedSecret || loyaltyStatusIds.length === 0) {
    return { ok: false, status: 503, body: { error: 'not_configured' } };
  }
  if (!secret || !constantTimeSecretEquals(secret, expectedSecret)) {
    return { ok: false, status: 401, body: { error: 'unauthorized' } };
  }
  return { ok: true, loyaltyStatusIds };
}

export async function handleKeyCrmOrderStatusWebhook(
  body: unknown,
  secret: string | null,
  deps: KeyCrmWebhookDeps,
): Promise<KeyCrmWebhookResult> {
  const env = deps.env ?? process.env;
  const logError = deps.logError ?? (() => {});
  const auth = verifyKeyCrmWebhookAuth(secret, env);
  if (!auth.ok) {
    return { status: auth.status, body: auth.body };
  }
  const { loyaltyStatusIds } = auth;

  const payload = body as {
    event?: unknown;
    context?: { id?: unknown; status_id?: unknown };
  } | null;
  if (!payload || typeof payload !== 'object') {
    return { status: 400, body: { error: 'invalid_body' } };
  }
  if (payload.event !== 'order.change_order_status') {
    return { status: 200, body: { skipped: 'event' } };
  }

  const orderId = Number(payload.context?.id);
  const contextStatus = Number(payload.context?.status_id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return { status: 400, body: { error: 'invalid_order_id' } };
  }
  // Any loyalty-granting status qualifies ("Получено" 21 / "Выполнен" 12).
  if (!loyaltyStatusIds.includes(contextStatus)) {
    return { status: 200, body: { skipped: 'status' } };
  }

  let order: KeyCrmWebhookOrder;
  try {
    order = await deps.getOrder(orderId);
  } catch (error) {
    logError('keyCRM webhook order fetch failed', error instanceof Error ? error.message : 'unknown');
    return { status: 500, body: { error: 'order_fetch_failed' } };
  }

  // Never trust webhook payload alone — re-check the live order status.
  // The live status may already have moved on (21 → 12); both grant loyalty.
  if (!loyaltyStatusIds.includes(Number(order.status_id))) {
    return { status: 200, body: { skipped: 'status_mismatch' } };
  }

  const phone = normalizeCustomerPhone(order.buyer?.phone ?? null);
  if (!phone) {
    logError('keyCRM webhook skipped: phone missing or invalid', `order:${orderId}`);
    return { status: 200, body: { skipped: 'phone' } };
  }

  try {
    await deps.upsertCustomer({
      phone,
      fullName: (order.buyer?.full_name ?? '').trim(),
      source: 'keycrm',
      imported: false,
    });
  } catch (error) {
    logError('keyCRM webhook customer upsert failed', error instanceof Error ? error.message : 'unknown');
    return { status: 500, body: { error: 'upsert_failed' } };
  }

  return { status: 200, body: { ok: true } };
}
