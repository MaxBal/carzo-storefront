export interface LoyaltyCheckResult {
  eligible: boolean;
  discountPercent: number;
}

export const LOYALTY_DISCOUNT_PERCENT = 5;

/** Normalize to +380XXXXXXXXX for display/logging; server re-normalizes independently. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `+38${digits}`;
  if (digits.length === 12 && digits.startsWith('380')) return `+${digits}`;
  return digits;
}

/**
 * Calls backend customer lookup (Directus).
 * Existing cart discount application logic stays unchanged after this returns.
 */
export async function checkLoyaltyDiscount(phone: string): Promise<LoyaltyCheckResult> {
  try {
    const response = await fetch('/api/customer-discount/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!response.ok) return { eligible: false, discountPercent: 0 };
    const data = await response.json() as { eligible?: boolean; discount_percent?: number };
    return {
      eligible: Boolean(data.eligible),
      discountPercent: data.eligible ? (data.discount_percent ?? LOYALTY_DISCOUNT_PERCENT) : 0,
    };
  } catch {
    return { eligible: false, discountPercent: 0 };
  }
}
