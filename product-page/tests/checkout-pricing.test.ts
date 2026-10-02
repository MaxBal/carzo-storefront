import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  classifyPricingMismatch,
  resolveCheckoutPricing,
  resolveLoyaltyState,
  type CustomerLookup,
} from '../lib/cart/checkout-pricing';
import type { CartQuote } from '../lib/cart/types';

const PHONE = '+380931234567';
const OTHER_PHONE = '+380671112233';

function makeQuote(overrides: Partial<CartQuote> = {}): CartQuote {
  return {
    lines: [],
    subtotal: 2249,
    quantityDiscount: 0,
    total: 2249,
    itemsQuantity: 1,
    appliedTier: null,
    allowPostomat: true,
    canCheckout: true,
    checkoutPaymentDetails: '',
    verifiedAt: new Date().toISOString(),
    ...overrides,
  };
}

function eligibleLookup(): CustomerLookup {
  return async () => ({ phone: PHONE });
}

function ineligibleLookup(): CustomerLookup {
  return async () => null;
}

function failingLookup(): CustomerLookup {
  return async () => {
    throw new Error('store down');
  };
}

describe('resolveLoyaltyState', () => {
  it('applies 5% when loyalty phone matches and customer exists', async () => {
    const outcome = await resolveLoyaltyState({
      customerPhone: PHONE,
      loyaltyPhone: PHONE,
      subtotal: 2249,
      quantityDiscount: 0,
      lookup: eligibleLookup(),
    });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.loyalty.eligible, true);
    assert.equal(outcome.loyalty.discountPercent, 5);
    assert.equal(outcome.loyalty.discountAmount, 112);
    assert.equal(outcome.loyalty.applied, true);
    assert.equal(outcome.loyalty.phoneMismatch, false);
  });

  it('applies 0% when customer is missing', async () => {
    const outcome = await resolveLoyaltyState({
      customerPhone: PHONE,
      loyaltyPhone: PHONE,
      subtotal: 2249,
      quantityDiscount: 0,
      lookup: ineligibleLookup(),
    });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.loyalty.eligible, false);
    assert.equal(outcome.loyalty.discountPercent, 0);
    assert.equal(outcome.loyalty.discountAmount, 0);
    assert.equal(outcome.loyalty.applied, false);
  });

  it('does not apply loyalty when no loyalty phone is supplied', async () => {
    let called = false;
    const outcome = await resolveLoyaltyState({
      customerPhone: PHONE,
      loyaltyPhone: null,
      subtotal: 2249,
      quantityDiscount: 0,
      lookup: async () => {
        called = true;
        return { phone: PHONE };
      },
    });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.loyalty.discountAmount, 0);
    assert.equal(outcome.loyalty.applied, false);
    assert.equal(called, false);
  });

  it('blocks loyalty when loyaltyPhone != customerPhone', async () => {
    let called = false;
    const outcome = await resolveLoyaltyState({
      customerPhone: PHONE,
      loyaltyPhone: OTHER_PHONE,
      subtotal: 2249,
      quantityDiscount: 0,
      lookup: async () => {
        called = true;
        return { phone: OTHER_PHONE };
      },
    });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.loyalty.phoneMismatch, true);
    assert.equal(outcome.loyalty.discountAmount, 0);
    assert.equal(called, false);
  });

  it('normalizes equivalent phone formats before comparing', async () => {
    const outcome = await resolveLoyaltyState({
      customerPhone: '(093) 123-45-67',
      loyaltyPhone: '380931234567',
      subtotal: 2249,
      quantityDiscount: 0,
      lookup: eligibleLookup(),
    });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.loyalty.phoneMismatch, false);
    assert.equal(outcome.loyalty.eligible, true);
  });

  it('treats store outage as LOYALTY_UNAVAILABLE, not ineligible', async () => {
    const outcome = await resolveLoyaltyState({
      customerPhone: PHONE,
      loyaltyPhone: PHONE,
      subtotal: 2249,
      quantityDiscount: 0,
      lookup: failingLookup(),
    });
    assert.equal(outcome.ok, false);
    if (outcome.ok) return;
    assert.equal(outcome.code, 'LOYALTY_UNAVAILABLE');
  });
});

