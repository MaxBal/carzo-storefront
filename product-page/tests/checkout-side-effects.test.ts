import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { withCheckoutPricing } from '../lib/cart/checkout-pricing';
import { buildLoyaltyAuditNote } from '../lib/cart/order-audit';
import type { CartQuote } from '../lib/cart/types';

const PHONE = '+380931234567';

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

function createSideEffectSpies() {
  const calls = {
    writeOrder: 0,
    notify: 0,
    upsertCustomer: 0,
  };
  return {
    calls,
    async persist() {
      calls.writeOrder += 1;
      calls.notify += 1;
      calls.upsertCustomer += 1;
    },
  };
}

describe('checkout side effects on change/error paths', () => {
  it('does not write order / notify / upsert on PRICE_CHANGED', async () => {
    const spies = createSideEffectSpies();
    const result = await withCheckoutPricing({
      quote: makeQuote({ subtotal: 2300, total: 2300 }),
      customerPhone: PHONE,
      loyaltyPhone: PHONE,
      expectedTotal: 2137,
      expectedBaseTotal: 2249,
      lookup: async () => ({ phone: PHONE }),
      onBlocked: (outcome) => outcome.code,
      onReady: async () => {
        await spies.persist();
        return 'persisted';
      },
    });
    assert.equal(result, 'PRICE_CHANGED');
    assert.deepEqual(spies.calls, { writeOrder: 0, notify: 0, upsertCustomer: 0 });
  });

  it('does not write order / notify / upsert on LOYALTY_CHANGED', async () => {
    const spies = createSideEffectSpies();
    const result = await withCheckoutPricing({
      quote: makeQuote(),
      customerPhone: PHONE,
      loyaltyPhone: PHONE,
      expectedTotal: 2137,
      expectedBaseTotal: 2249,
      lookup: async () => null,
      onBlocked: (outcome) => outcome.code,
      onReady: async () => {
        await spies.persist();
        return 'persisted';
      },
    });
    assert.equal(result, 'LOYALTY_CHANGED');
    assert.deepEqual(spies.calls, { writeOrder: 0, notify: 0, upsertCustomer: 0 });
  });

  it('does not write order / notify / upsert on LOYALTY_UNAVAILABLE', async () => {
    const spies = createSideEffectSpies();
    const result = await withCheckoutPricing({
      quote: makeQuote(),
      customerPhone: PHONE,
      loyaltyPhone: PHONE,
      expectedTotal: 2137,
      expectedBaseTotal: 2249,
      lookup: async () => {
        throw new Error('store down');
      },
      onBlocked: (outcome) => outcome.code,
      onReady: async () => {
        await spies.persist();
        return 'persisted';
      },
    });
    assert.equal(result, 'LOYALTY_UNAVAILABLE');
    assert.deepEqual(spies.calls, { writeOrder: 0, notify: 0, upsertCustomer: 0 });
  });

  it('writes only after authoritative total is confirmed', async () => {
    const spies = createSideEffectSpies();
    const result = await withCheckoutPricing({
      quote: makeQuote(),
      customerPhone: PHONE,
      loyaltyPhone: PHONE,
      expectedTotal: 2137,
      expectedBaseTotal: 2249,
      lookup: async () => ({ phone: PHONE }),
      onBlocked: () => -1,
      onReady: async (pricing) => {
        assert.equal(pricing.total, 2137);
        await spies.persist();
        return pricing.total;
      },
    });
    assert.equal(result, 2137);
    assert.deepEqual(spies.calls, { writeOrder: 1, notify: 1, upsertCustomer: 1 });
  });
});

describe('buildLoyaltyAuditNote', () => {
  it('returns null when loyalty was not involved', () => {
    assert.equal(buildLoyaltyAuditNote({
      loyaltyPhone: null,
      eligible: false,
      discountPercent: 0,
      discountAmount: 0,
      phoneMismatch: false,
    }), null);
  });

  it('serializes loyalty audit without touching customer comment semantics', () => {
    const note = buildLoyaltyAuditNote({
      loyaltyPhone: PHONE,
      eligible: true,
      discountPercent: 5,
      discountAmount: 112,
      phoneMismatch: false,
    });
    assert.ok(note);
    const parsed = JSON.parse(note) as {
      loyalty: {
        phone: string;
        eligible: boolean;
        discount_percent: number;
        discount_amount: number;
        phone_mismatch: boolean;
      };
    };
    assert.equal(parsed.loyalty.phone, PHONE);
    assert.equal(parsed.loyalty.eligible, true);
    assert.equal(parsed.loyalty.discount_percent, 5);
    assert.equal(parsed.loyalty.discount_amount, 112);
    assert.equal(parsed.loyalty.phone_mismatch, false);
  });

  it('records phone mismatch even without a canonical loyalty phone', () => {
    const note = buildLoyaltyAuditNote({
      loyaltyPhone: null,
      eligible: false,
      discountPercent: 0,
      discountAmount: 0,
      phoneMismatch: true,
    });
    assert.ok(note);
    const parsed = JSON.parse(note) as { loyalty: { phone_mismatch: boolean } };
    assert.equal(parsed.loyalty.phone_mismatch, true);
  });
});
