import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  handleKeyCrmOrderStatusWebhook,
  type KeyCrmWebhookDeps,
  type KeyCrmWebhookOrder,
} from '../lib/keycrm/webhook';

const ENV = {
  KEYCRM_WEBHOOK_SECRET: 'wh-secret',
  KEYCRM_LOYALTY_STATUS_IDS: '21,12',
} as unknown as NodeJS.ProcessEnv;

function orderEvent(overrides: Record<string, unknown> = {}) {
  return {
    event: 'order.change_order_status',
    context: { id: 67526, status_id: 21, source_id: 6, ...overrides },
  };
}

type SpyDeps = KeyCrmWebhookDeps & {
  upserted: Array<{ phone: string; source: string; imported: boolean }>;
};

function deps(overrides: Partial<KeyCrmWebhookDeps> = {}): SpyDeps {
  const upserted: Array<{ phone: string; source: string; imported: boolean }> = [];
  return {
    upserted,
    getOrder: async (orderId: number): Promise<KeyCrmWebhookOrder> => ({
      id: orderId,
      status_id: 21,
      buyer: { phone: '+380 93 123 45 67', full_name: 'Приклад' },
    }),
    upsertCustomer: async (input) => {
      upserted.push({ phone: input.phone, source: input.source, imported: input.imported });
      return null;
    },
    env: ENV,
    logError: () => {},
    ...overrides,
  };
}

/** Mimics customers.phone UNIQUE: one record per phone, repeat upserts are no-ops. */
function makeFakeCustomerStore() {
  const store = new Map<string, { phone: string; source: string }>();
  return {
    store,
    upsertCustomer: async (input: { phone: string; fullName: string; source: string; imported: boolean }) => {
      if (!store.has(input.phone)) {
        store.set(input.phone, { phone: input.phone, source: input.source });
      }
      return null;
    },
  };
}

