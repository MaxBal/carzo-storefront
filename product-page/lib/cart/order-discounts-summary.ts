export interface OrderDiscountsInput {
  quantityDiscount: number;
  loyaltyDiscountAmount: number;
}

function positiveAmount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

/**
 * Pure formatter for `{{discounts_summary}}`.
 * Uses authoritative server amounts only — never recomputes discounts.
 * Rows with zero amount are omitted entirely.
 */
export function formatOrderDiscountsSummary(input: OrderDiscountsInput): string {
  const lines: string[] = [];
  const quantityDiscount = positiveAmount(input.quantityDiscount);
  const loyaltyDiscountAmount = positiveAmount(input.loyaltyDiscountAmount);

  if (quantityDiscount > 0) {
    lines.push(`Разом дешевше −${quantityDiscount} ₴`);
  }
  if (loyaltyDiscountAmount > 0) {
    lines.push(`Знижку 5% застосовано −${loyaltyDiscountAmount} ₴`);
  }
  return lines.join('\n');
}
