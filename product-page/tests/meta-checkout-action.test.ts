import assert from 'node:assert/strict';
import { it } from 'node:test';
import { metaEnv } from './fixtures/meta';

it('checkout returns the durable receipt before Meta delivery, reuses it on replay and respects denial', { timeout: 5000 }, async () => {
  const Module = require('node:module');
  const installed = require('./helpers/checkout-action-mocks.cjs').install();
  const { state, item } = installed;
  const previousLoad = Module._load;
  const env = { ...process.env };
  const originalFetch = globalThis.fetch;
  let release: () => void = () => {};
  const waiting = new Promise<void>(resolve => { release = resolve; });
  let deliveries = 0;
  let denied = false;
  let receiptUnavailable = false;
  let receipt: unknown[] = [];
  Module._load = function (request: string, ...args: unknown[]) {
    if (request === 'next/headers') return { headers: () => new Headers({
      origin: 'https://carzo.test', referer: 'https://carzo.test/case/design/m/4-0?private=excluded',
      'user-agent': 'Synthetic browser', 'x-forwarded-for': '192.0.2.1',
      cookie: `carzo_marketing_v1=${denied ? 'denied' : 'granted'}; carzo_marketing_id=90000000-0000-4000-8000-000000000001`,
    }) };
    if (request === '@/lib/meta/delivery') return { deliverMetaEvents: async () => {
      assert.equal(state.writes.length, 1, 'Meta cannot run before the order commit');
      deliveries++; await waiting; throw new Error('synthetic Meta outage');
    } };
    if (request === '@/lib/meta/repository') return { loadMetaBrowserPurchases: async () => receiptUnavailable ? [] : receipt };
    const result = previousLoad.call(this, request, ...args);
    if (request === '@/lib/data/orders') return { ...result, createOrderRecord: async (snapshot: any) => {
      const stored = await result.createOrderRecord(snapshot);
      receipt = (snapshot.meta?.events ?? []).map((event: any) => ({ pixelId: event.pixel_id, name: 'Purchase',
        eventId: 'purchase:70000000-0000-4000-8000-000000000001:carzo', data: event.custom_data }));
      return { ...stored, ...(receipt.length ? { metaEvents: receipt } : {}) };
    } };
    return result;
  };
  globalThis.fetch = async () => { throw new Error('unexpected external request'); };
  try {
    Object.assign(process.env, metaEnv(), { VERCEL: '1', ORDER_STORE: 'supabase' });
    delete process.env.CHECKOUT_MAINTENANCE;
    const { createOrder } = require('../app/actions/checkout');
    const input = {
      items: [item], expectedTotal: 2249, expectedBaseTotal: 2249,
      customerName: 'Synthetic buyer', customerPhone: '+380000000000', contactMethod: 'phone',
      delivery: { method: 'BRANCH', cityRef: '11111111-1111-4111-8111-111111111111', pointRef: '22222222-2222-4222-8222-222222222222' },
      checkoutAttemptId: '33333333-3333-4333-8333-333333333333',
    };
    const saved = await createOrder(input);
    assert.equal(saved.ok, true);
    assert.equal(saved.metaEvents.length, 1);
    assert.equal(saved.metaEvents[0].data.value, 2249);
    assert.equal(deliveries, 1);
    assert.equal(state.tasks.length, 2);
    assert.equal(state.writes[0].meta.events[0].event_source_url.includes('?'), false);
    state.existing = { id: 'synthetic-id', orderNumber: 'CZ-SYNTHETIC', total: 2249, requestFingerprint: state.writes[0].requestFingerprint };
    assert.deepEqual((await createOrder(input)).metaEvents, saved.metaEvents);
    assert.equal(deliveries, 1, 'replay must not enqueue or wake a second Meta delivery');
    assert.equal(state.writes.length, 1);
    receiptUnavailable = true;
    assert.equal((await createOrder(input)).ok, true, 'advertising receipt outage cannot lose a saved order');
    denied = true;
    assert.equal((await createOrder(input)).metaEvents, undefined);
    release(); state.telegram.resolve(); state.crm.resolve();
    await Promise.all(state.tasks);
    state.existing = null;
    assert.equal((await createOrder({ ...input, checkoutAttemptId: '44444444-4444-4444-8444-444444444444' })).ok, true);
    assert.equal(state.writes[1].meta, undefined);
    assert.equal(deliveries, 1);
  } finally {
    release(); installed.restore(); globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
});
