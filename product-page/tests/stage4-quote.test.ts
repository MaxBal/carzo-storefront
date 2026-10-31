import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { calculateCartTotals } from '../lib/cart/pricing';
import type { DiscountTier, FixationInfo, SizeId } from '../lib/content/types';

function fixationExtraForSize(fixation: FixationInfo, size: string) {
  const bySize = fixation.extraBySize;
  if (bySize && typeof bySize === 'object') {
    const map = bySize as Record<string, unknown>;
    const key = String(size).toLowerCase();
    const value = map[key] ?? map[String(size)];
    if (value !== undefined && value !== null) return Number(value);
  }
  return Number(fixation.extra);
}

const bothFixation: FixationInfo = {
  value: 'both',
  label: 'Двостороння',
  extra: 0,
  extraBySize: { s: 60, m: 80, l: 100, xl: 120, S: 60, M: 80, L: 100, XL: 120 } as Partial<Record<SizeId, number>>,
  sort: 1,
};

const tiers: DiscountTier[] = [
  { key: 'quantity-2', minQuantity: 2, amount: 50, sort: 1 },
  { key: 'quantity-3', minQuantity: 3, amount: 100, sort: 2 },
];

describe('Stage 4 shared quote math (backend-neutral)', () => {
  it('base unit price', () => {
    const totals = calculateCartTotals(
      [{ unitPrice: 2000, quantity: 1, quantityDiscountEligible: true }],
      tiers,
    );
    assert.equal(totals.subtotal, 2000);
    assert.equal(totals.quantityDiscount, 0);
    assert.equal(totals.total, 2000);
  });

  it('brand surcharge adds to unit price before totals', () => {
    const unitPrice = 2000 + 290;
    const totals = calculateCartTotals(
      [{ unitPrice, quantity: 1, quantityDiscountEligible: true }],
      tiers,
    );
    assert.equal(totals.total, 2290);
  });

  it('both fixation size-aware extras S/M/L/XL', () => {
    assert.equal(fixationExtraForSize(bothFixation, 'S'), 60);
    assert.equal(fixationExtraForSize(bothFixation, 'M'), 80);
    assert.equal(fixationExtraForSize(bothFixation, 'L'), 100);
    assert.equal(fixationExtraForSize(bothFixation, 'XL'), 120);
    assert.equal(fixationExtraForSize(bothFixation, 's'), 60);
    assert.equal(fixationExtraForSize(bothFixation, 'xl'), 120);
  });

  it('qty 2 / qty 3 discount tiers (flat UAH amounts)', () => {
    const qty2 = calculateCartTotals(
      [{ unitPrice: 1000, quantity: 2, quantityDiscountEligible: true }],
      tiers,
    );
    assert.equal(qty2.subtotal, 2000);
    assert.equal(qty2.quantityDiscount, 50);
    assert.equal(qty2.total, 1950);

    const qty3 = calculateCartTotals(
      [{ unitPrice: 1000, quantity: 3, quantityDiscountEligible: true }],
      tiers,
    );
    assert.equal(qty3.quantityDiscount, 100);
    assert.equal(qty3.total, 2900);
  });

  it('mixed cart uses eligible lines only', () => {
    const totals = calculateCartTotals(
      [
        { unitPrice: 1000, quantity: 1, quantityDiscountEligible: true },
        { unitPrice: 500, quantity: 1, quantityDiscountEligible: false },
      ],
      tiers,
    );
    assert.equal(totals.subtotal, 1500);
    assert.equal(totals.quantityDiscount, 0);
    assert.equal(totals.total, 1500);
  });
});
