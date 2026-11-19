import assert from 'node:assert/strict';
import { it } from 'node:test';
import { addCartQuantity, availableCartQuantity } from '../lib/cart/quantity';
import { cartItemSchema } from '../lib/cart/validation';
import { calculateCartTotals } from '../lib/cart/pricing';
import { computeCartItemsSignature } from '../lib/cart/checkout-attempt-client';
import type { CaseCartItem } from '../lib/cart/types';
import { pillowItem, tiers } from './fixtures/commerce';

const item: CaseCartItem = { size: 'M', designSlug: '4-0', brandId: 'none', fixation: 'none', quantity: 1 };

it('adds the selected quantity atomically and preserves previous one-unit callers', () => {
  const single = addCartQuantity([], cartItemSchema.parse(item));
  assert.equal(single[0].quantity, 1);
  const original = [{ ...item, quantity: 2 }];
  const result = addCartQuantity(original, { ...item, quantity: 3 });
  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, 5);
  assert.equal(original[0].quantity, 2, 'existing state is immutable');
  assert.equal(computeCartItemsSignature(result), 'M:4-0:none:none:5');
});

it('keeps different configurations and future product types separate', () => {
  const existing = [{ ...item, brandId: 'audi', quantity: 2 }, pillowItem()];
  const result = addCartQuantity(existing, { ...item, quantity: 3 });
  assert.deepEqual(result.map(line => line.quantity), [2, 1, 3]);
  const personalized = addCartQuantity(result, { ...pillowItem(), quantity: 2 });
  assert.deepEqual(personalized.map(line => line.quantity), [2, 3, 3]);
});

it('calculates remaining per-line and whole-cart capacity without silently trimming a request', () => {
  const existing = [{ ...item, quantity: 18 }];
  assert.equal(availableCartQuantity(existing, item), 2);
  assert.strictEqual(addCartQuantity(existing, { ...item, quantity: 3 }), existing);
  assert.equal(addCartQuantity(existing, { ...item, quantity: 2 })[0].quantity, 20);
  assert.equal(availableCartQuantity([{ ...item, quantity: 20 }], item), 0);
  const mixed = [{ ...item, brandId: 'audi', quantity: 20 }, { ...pillowItem(), quantity: 7 }];
  assert.equal(availableCartQuantity(mixed, item), 3);
  assert.strictEqual(addCartQuantity(mixed, { ...item, quantity: 4 }), mixed);
  assert.equal(addCartQuantity(mixed, { ...item, quantity: 3 }).reduce((sum, line) => sum + line.quantity, 0), 30);
});

it('rejects invalid quantities and keeps selection fingerprints sensitive to quantity', () => {
  for (const quantity of [0, -1, 1.5, NaN, Infinity, 21]) {
    assert.equal(cartItemSchema.safeParse({ ...item, quantity }).success, false);
    const existing = [item];
    assert.strictEqual(addCartQuantity(existing, { ...item, quantity }), existing);
  }
  assert.notEqual(computeCartItemsSignature([item]), computeCartItemsSignature([{ ...item, quantity: 2 }]));
});

it('uses the configured unit price and one shared quantity discount', () => {
  const configuredUnitPrice = 2249 + 290 + 80;
  const quote = (quantity: number, eligible = true) => calculateCartTotals([{ unitPrice: configuredUnitPrice, quantity, quantityDiscountEligible: eligible }], tiers);
  assert.equal(quote(1).total, 2619);
  assert.equal(quote(2).total, 5038);
  assert.equal(quote(3).total, 7357);
  assert.equal(quote(3, false).total, 7857);
  const combined = addCartQuantity([{ ...item, quantity: 2 }], { ...item, quantity: 3 });
  assert.equal(calculateCartTotals(combined.map(line => ({ unitPrice: 2249, quantity: line.quantity, quantityDiscountEligible: true })), tiers).quantityDiscount, 500);
});