describe('classifyPricingMismatch', () => {
  it('uses explicit base total when provided', () => {
    assert.equal(classifyPricingMismatch({
      baseTotal: 2300,
      discountAmount: 0,
      expectedTotal: 2137,
      expectedBaseTotal: 2249,
    }), 'PRICE_CHANGED');

    assert.equal(classifyPricingMismatch({
      baseTotal: 2249,
      discountAmount: 112,
      expectedTotal: 2249,
      expectedBaseTotal: 2249,
    }), 'LOYALTY_CHANGED');
  });

  it('falls back when expectedBaseTotal is absent', () => {
    // Lost loyalty: client saw discounted total, server has none.
    assert.equal(classifyPricingMismatch({
      baseTotal: 2249,
      discountAmount: 0,
      expectedTotal: 2137,
    }), 'LOYALTY_CHANGED');

    // Gained loyalty: client saw full total, server applies discount.
    assert.equal(classifyPricingMismatch({
      baseTotal: 2249,
      discountAmount: 112,
      expectedTotal: 2249,
    }), 'LOYALTY_CHANGED');

    // Quote moved with no loyalty.
    assert.equal(classifyPricingMismatch({
      baseTotal: 2300,
      discountAmount: 0,
      expectedTotal: 2249,
    }), 'PRICE_CHANGED');
  });
});

