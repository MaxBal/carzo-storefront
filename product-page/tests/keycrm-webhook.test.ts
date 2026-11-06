import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  handleKeyCrmOrderStatusWebhook,
  type KeyCrmWebhookDeps,
  type KeyCrmWebhookOrder,
} from '../lib/keycrm/webhook';

const ENV = {
  KEYCRM_WEBHOOK_SECRET: 'wh-secret',
  KEYCRM_COMPLETED_STATUS_ID: '12',
} as unknown as NodeJS.ProcessEnv;

function orderEvent(overrides: Record<string, unknown> = {}) {
  return {
    event: 'order.change_order_status',
    context: { id: 67526, status_id: 12, source_id: 6, ...overrides },
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
      status_id: 12,
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

describe('keyCRM completed-order webhook', () => {
  it('refuses to touch customers when config is missing', async () => {
    for (const env of [{}, { KEYCRM_WEBHOOK_SECRET: 'wh-secret' }, { KEYCRM_COMPLETED_STATUS_ID: '12' }] as unknown as NodeJS.ProcessEnv[]) {
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

  it('skips other events and non-completed statuses without changes', async () => {
    const spy = deps();
    const wrongEvent = await handleKeyCrmOrderStatusWebhook(
      { event: 'order.change_payment_status', context: { id: 1, status_id: 12 } },
      'wh-secret',
      spy,
    );
    assert.equal(wrongEvent.body.skipped, 'event');
    const wrongStatus = await handleKeyCrmOrderStatusWebhook(orderEvent({ status_id: 1 }), 'wh-secret', spy);
    assert.equal(wrongStatus.body.skipped, 'status');
    assert.equal(spy.upserted.length, 0);
  });

  it('adds the customer after re-checking the live order status', async () => {
    const spy = deps();
    const result = await handleKeyCrmOrderStatusWebhook(orderEvent(), 'wh-secret', spy);
    assert.deepEqual(result, { status: 200, body: { ok: true } });
    assert.equal(spy.upserted.length, 1);
    assert.equal(spy.upserted[0].phone, '+380931234567');
    assert.equal(spy.upserted[0].source, 'keycrm');
    assert.equal(spy.upserted[0].imported, false);
  });

  it('skips when the live order is not in the completed status', async () => {
    const spy = deps({
      getOrder: async (orderId) => ({ id: orderId, status_id: 9, buyer: { phone: '+380931234567' } }),
    });
    const result = await handleKeyCrmOrderStatusWebhook(orderEvent(), 'wh-secret', spy);
    assert.equal(result.body.skipped, 'status_mismatch');
    assert.equal(spy.upserted.length, 0);
  });

  it('skips on missing/invalid phone without retry storm', async () => {
    const spy = deps({
      getOrder: async (orderId) => ({ id: orderId, status_id: 12, buyer: { phone: '123' } }),
    });
    const result = await handleKeyCrmOrderStatusWebhook(orderEvent(), 'wh-secret', spy);
    assert.equal(result.status, 200);
    assert.equal(result.body.skipped, 'phone');
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
    const result = await handleKeyCrmOrderStatusWebhook(orderEvent({ source_id: 2 }), 'wh-secret', spy);
    assert.equal(result.body.ok, true);
    assert.equal(spy.upserted[0].source, 'keycrm');
    assert.equal(spy.upserted[0].phone, '+380661112233');
  });

  it('returns 500 so keyCRM retries when upsert fails, and stays idempotent on success', async () => {
    let fail = true;
    const upserted: string[] = [];
    const spy = deps({
      upsertCustomer: async (input) => {
        if (fail) throw new Error('db down');
        upserted.push(input.phone);
        return null;
      },
    });
    const first = await handleKeyCrmOrderStatusWebhook(orderEvent(), 'wh-secret', spy);
    assert.equal(first.status, 500);
    fail = false;
    const second = await handleKeyCrmOrderStatusWebhook(orderEvent(), 'wh-secret', spy);
    const third = await handleKeyCrmOrderStatusWebhook(orderEvent(), 'wh-secret', spy);
    assert.equal(second.status, 200);
    assert.equal(third.status, 200);
    // Repeat delivery of the same event must not throw or create errors;
    // uniqueness of customers.phone makes the upsert a no-op.
    assert.equal(upserted.length, 2);
  });

  it('rejects malformed bodies and order ids', async () => {
    const bad = await handleKeyCrmOrderStatusWebhook(null, 'wh-secret', deps());
    assert.equal(bad.status, 400);
    const badId = await handleKeyCrmOrderStatusWebhook(orderEvent({ id: 'x' }), 'wh-secret', deps());
    assert.equal(badId.status, 400);
  });
});
