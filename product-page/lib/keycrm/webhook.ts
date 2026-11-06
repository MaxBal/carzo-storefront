/**
 * Inbound keyCRM webhook core ("order.change_order_status").
 *
 * Flow: secret → event/status filter → re-fetch the order via API → verify the
 * live status → normalize phone → upsert into public.customers.
 * Idempotent: customers.phone is UNIQUE and the upsert ignores duplicates.
 *
 * No customer data or secrets in logs.
 */

import { normalizeCustomerPhone } from '@/lib/cart/customer-phone';

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

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

export async function handleKeyCrmOrderStatusWebhook(
  body: unknown,
  secret: string | null,
  deps: KeyCrmWebhookDeps,
): Promise<KeyCrmWebhookResult> {
  const env = deps.env ?? process.env;
  const logError = deps.logError ?? (() => {});
  const expectedSecret = env.KEYCRM_WEBHOOK_SECRET?.trim() || null;
  const completedStatusId = Number(env.KEYCRM_COMPLETED_STATUS_ID);

  // Without owner-provided settings the endpoint must never touch customers.
  if (!expectedSecret || !Number.isInteger(completedStatusId) || completedStatusId <= 0) {
    return { status: 503, body: { error: 'not_configured' } };
  }
  if (!secret || !timingSafeEqual(secret, expectedSecret)) {
    return { status: 401, body: { error: 'unauthorized' } };
  }

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
  if (contextStatus !== completedStatusId) {
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
  if (Number(order.status_id) !== completedStatusId) {
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
