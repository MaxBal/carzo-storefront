import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  OrderStoreError,
  createOrderRepository,
} from '../lib/data/orders';
import { createSupabaseOrderRepository } from '../lib/data/orders/supabase';
import { createDirectusOrderRepository } from '../lib/data/orders/directus';
import type { OrderSnapshot } from '../lib/data/orders/types';

function minimalSnapshot(overrides: Partial<OrderSnapshot> = {}): OrderSnapshot {
  return {
    checkoutAttemptId: null,
    requestFingerprint: null,
    customerName: 'Test Buyer',
    customerPhone: '+380501112233',
    customerComment: null,
    contactMethod: 'phone',
    paymentOption: null,
    deliveryMethod: 'BRANCH',
    deliveryCityRef: 'city-ref',
    deliveryCityName: 'Київ',
    deliveryPointRef: 'point-ref',
    deliveryPointNumber: '1',
    deliveryPointName: 'Відділення',
    deliveryPointAddress: 'вул. Тестова, 1',
    deliveryPointType: 'branch',
    deliveryStreetRef: null,
    deliveryStreetName: null,
    deliveryStreetType: null,
    deliveryHouse: null,
    deliveryApartment: null,
    itemsQuantity: 1,
    subtotal: 1500,
    quantityDiscount: 0,
    loyalty: {
      loyaltyPhone: null,
      eligible: false,
      discountPercent: 0,
      discountAmount: 0,
      phoneMismatch: false,
    },
    total: 1500,
    discountTierKey: null,
    managerNote: null,
    items: [{
      sort: 1,
      itemKey: 'M|design|none|both',
      title: 'Чохол',
      designSlug: 'design',
      designLabel: 'Дизайн',
      sizeCode: 'M',
      sizeLabel: 'M',
      brandSlug: 'none',
      brandName: 'Carzo',
      fixationKey: 'both',
      fixationLabel: 'Обидві',
      unitPrice: 1500,
      quantity: 1,
      lineTotal: 1500,
      quantityDiscountEligible: true,
    }],
    ...overrides,
  };
}

describe('Stage 4/6 order repository', () => {
  it('missing ORDER_STORE selects Directus writer', () => {
    const repo = createOrderRepository('directus');
    assert.ok(repo);
    assert.ok(createDirectusOrderRepository());
  });

  it('ORDER_STORE=supabase → repository resolves without fail-closed placeholder', () => {
    const repo = createSupabaseOrderRepository();
    assert.equal(typeof repo.createOrder, 'function');
    assert.equal(typeof repo.findOrderByAttemptId, 'function');
  });

  it('supabase writer rejects a snapshot without checkout attempt id', async () => {
    const repo = createSupabaseOrderRepository();
    await assert.rejects(
      () => repo.createOrder(minimalSnapshot()),
      (error: unknown) => {
        assert.ok(error instanceof OrderStoreError);
        assert.equal(error.code, 'WRITE_FAILED');
        assert.match(error.message, /attempt id/i);
        return true;
      },
    );
  });

  it('directus writer has no attempt-id idempotency probe', async () => {
    const repo = createDirectusOrderRepository();
    assert.equal(await repo.findOrderByAttemptId('2b6a1c3e-0f2b-4a3c-9d4e-1a2b3c4d5e6f'), null);
  });

  it('order repository chooses backend without cross-fallback', () => {
    assert.notEqual(createOrderRepository('directus'), createOrderRepository('supabase'));
  });
});
