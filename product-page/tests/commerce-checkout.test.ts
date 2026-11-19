import assert from 'node:assert/strict';
import { it } from 'node:test';
import { quoteCatalogItem } from '../lib/commerce/pricing';
import { cape, capeItem, pillow, pillowItem } from './fixtures/commerce';

it('real checkout action preserves mixed configuration for storage, Telegram, keyCRM and safe retries', async () => {
  const keys = ['VERCEL', 'ORDER_STORE', 'CHECKOUT_MAINTENANCE'] as const;
  const env = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const { state, item, restore } = require('./helpers/checkout-action-mocks.cjs').install();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network forbidden in synthetic checkout test'); };
  try {
    process.env.VERCEL = '1';
    process.env.ORDER_STORE = 'supabase';
    delete process.env.CHECKOUT_MAINTENANCE;
    const { createOrder } = require('../app/actions/checkout');
    state.quote = { ...state.quote,
      lines: [...state.quote.lines, quoteCatalogItem(capeItem(), cape), quoteCatalogItem(pillowItem(), pillow)],
      subtotal: 4139, quantityDiscount: 500, total: 3639, itemsQuantity: 3,
      appliedTier: { key: 'three', minQuantity: 3, amount: 500 },
    };
    const input = {
      items: [item, capeItem(), pillowItem()], expectedTotal: 3639, expectedBaseTotal: 3639,
      customerName: 'Synthetic buyer', customerPhone: '+380000000000', contactMethod: 'phone',
      delivery: { method: 'BRANCH', cityRef: '11111111-1111-4111-8111-111111111111', pointRef: '22222222-2222-4222-8222-222222222222' },
      checkoutAttemptId: '33333333-3333-4333-8333-333333333333',
    };
    assert.deepEqual(await createOrder(input), { ok: true, orderNumber: 'CZ-SYNTHETIC', total: 3639, replayed: false });
    const saved = state.writes[0];
    assert.equal(saved.items.length, 3);
    assert.equal(saved.items[0].sizeCode, 'M');
    assert.equal(saved.items[1].sizeCode, null);
    assert.equal(saved.items[2].catalogItem.attributes.color, 'black');
    assert.equal(saved.items[2].catalogItem.selectedOptions[0].value, 'CARZO');
    assert.equal(state.notificationPayload.total, 3639);
    assert.deepEqual(state.notificationPayload.items[1].configuration, ['Дизайн 4.0', 'Логотип: Audi']);
    assert.deepEqual(state.notificationPayload.items[2].configuration, ['Чорний', 'Вишивка: CARZO']);
    state.telegram.resolve();
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(state.crmPayload.lines[2].catalogItem.sku, 'SYNTHETIC-PILLOW-BLACK');
    assert.equal(state.crmPayload.quantityDiscount, 500);
    state.crm.resolve();
    await state.tasks[0];
    state.existing = { id: 'synthetic-id', orderNumber: 'CZ-SYNTHETIC', total: 3639, requestFingerprint: saved.requestFingerprint };
    assert.equal((await createOrder(input)).replayed, true);
    assert.equal(state.writes.length, 1);
    assert.equal(state.notify, 1);
    assert.equal(state.crmCalls, 1);
    const mismatch = await createOrder({ ...input, items: [item, capeItem(), { ...pillowItem(), personalization: { embroidery: 'CHANGED' } }] });
    assert.equal(mismatch.code, 'ATTEMPT_REUSED');
    process.env.ORDER_STORE = 'directus';
    assert.equal((await createOrder(input)).code, 'UNAVAILABLE', 'unsupported writer cannot discard product metadata');
    assert.equal(state.writes.length, 1);
  } finally {
    restore(); globalThis.fetch = originalFetch;
    for (const key of keys) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; }
  }
});