describe('keyCRM completed-order webhook (loyalty statuses)', () => {
  it('refuses to touch customers when config is missing', async () => {
    for (const env of [
      {},
      { KEYCRM_WEBHOOK_SECRET: 'wh-secret' },
      { KEYCRM_LOYALTY_STATUS_IDS: '21,12' },
      { KEYCRM_WEBHOOK_SECRET: 'wh-secret', KEYCRM_LOYALTY_STATUS_IDS: '' },
      { KEYCRM_WEBHOOK_SECRET: 'wh-secret', KEYCRM_LOYALTY_STATUS_IDS: 'abc,x' },
    ] as unknown as NodeJS.ProcessEnv[]) {
      const result = await handleKeyCrmOrderStatusWebhook(orderEvent(), 'wh-secret', deps({ env }));
      assert.equal(result.status, 503);
      assert.equal(result.body.error, 'not_configured');
    }
  });

  it('rejects a wrong or missing secret', async () => {
    const wrong = await handleKeyCrmOrderStatusWebhook(orderEvent(), 'other', deps());
    assert.equal(wrong.status, 401);
    const missing = await handleKeyCrmOrderStatusWebhook(orderEvent(), null, deps());
    assert.equal(missing.status, 401);
  });

  it('adds the customer on status 21 "Получено"', async () => {
    const spy = deps();
    const result = await handleKeyCrmOrderStatusWebhook(
      orderEvent({ status_id: 21 }),
      'wh-secret',
      spy,
    );
    assert.deepEqual(result, { status: 200, body: { ok: true } });
    assert.equal(spy.upserted.length, 1);
    assert.equal(spy.upserted[0].phone, '+380931234567');
    assert.equal(spy.upserted[0].source, 'keycrm');
    assert.equal(spy.upserted[0].imported, false);
  });

  it('adds the customer on status 12 "Выполнен"', async () => {
    const spy = deps({
      getOrder: async (orderId) => ({
        id: orderId,
        status_id: 12,
        buyer: { phone: '+380931234567', full_name: 'Менеджер завершив' },
      }),
    });
    const result = await handleKeyCrmOrderStatusWebhook(
      orderEvent({ status_id: 12 }),
      'wh-secret',
      spy,
    );
    assert.deepEqual(result, { status: 200, body: { ok: true } });
    assert.equal(spy.upserted.length, 1);
    assert.equal(spy.upserted[0].phone, '+380931234567');
  });

  it('accepts event 21 when the live order has already moved to 12', async () => {
    const spy = deps({
      getOrder: async (orderId) => ({ id: orderId, status_id: 12, buyer: { phone: '+380931234567' } }),
    });
    const result = await handleKeyCrmOrderStatusWebhook(
      orderEvent({ status_id: 21 }),
      'wh-secret',
      spy,
    );
    assert.deepEqual(result, { status: 200, body: { ok: true } });
    assert.equal(spy.upserted.length, 1);
  });

  it('accepts event 12 when the live order is still 21', async () => {
    const spy = deps({
      getOrder: async (orderId) => ({ id: orderId, status_id: 21, buyer: { phone: '+380931234567' } }),
    });
    const result = await handleKeyCrmOrderStatusWebhook(
      orderEvent({ status_id: 12 }),
      'wh-secret',
      spy,
    );
    assert.deepEqual(result, { status: 200, body: { ok: true } });
  });

  it('sequence 21 then 12 does not create a duplicate customer', async () => {
    const fake = makeFakeCustomerStore();
    const spy = deps({ upsertCustomer: fake.upsertCustomer });

    const first = await handleKeyCrmOrderStatusWebhook(orderEvent({ status_id: 21 }), 'wh-secret', spy);
    const second = await handleKeyCrmOrderStatusWebhook(orderEvent({ status_id: 12 }), 'wh-secret', spy);

    assert.equal(first.body.ok, true);
    assert.equal(second.body.ok, true);
    assert.equal(fake.store.size, 1);
    assert.ok(fake.store.has('+380931234567'));
  });

  it('does not add the customer on canceled or other statuses', async () => {
    const spy = deps();
    for (const statusId of [19, 1, 9, 20, 22, 23]) {
      const result = await handleKeyCrmOrderStatusWebhook(
        orderEvent({ status_id: statusId }),
        'wh-secret',
        spy,
      );
      assert.equal(result.status, 200);
      assert.equal(result.body.skipped, 'status');
    }
    assert.equal(spy.upserted.length, 0);
  });

  it('skips when the live order status is not loyalty-granting', async () => {
    for (const liveStatus of [19, 22, 9]) {
      const spy = deps({
        getOrder: async (orderId) => ({ id: orderId, status_id: liveStatus, buyer: { phone: '+380931234567' } }),
      });
      const result = await handleKeyCrmOrderStatusWebhook(orderEvent({ status_id: 21 }), 'wh-secret', spy);
      assert.equal(result.body.skipped, 'status_mismatch');
      assert.equal(spy.upserted.length, 0);
    }
  });

  it('keeps existing customers (unique phone, repeat webhooks are safe)', async () => {
    const fake = makeFakeCustomerStore();
    fake.store.set('+380931234567', { phone: '+380931234567', source: 'wrike' });
    const spy = deps({ upsertCustomer: fake.upsertCustomer });

    for (const statusId of [21, 12, 21]) {
      await handleKeyCrmOrderStatusWebhook(orderEvent({ status_id: statusId }), 'wh-secret', spy);
    }

    assert.equal(fake.store.size, 1);
    // Existing provenance is preserved by the customer-store merge policy.
    assert.equal(fake.store.get('+380931234567')?.source, 'wrike');
  });

  it('skips other events and malformed bodies without changes', async () => {
    const spy = deps();
    const wrongEvent = await handleKeyCrmOrderStatusWebhook(
      { event: 'order.change_payment_status', context: { id: 1, status_id: 21 } },
      'wh-secret',
      spy,
    );
    assert.equal(wrongEvent.body.skipped, 'event');
    const bad = await handleKeyCrmOrderStatusWebhook(null, 'wh-secret', spy);
    assert.equal(bad.status, 400);
    const badId = await handleKeyCrmOrderStatusWebhook(orderEvent({ id: 'x' }), 'wh-secret', spy);
    assert.equal(badId.status, 400);
    assert.equal(spy.upserted.length, 0);
  });

  it('works for any source (Rozetka/офлайн): source comes from the order, not the site', async () => {
    const spy = deps({
      getOrder: async (orderId) => ({
        id: orderId,
        status_id: 12,
        buyer: { phone: '+380661112233', full_name: 'Rozetka buyer' },
      }),
    });
    const result = await handleKeyCrmOrderStatusWebhook(orderEvent({ source_id: 2, status_id: 12 }), 'wh-secret', spy);
    assert.equal(result.body.ok, true);
    assert.equal(spy.upserted[0].source, 'keycrm');
    assert.equal(spy.upserted[0].phone, '+380661112233');
  });

  it('parses the real GET /order/{id}?include=buyer shape (extra buyer fields)', async () => {
    // Shape verified against the live API on 2026-11-06 (order 1454): buyer is a
    // full object with id/email/note/orders_count/... — only phone/full_name matter.
    const spy = deps({
      getOrder: async (orderId) => ({
        id: orderId,
        status_id: 21,
        buyer: {
          id: 1277,
          phone: '+380931234567',
          full_name: 'Приклад',
          email: null,
          note: null,
          orders_count: 3,
          orders_sum: 9000,
          discount: 0,
          has_duplicates: false,
        },
      }),
    });
    const result = await handleKeyCrmOrderStatusWebhook(orderEvent({ status_id: 21 }), 'wh-secret', spy);
    assert.deepEqual(result, { status: 200, body: { ok: true } });
    assert.equal(spy.upserted[0].phone, '+380931234567');
  });

  it('returns 500 so keyCRM retries when upsert fails', async () => {
    const spy = deps({
      upsertCustomer: async () => {
        throw new Error('db down');
      },
    });
    const result = await handleKeyCrmOrderStatusWebhook(orderEvent({ status_id: 21 }), 'wh-secret', spy);
    assert.equal(result.status, 500);
    assert.equal(result.body.error, 'upsert_failed');
  });

  it('does not add a customer when the keyCRM order fetch fails', async () => {
    const spy = deps({
      getOrder: async () => {
        throw new Error('keycrm down');
      },
    });
    const result = await handleKeyCrmOrderStatusWebhook(orderEvent({ status_id: 21 }), 'wh-secret', spy);
    assert.equal(result.status, 500);
    assert.equal(result.body.error, 'order_fetch_failed');
    assert.equal(spy.upserted.length, 0);
  });
});
