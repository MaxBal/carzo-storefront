import assert from 'node:assert/strict';
import { it } from 'node:test';
import { calculateCartTotals } from '../lib/cart/pricing';
import { calculateLoyaltyDiscount } from '../lib/cart/loyalty-math';
import { tiers } from './fixtures/commerce';

it('adds 200 UAH for the second unit and 300 for the third and every subsequent unit', () => {
  const examples = [[0, 0], [1, 0], [2, 200], [3, 500], [4, 800], [5, 1100], [6, 1400], [20, 5600], [30, 8600]];
  for (const [quantity, discount] of examples) {
    const totals = calculateCartTotals([{ unitPrice: 2249, quantity, quantityDiscountEligible: true }], tiers);
    assert.equal(totals.quantityDiscount, discount, `discount for ${quantity} units`);
    assert.equal(totals.total, 2249 * quantity - discount);
  }
});

it('counts eligible units across configurations and keeps excluded products at their full price', () => {
  const totals = calculateCartTotals([
    { unitPrice: 2249, quantity: 2, quantityDiscountEligible: true },
    { unitPrice: 1290, quantity: 1, quantityDiscountEligible: true },
    { unitPrice: 600, quantity: 2, quantityDiscountEligible: true },
    { unitPrice: 500, quantity: 3, quantityDiscountEligible: false },
  ], tiers);
  assert.equal(totals.eligibleQuantity, 5);
  assert.equal(totals.eligibleSubtotal, 6988);
  assert.equal(totals.quantityDiscount, 1100);
  assert.equal(totals.total, 7388);
});

it('never subtracts more than the eligible subtotal or discounts excluded items', () => {
  const totals = calculateCartTotals([
    { unitPrice: 100, quantity: 5, quantityDiscountEligible: true },
    { unitPrice: 1000, quantity: 1, quantityDiscountEligible: false },
  ], tiers);
  assert.equal(totals.quantityDiscount, 500);
  assert.equal(totals.total, 1000);
  assert.equal(calculateCartTotals([{ unitPrice: 100, quantity: 5, quantityDiscountEligible: false }], tiers).quantityDiscount, 0);
  assert.equal(calculateCartTotals([{ unitPrice: 100, quantity: 5, quantityDiscountEligible: true }], []).quantityDiscount, 0);
});

it('retains catalog tier amounts and applies loyalty after the progressive quantity discount', () => {
  const lines = [{ unitPrice: 2249, quantity: 5, quantityDiscountEligible: true }];
  const totals = calculateCartTotals(lines, [...tiers].reverse());
  const loyalty = calculateLoyaltyDiscount({ subtotal: totals.subtotal, quantityDiscount: totals.quantityDiscount, discountPercent: 5 });
  assert.equal(loyalty.baseTotal, 10145);
  assert.equal(loyalty.amount, 507);
  assert.equal(loyalty.discountedTotal, 9638);
  const customTiers = [...tiers, { key: 'five', minQuantity: 5, amount: 1200, sort: 3 }];
  assert.equal(calculateCartTotals(lines, customTiers).quantityDiscount, 1200);
  assert.equal(calculateCartTotals([{ ...lines[0], quantity: 6 }], customTiers).quantityDiscount, 1500);
});
