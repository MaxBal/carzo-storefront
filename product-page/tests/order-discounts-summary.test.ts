import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatOrderDiscountsSummary } from '../lib/cart/order-discounts-summary';
import { formatOrderItemsSummary } from '../lib/cart/order-items-summary';

describe('formatOrderDiscountsSummary', () => {
  it('shows both discounts when quantity and loyalty apply', () => {
    assert.equal(
      formatOrderDiscountsSummary({ quantityDiscount: 200, loyaltyDiscountAmount: 210 }),
      'Разом дешевше −200 ₴\nЗнижку 5% застосовано −210 ₴',
    );
  });

  it('shows only quantity discount when loyalty is zero', () => {
    assert.equal(
      formatOrderDiscountsSummary({ quantityDiscount: 200, loyaltyDiscountAmount: 0 }),
      'Разом дешевше −200 ₴',
    );
  });

  it('shows only loyalty discount when quantity discount is zero', () => {
    assert.equal(
      formatOrderDiscountsSummary({ quantityDiscount: 0, loyaltyDiscountAmount: 130 }),
      'Знижку 5% застосовано −130 ₴',
    );
  });

  it('returns empty string when no discounts apply', () => {
    assert.equal(
      formatOrderDiscountsSummary({ quantityDiscount: 0, loyaltyDiscountAmount: 0 }),
      '',
    );
  });

  it('omits zero-amount rows and ignores negative/non-finite values', () => {
    assert.equal(
      formatOrderDiscountsSummary({ quantityDiscount: -200, loyaltyDiscountAmount: 0 }),
      '',
    );
    assert.equal(
      formatOrderDiscountsSummary({ quantityDiscount: Number.NaN, loyaltyDiscountAmount: 130 }),
      'Знижку 5% застосовано −130 ₴',
    );
  });
});

describe('formatOrderItemsSummary (fixation regression)', () => {
  it('still includes human-readable fixation labels', () => {
    const summary = formatOrderItemsSummary([
      {
        title: 'Автокейс M Carzo 4.0 для Kia',
        quantity: 1,
        lineTotal: 2619,
        fixationLabel: 'фікс.дно+стінка',
      },
    ]);
    assert.match(summary, /Фіксація: фікс\.дно\+стінка/);
  });
});