describe('resolveCheckoutPricing', () => {
  it('allows eligible customer with correct discounted expectedTotal', async () => {
    const outcome = await resolveCheckoutPricing({
      quote: makeQuote(),
      customerPhone: PHONE,
      loyaltyPhone: PHONE,
      expectedTotal: 2137,
      expectedBaseTotal: 2249,
      lookup: eligibleLookup(),
    });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.pricing.total, 2137);
    assert.equal(outcome.pricing.baseTotal, 2249);
    assert.equal(outcome.pricing.discount.amount, 112);
  });

  it('allows ineligible customer at full total', async () => {
    const outcome = await resolveCheckoutPricing({
      quote: makeQuote(),
      customerPhone: PHONE,
      loyaltyPhone: PHONE,
      expectedTotal: 2249,
      expectedBaseTotal: 2249,
      lookup: ineligibleLookup(),
    });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.pricing.total, 2249);
    assert.equal(outcome.pricing.discount.amount, 0);
  });

  it('allows no-loyalty checkout at full total', async () => {
    const outcome = await resolveCheckoutPricing({
      quote: makeQuote(),
      customerPhone: PHONE,
      loyaltyPhone: null,
      expectedTotal: 2249,
      expectedBaseTotal: 2249,
      lookup: eligibleLookup(),
    });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.pricing.total, 2249);
  });

  it('rejects client expectedTotal tampering', async () => {
    const outcome = await resolveCheckoutPricing({
      quote: makeQuote(),
      customerPhone: PHONE,
      loyaltyPhone: PHONE,
      expectedTotal: 1000,
      expectedBaseTotal: 2249,
      lookup: eligibleLookup(),
    });
    assert.equal(outcome.ok, false);
    if (outcome.ok) return;
    assert.equal(outcome.code, 'LOYALTY_CHANGED');
    assert.equal(outcome.pricing.total, 2137);
  });

  it('rejects base-total tampering even if final coincidentally matches', async () => {
    const outcome = await resolveCheckoutPricing({
      quote: makeQuote({ subtotal: 2300, total: 2300 }),
      customerPhone: PHONE,
      loyaltyPhone: null,
      expectedTotal: 2300,
      expectedBaseTotal: 2100,
      lookup: eligibleLookup(),
    });
    assert.equal(outcome.ok, false);
    if (outcome.ok) return;
    assert.equal(outcome.code, 'PRICE_CHANGED');
  });

  it('returns LOYALTY_CHANGED when eligibility disappears between cart and checkout', async () => {
    // UI previously showed 5% (2137); server now finds ineligible → full 2249.
    const outcome = await resolveCheckoutPricing({
      quote: makeQuote(),
      customerPhone: PHONE,
      loyaltyPhone: PHONE,
      expectedTotal: 2137,
      expectedBaseTotal: 2249,
      lookup: ineligibleLookup(),
    });
    assert.equal(outcome.ok, false);
    if (outcome.ok) return;
    assert.equal(outcome.code, 'LOYALTY_CHANGED');
    assert.equal(outcome.pricing.total, 2249);
    assert.equal(outcome.pricing.loyalty.eligible, false);
  });

  it('returns LOYALTY_CHANGED when customer becomes eligible (UI expected full price)', async () => {
    const outcome = await resolveCheckoutPricing({
      quote: makeQuote(),
      customerPhone: PHONE,
      loyaltyPhone: PHONE,
      expectedTotal: 2249,
      expectedBaseTotal: 2249,
      lookup: eligibleLookup(),
    });
    assert.equal(outcome.ok, false);
    if (outcome.ok) return;
    assert.equal(outcome.code, 'LOYALTY_CHANGED');
    assert.equal(outcome.pricing.total, 2137);
    assert.equal(outcome.pricing.loyalty.eligible, true);
  });

  it('returns LOYALTY_CHANGED when phones mismatch and UI expected a discount', async () => {
    const outcome = await resolveCheckoutPricing({
      quote: makeQuote(),
      customerPhone: PHONE,
      loyaltyPhone: OTHER_PHONE,
      expectedTotal: 2137,
      expectedBaseTotal: 2249,
      lookup: eligibleLookup(),
    });
    assert.equal(outcome.ok, false);
    if (outcome.ok) return;
    assert.equal(outcome.code, 'LOYALTY_CHANGED');
    assert.equal(outcome.pricing.loyalty.phoneMismatch, true);
    assert.equal(outcome.pricing.total, 2249);
  });

  it('returns PRICE_CHANGED when underlying quote changed', async () => {
    // UI confirmed 2249 base / 2137 with loyalty; server quote is now 2300 base.
    const outcome = await resolveCheckoutPricing({
      quote: makeQuote({ subtotal: 2300, total: 2300 }),
      customerPhone: PHONE,
      loyaltyPhone: PHONE,
      expectedTotal: 2137,
      expectedBaseTotal: 2249,
      lookup: eligibleLookup(),
    });
    assert.equal(outcome.ok, false);
    if (outcome.ok) return;
    assert.equal(outcome.code, 'PRICE_CHANGED');
  });

  it('returns LOYALTY_UNAVAILABLE when lookup fails while loyalty is requested', async () => {
    const outcome = await resolveCheckoutPricing({
      quote: makeQuote(),
      customerPhone: PHONE,
      loyaltyPhone: PHONE,
      expectedTotal: 2137,
      expectedBaseTotal: 2249,
      lookup: failingLookup(),
    });
    assert.equal(outcome.ok, false);
    if (outcome.ok) return;
    assert.equal(outcome.code, 'LOYALTY_UNAVAILABLE');
  });

  it('does not call lookup when loyalty is not requested (store outage cannot raise price)', async () => {
    const outcome = await resolveCheckoutPricing({
      quote: makeQuote(),
      customerPhone: PHONE,
      loyaltyPhone: null,
      expectedTotal: 2249,
      expectedBaseTotal: 2249,
      lookup: failingLookup(),
    });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.pricing.total, 2249);
  });

  it('keeps quantity discount ordering: loyalty is computed on quote.total', async () => {
    const quote = makeQuote({ subtotal: 3000, quantityDiscount: 200, total: 2800 });
    const outcome = await resolveCheckoutPricing({
      quote,
      customerPhone: PHONE,
      loyaltyPhone: PHONE,
      expectedTotal: 2660,
      expectedBaseTotal: 2800,
      lookup: eligibleLookup(),
    });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.pricing.discount.amount, 140);
    assert.equal(outcome.pricing.total, 2660);
  });
});
