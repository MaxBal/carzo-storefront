import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { checkoutSchema } from '../lib/cart/validation';

const baseCheckout = {
  items: [{
    size: 'M',
    designSlug: '2-0',
    brandId: 'none',
    fixation: 'both',
    quantity: 1,
  }],
  expectedTotal: 1500,
  customerName: 'Тест Покупець',
  customerPhone: '+380501112233',
  contactMethod: 'phone',
  delivery: {
    method: 'BRANCH',
    cityRef: '11111111-1111-4111-8111-111111111111',
    pointRef: '22222222-2222-4222-8222-222222222222',
  },
};

describe('checkout input contract', () => {
  it('accepts a checkout attempt id (optional, UUID)', () => {
    const parsed = checkoutSchema.safeParse({
      ...baseCheckout,
      checkoutAttemptId: '33333333-3333-4333-8333-333333333333',
    });
    assert.ok(parsed.success);
    assert.equal(
      parsed.success && parsed.data.checkoutAttemptId,
      '33333333-3333-4333-8333-333333333333',
    );
  });

  it('accepts legacy payloads without an attempt id (Directus path)', () => {
    const parsed = checkoutSchema.safeParse(baseCheckout);
    assert.ok(parsed.success);
    assert.equal(parsed.success && parsed.data.checkoutAttemptId, undefined);
  });

  it('rejects a malformed attempt id', () => {
    const parsed = checkoutSchema.safeParse({ ...baseCheckout, checkoutAttemptId: 'nope' });
    assert.equal(parsed.success, false);
  });

  it('accepts all four contact methods', () => {
    for (const contactMethod of ['phone', 'telegram', 'viber', 'whatsapp'] as const) {
      const parsed = checkoutSchema.safeParse({ ...baseCheckout, contactMethod });
      assert.ok(parsed.success, contactMethod);
    }
  });

  it('rejects an email contact method (historical field only)', () => {
    const parsed = checkoutSchema.safeParse({ ...baseCheckout, contactMethod: 'email' });
    assert.equal(parsed.success, false);
  });

  it('accepts all three delivery methods', () => {
    const branch = checkoutSchema.safeParse(baseCheckout);
    assert.ok(branch.success);
    const postomat = checkoutSchema.safeParse({
      ...baseCheckout,
      delivery: {
        method: 'POSTOMAT',
        cityRef: '11111111-1111-4111-8111-111111111111',
        pointRef: '22222222-2222-4222-8222-222222222222',
      },
    });
    assert.ok(postomat.success);
    const courier = checkoutSchema.safeParse({
      ...baseCheckout,
      delivery: {
        method: 'COURIER',
        cityRef: '11111111-1111-4111-8111-111111111111',
        streetRef: '44444444-4444-4444-8444-444444444444',
        streetName: 'вул. Хрещатик',
        house: '1',
        apartment: '2',
      },
    });
    assert.ok(courier.success);
  });

  it('rejects an unknown delivery method', () => {
    const parsed = checkoutSchema.safeParse({
      ...baseCheckout,
      delivery: {
        method: 'PICKUP',
        cityRef: '11111111-1111-4111-8111-111111111111',
        pointRef: '22222222-2222-4222-8222-222222222222',
      },
    });
    assert.equal(parsed.success, false);
  });

  it('rejects empty items and invalid quantities', () => {
    assert.equal(checkoutSchema.safeParse({ ...baseCheckout, items: [] }).success, false);
    assert.equal(checkoutSchema.safeParse({
      ...baseCheckout,
      items: [{ ...baseCheckout.items[0], quantity: 0 }],
    }).success, false);
    assert.equal(checkoutSchema.safeParse({
      ...baseCheckout,
      items: [{ ...baseCheckout.items[0], quantity: 21 }],
    }).success, false);
  });

  it('rejects negative or fractional totals', () => {
    assert.equal(checkoutSchema.safeParse({ ...baseCheckout, expectedTotal: -1 }).success, false);
    assert.equal(checkoutSchema.safeParse({ ...baseCheckout, expectedTotal: 10.5 }).success, false);
  });
});
