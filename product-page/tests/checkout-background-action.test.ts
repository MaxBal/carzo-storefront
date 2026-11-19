import assert from 'node:assert/strict';
import { it } from 'node:test';

it('the real checkout action acknowledges persistence before slow Telegram/keyCRM and does not reschedule replays', { timeout: 3000 }, async () => {
  const env = { VERCEL: process.env.VERCEL, ORDER_STORE: process.env.ORDER_STORE, CHECKOUT_MAINTENANCE: process.env.CHECKOUT_MAINTENANCE };
  const { state, item, restore } = require('./helpers/checkout-action-mocks.cjs').install();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('unexpected network request in isolated checkout test'); };
  try {
    process.env.VERCEL = '1';
    process.env.ORDER_STORE = 'supabase';
    delete process.env.CHECKOUT_MAINTENANCE;
    const { createOrder } = require('../app/actions/checkout');
    const input = {
      items: [item], expectedTotal: 2249, expectedBaseTotal: 2249,
      customerName: 'Synthetic buyer', customerPhone: '+380000000000', contactMethod: 'phone',
      delivery: { method: 'BRANCH', cityRef: '11111111-1111-4111-8111-111111111111', pointRef: '22222222-2222-4222-8222-222222222222' },
      checkoutAttemptId: '33333333-3333-4333-8333-333333333333',
    };
    const result = await createOrder(input);
    assert.deepEqual(result, { ok: true, orderNumber: 'CZ-SYNTHETIC', total: 2249, replayed: false });
    assert.equal(state.writes.length, 1);
    assert.equal(state.tasks.length, 1);
    assert.equal(state.notify, 1);
    assert.equal(state.crmCalls, 0);

    state.existing = { id: 'synthetic-id', orderNumber: 'CZ-SYNTHETIC', total: 2249, requestFingerprint: state.writes[0].requestFingerprint };
    const replay = await createOrder(input);
    assert.equal(replay.ok, true);
    assert.equal(replay.replayed, true);
    assert.equal(state.writes.length, 1);
    assert.equal(state.tasks.length, 1);
    assert.equal(state.notify, 1);

    state.telegram.resolve();
    await new Promise<void>(done => setImmediate(done));
    assert.equal(state.crmCalls, 1);
    state.crm.resolve();
    await state.tasks[0];

    state.existing = null;
    state.failWrite = true;
    const failed = await createOrder({ ...input, checkoutAttemptId: '44444444-4444-4444-8444-444444444444' });
    assert.equal(failed.ok, false);
    assert.equal(state.writes.length, 1);
    assert.equal(state.tasks.length, 1);
    assert.equal(state.notify, 1);
    assert.equal(state.crmCalls, 1);
  } finally {
    restore(); globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
