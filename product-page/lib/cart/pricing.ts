import type { DiscountTier } from '@/lib/content/types';

export const ADDITIONAL_ITEM_DISCOUNT = 300;

export interface CartPricingLine {
  unitPrice: number;
  quantity: number;
  quantityDiscountEligible: boolean;
}

export interface CartTotals {
  subtotal: number;
  eligibleSubtotal: number;
  eligibleQuantity: number;
  quantityDiscount: number;
  appliedTier: DiscountTier | null;
  total: number;
}

function wholeUah(value: number) {
  return Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0));
}

export function selectQuantityDiscountTier(quantity: number, tiers: DiscountTier[]) {
  const safeQuantity = wholeUah(quantity);
  return [...tiers]
    .filter(tier => wholeUah(tier.minQuantity) <= safeQuantity)
    .sort((left, right) => right.minQuantity - left.minQuantity || right.amount - left.amount)[0] ?? null;
}

export function calculateCartTotals(lines: CartPricingLine[], tiers: DiscountTier[]): CartTotals {
  let subtotal = 0;
  let eligibleSubtotal = 0;
  let eligibleQuantity = 0;

  for (const line of lines) {
    const unitPrice = wholeUah(line.unitPrice);
    const quantity = wholeUah(line.quantity);
    const lineSubtotal = unitPrice * quantity;
    subtotal += lineSubtotal;

    if (line.quantityDiscountEligible) {
      eligibleSubtotal += lineSubtotal;
      eligibleQuantity += quantity;
    }
  }

  const appliedTier = selectQuantityDiscountTier(eligibleQuantity, tiers);
  // Tiers contain the cumulative discount at their threshold (2: 200, 3: 500).
  // From the third eligible item onward, each extra unit adds another 300 UAH.
  // Keep the configured tier as the base, including any explicit higher tiers.
  const additionalQuantity = appliedTier && appliedTier.minQuantity >= 3
    ? Math.max(0, eligibleQuantity - wholeUah(appliedTier.minQuantity))
    : 0;
  const quantityDiscount = Math.min(
    wholeUah(appliedTier?.amount ?? 0) + additionalQuantity * ADDITIONAL_ITEM_DISCOUNT,
    eligibleSubtotal,
  );

  return {
    subtotal,
    eligibleSubtotal,
    eligibleQuantity,
    quantityDiscount,
    appliedTier,
    total: subtotal - quantityDiscount,
  };
}
