/**
 * Order loyalty audit payload.
 * Current Directus carzo_orders has no dedicated loyalty columns; the internal
 * manager_note text field stores structured JSON (customer_comment stays untouched).
 */

export interface LoyaltyAuditInput {
  loyaltyPhone: string | null;
  eligible: boolean;
  discountPercent: number;
  discountAmount: number;
  phoneMismatch: boolean;
}

export function buildLoyaltyAuditNote(loyalty: LoyaltyAuditInput): string | null {
  if (!loyalty.loyaltyPhone && !loyalty.phoneMismatch) return null;
  return JSON.stringify({
    loyalty: {
      phone: loyalty.loyaltyPhone,
      eligible: loyalty.eligible,
      discount_percent: loyalty.discountPercent,
      discount_amount: loyalty.discountAmount,
      phone_mismatch: loyalty.phoneMismatch,
    },
  });
}
