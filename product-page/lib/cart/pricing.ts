import type { DiscountTier } from '@/lib/content/types';

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
  const quantityDiscount = Math.min(wholeUah(appliedTier?.amount ?? 0), eligibleSubtotal);

  return {
    subtotal,
    eligibleSubtotal,
    eligibleQuantity,
    quantityDiscount,
    appliedTier,
    total: subtotal - quantityDiscount,
  };
}
