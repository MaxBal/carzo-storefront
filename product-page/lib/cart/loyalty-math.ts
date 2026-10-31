/**
 * Shared pure loyalty discount math.
 * Single source of truth for UI preview and server authoritative totals.
 * Money units are whole UAH integers; amount uses truncation (same as historical CartDrawer).
 */

export const LOYALTY_DISCOUNT_PERCENT = 5;

export interface LoyaltyDiscountInput {
  /** Cart subtotal before quantity discount (whole UAH). */
  subtotal: number;
  /** Quantity discount already applied to the quote (whole UAH). */
  quantityDiscount: number;
  /** 0–100. Non-integers are truncated toward zero. */
  discountPercent: number;
}

export interface LoyaltyDiscountResult {
  /** Base after quantity discount (= CartQuote.total). */
  baseTotal: number;
  /** Truncated loyalty discount amount (whole UAH). */
  amount: number;
  /** Final total after loyalty (baseTotal - amount). */
  discountedTotal: number;
}

function wholeUah(value: number): number {
  return Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0));
}

/**
 * amount = trunc((subtotal - quantityDiscount) * discountPercent / 100)
 * discountedTotal = baseTotal - amount
 * Amount is capped so discountedTotal never exceeds baseTotal (and never goes negative).
 */
export function calculateLoyaltyDiscount(input: LoyaltyDiscountInput): LoyaltyDiscountResult {
  const subtotal = wholeUah(input.subtotal);
  const quantityDiscount = Math.min(wholeUah(input.quantityDiscount), subtotal);
  const baseTotal = subtotal - quantityDiscount;
  const percent = Math.min(100, wholeUah(input.discountPercent));
  const rawAmount = Math.trunc((baseTotal * percent) / 100);
  const amount = Math.min(rawAmount, baseTotal);
  return {
    baseTotal,
    amount,
    discountedTotal: baseTotal - amount,
  };
}
