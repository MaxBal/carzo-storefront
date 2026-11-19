import { createHash, randomUUID } from 'node:crypto';
import { fingerprintItemLine, type IdentityItem } from './item-identity';

export {
  CHECKOUT_ATTEMPT_STORAGE_KEY,
  CHECKOUT_ATTEMPT_TTL_MS,
  clearPersistedCheckoutAttempt,
  computeCartItemsSignature,
  createCheckoutAttemptTracker,
  isValidAttemptUuid,
  readPersistedCheckoutAttempt,
  writePersistedCheckoutAttempt,
  type CheckoutAttemptOutcomeInput,
  type CheckoutAttemptRecord,
  type CheckoutAttemptStatus,
  type StorageLike,
} from './checkout-attempt-client';

/**
 * Checkout attempt identity + request fingerprint.
 *
 * The fingerprint binds a checkout attempt to its material intent (who buys
 * what, with which loyalty phone, payment option, and exact delivery destination)
 * without binding to transient catalog prices, so a successful prior order
 * stays retrievable after later price changes.
 */

export function newCheckoutAttemptId(): string {
  return randomUUID();
}

export function isCheckoutAttemptId(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export interface FingerprintDeliveryInput {
  method: string;
  cityRef?: string | null;
  pointRef?: string | null;
  warehouseRef?: string | null;
  streetRef?: string | null;
  house?: string | null;
  apartment?: string | null;
}

export interface FingerprintInput {
  customerPhone: string;
  /** Canonical or raw loyalty phone if a loyalty discount was requested. */
  loyaltyPhone?: string | null;
  contactMethod: string;
  /** Delivery method ('BRANCH' | 'POSTOMAT' | 'COURIER'). Optional when `delivery` object is passed. */
  deliveryMethod?: string;
  /** Full delivery destination object (preferred). */
  delivery?: FingerprintDeliveryInput | null;
  cityRef?: string | null;
  pointRef?: string | null;
  warehouseRef?: string | null;
  streetRef?: string | null;
  house?: string | null;
  apartment?: string | null;
  /** Payment terms are part of buyer intent — same attempt with a different option must not match. */
  paymentOption?: string | null;
  items: IdentityItem[];
}

function buildDeliveryTargetLine(input: FingerprintInput): string {
  const method = (input.delivery?.method ?? input.deliveryMethod ?? '').trim().toUpperCase();
  const cityRef = (input.delivery?.cityRef ?? input.cityRef ?? '').trim().toLowerCase();
  const pointRef = (
    input.delivery?.pointRef ??
    input.delivery?.warehouseRef ??
    input.pointRef ??
    input.warehouseRef ??
    ''
  ).trim().toLowerCase();
  const streetRef = (input.delivery?.streetRef ?? input.streetRef ?? '').trim().toLowerCase();
  const house = (input.delivery?.house ?? input.house ?? '').trim().toLowerCase();
  const apartment = (input.delivery?.apartment ?? input.apartment ?? '').trim().toLowerCase();

  if (method === 'COURIER') {
    return JSON.stringify(['COURIER', cityRef, streetRef, house, apartment]);
  }
  return JSON.stringify([method, cityRef, pointRef]);
}

/**
 * Canonical SHA-256 fingerprint of material checkout intent.
 * Includes customerPhone, loyaltyPhone, contactMethod, full delivery target
 * (method, cityRef, pointRef or streetRef/house/apartment), paymentOption,
 * and sorted cart items with quantities.
 * Prices/names/comments are intentionally excluded (contract §6.7).
 */
export function computeRequestFingerprint(input: FingerprintInput): string {
  const lines = input.items
    .map(item => fingerprintItemLine(item, '|'))
    .sort();
  const canonical = [
    input.customerPhone.trim(),
    (input.loyaltyPhone ?? '').trim(),
    input.contactMethod.trim(),
    buildDeliveryTargetLine(input),
    (input.paymentOption ?? '').trim(),
    ...lines,
  ].join('\n');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Whether a replayed attempt is bound to the original material intent.
 *
 * A missing fingerprint on either side cannot verify anything, so it must
 * never count as a match — otherwise a retry could silently answer for a
 * different cart than the one that created the order.
 */
export function isFingerprintBound(
  stored: string | null | undefined,
  request: string | null | undefined,
): boolean {
  return Boolean(stored) && stored === request;
}

export type AttemptProbeDecision =
  | { action: 'proceed' }
  | { action: 'replay'; orderNumber: string; total: number; replayed: true }
  | { action: 'conflict'; code: 'ATTEMPT_REUSED' };

/**
 * Evaluates the pre-pricing order lookup for an incoming checkout attempt.
 * - If no order exists for `attemptId`, proceed to pricing and order creation.
 * - If an order exists with an identical `requestFingerprint`, replay it (`replayed: true`).
 * - If an order exists with a different (or missing) fingerprint, reject with `ATTEMPT_REUSED`.
 */
export function evaluateAttemptProbe(
  existing: { orderNumber: string; total: number; requestFingerprint: string | null } | null,
  requestFingerprint: string,
): AttemptProbeDecision {
  if (!existing) {
    return { action: 'proceed' };
  }
  if (!isFingerprintBound(existing.requestFingerprint, requestFingerprint)) {
    return { action: 'conflict', code: 'ATTEMPT_REUSED' };
  }
  return {
    action: 'replay',
    orderNumber: existing.orderNumber,
    total: existing.total,
    replayed: true,
  };
}
