import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LOYALTY_DISCOUNT_PERCENT,
  calculateLoyaltyDiscount,
} from '../lib/cart/loyalty-math';

describe('calculateLoyaltyDiscount', () => {
  it('applies standard 5% with truncation', () => {
    assert.equal(LOYALTY_DISCOUNT_PERCENT, 5);
    const result = calculateLoyaltyDiscount({
      subtotal: 2249,
      quantityDiscount: 0,
      discountPercent: 5,
    });
    // trunc(2249 * 5 / 100) = trunc(112.45) = 112
    assert.equal(result.baseTotal, 2249);
    assert.equal(result.amount, 112);
    assert.equal(result.discountedTotal, 2137);
  });

  it('returns zero discount for 0%', () => {
    const result = calculateLoyaltyDiscount({
      subtotal: 1000,
      quantityDiscount: 0,
      discountPercent: 0,
    });
    assert.equal(result.amount, 0);
    assert.equal(result.discountedTotal, 1000);
  });

  it('applies loyalty on top of quantity discount (same ordering as quote.total)', () => {
    const result = calculateLoyaltyDiscount({
      subtotal: 3000,
      quantityDiscount: 200,
      discountPercent: 5,
    });
    assert.equal(result.baseTotal, 2800);
    // trunc(2800 * 5 / 100) = 140
    assert.equal(result.amount, 140);
    assert.equal(result.discountedTotal, 2660);
  });

  it('uses truncation for non-divisible amounts (not round/floor of a float path)', () => {
    // 999 * 5 / 100 = 49.95 → 49
    assert.equal(calculateLoyaltyDiscount({
      subtotal: 999,
      quantityDiscount: 0,
      discountPercent: 5,
    }).amount, 49);

    // 1 * 5 / 100 = 0.05 → 0
    assert.equal(calculateLoyaltyDiscount({
      subtotal: 1,
      quantityDiscount: 0,
      discountPercent: 5,
    }).amount, 0);

    // 101 * 5 / 100 = 5.05 → 5
    assert.equal(calculateLoyaltyDiscount({
      subtotal: 101,
      quantityDiscount: 0,
      discountPercent: 5,
    }).amount, 5);

    // 100 * 5 / 100 = 5 exactly
    assert.equal(calculateLoyaltyDiscount({
      subtotal: 100,
      quantityDiscount: 0,
      discountPercent: 5,
    }).amount, 5);
  });

  it('handles zero subtotal', () => {
    const result = calculateLoyaltyDiscount({
      subtotal: 0,
      quantityDiscount: 0,
      discountPercent: 5,
    });
    assert.equal(result.amount, 0);
    assert.equal(result.discountedTotal, 0);
  });

  it('caps quantity discount at subtotal', () => {
    const result = calculateLoyaltyDiscount({
      subtotal: 100,
      quantityDiscount: 150,
      discountPercent: 5,
    });
    assert.equal(result.baseTotal, 0);
    assert.equal(result.amount, 0);
    assert.equal(result.discountedTotal, 0);
  });

  it('never lets discounted total exceed base total', () => {
    for (const percent of [0, 1, 5, 50, 100, 150, -5, Number.NaN]) {
      const result = calculateLoyaltyDiscount({
        subtotal: 2249,
        quantityDiscount: 100,
        discountPercent: percent,
      });
      assert.ok(result.discountedTotal <= result.baseTotal);
      assert.ok(result.discountedTotal >= 0);
      assert.ok(result.amount >= 0);
      assert.ok(result.amount <= result.baseTotal);
    }
  });

  it('caps discount percent at 100', () => {
    const result = calculateLoyaltyDiscount({
      subtotal: 1000,
      quantityDiscount: 0,
      discountPercent: 150,
    });
    assert.equal(result.amount, 1000);
    assert.equal(result.discountedTotal, 0);
  });

  it('treats non-finite inputs safely', () => {
    const result = calculateLoyaltyDiscount({
      subtotal: Number.POSITIVE_INFINITY,
      quantityDiscount: Number.NaN,
      discountPercent: 5,
    });
    assert.equal(result.baseTotal, 0);
    assert.equal(result.amount, 0);
    assert.equal(result.discountedTotal, 0);
  });

  it('matches historical CartDrawer formula for typical order totals', () => {
    // Mirrors: amount = Math.trunc((subtotal - quantityDiscount) * percent / 100)
    const cases = [
      { subtotal: 2249, quantityDiscount: 0, discountPercent: 5, expectedAmount: 112, expectedTotal: 2137 },
      { subtotal: 2249, quantityDiscount: 100, discountPercent: 5, expectedAmount: 107, expectedTotal: 2042 },
      { subtotal: 5000, quantityDiscount: 500, discountPercent: 5, expectedAmount: 225, expectedTotal: 4275 },
    ];
    for (const testCase of cases) {
      const legacyBase = testCase.subtotal - testCase.quantityDiscount;
      const legacyAmount = Math.trunc(legacyBase * testCase.discountPercent / 100);
      const result = calculateLoyaltyDiscount(testCase);
      assert.equal(result.amount, legacyAmount);
      assert.equal(result.amount, testCase.expectedAmount);
      assert.equal(result.discountedTotal, testCase.expectedTotal);
    }
  });
});
