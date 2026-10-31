import { createHash, randomUUID } from 'node:crypto';

/**
 * Checkout attempt identity + request fingerprint.
 *
 * The fingerprint binds a checkout attempt to its material intent (who buys
 * what, and how they receive it) without binding to transient catalog prices,
 * so a successful prior order stays retrievable after later price changes.
 */

export function newCheckoutAttemptId(): string {
  return randomUUID();
}

export function isCheckoutAttemptId(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export interface FingerprintInput {
  customerPhone: string;
  contactMethod: string;
  deliveryMethod: string;
  items: Array<{
    size: string;
    designSlug: string;
    brandId: string;
    fixation: string;
    quantity: number;
  }>;
}

/**
 * Canonical SHA-256 fingerprint of material checkout intent.
 * Prices/names/comments are intentionally excluded (contract §6.7).
 */
export function computeRequestFingerprint(input: FingerprintInput): string {
  const lines = input.items
    .map(item => [
      item.size.trim(),
      item.designSlug.trim(),
      item.brandId.trim(),
      item.fixation.trim(),
      String(Math.trunc(item.quantity)),
    ].join('|'))
    .sort();
  const canonical = [
    input.customerPhone.trim(),
    input.contactMethod.trim(),
    input.deliveryMethod.trim(),
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
