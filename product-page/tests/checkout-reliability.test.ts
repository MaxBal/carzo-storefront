import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  runPostOrderSideEffects,
  safeErrorDetail,
} from '../lib/cart/checkout-reliability';

describe('post-order side effects (transaction boundary)', () => {
  it('returns success path when notify throws after order write', async () => {
    const logs: Array<{ message: string; detail: string }> = [];
    let upsertCalls = 0;

    await runPostOrderSideEffects({
      notify: async () => {
        throw new Error('telegram down');
      },
      upsertCustomer: async () => {
        upsertCalls += 1;
      },
      logError: (message, detail) => {
        logs.push({ message, detail });
      },
    });

    assert.equal(upsertCalls, 1);
    assert.equal(logs.length, 1);
    assert.match(logs[0].message, /notification failed after successful order write/i);
    assert.equal(logs[0].detail, 'telegram down');
  });

  it('returns success path when customer upsert throws after order write', async () => {
    const logs: Array<{ message: string; detail: string }> = [];
    let notifyCalls = 0;

    await runPostOrderSideEffects({
      notify: async () => {
        notifyCalls += 1;
      },
      upsertCustomer: async () => {
        throw new Error('supabase write failed');
      },
      logError: (message, detail) => {
        logs.push({ message, detail });
      },
    });

    assert.equal(notifyCalls, 1);
    assert.equal(logs.length, 1);
    assert.match(logs[0].message, /upsert failed after successful order write/i);
  });

  it('does not throw when both follow-ups fail', async () => {
    const logs: string[] = [];
    await runPostOrderSideEffects({
      notify: async () => {
        throw new Error('notify boom');
      },
      upsertCustomer: async () => {
        throw new Error('upsert boom');
      },
      logError: (message) => {
        logs.push(message);
      },
    });
    assert.equal(logs.length, 2);
  });

  it('runs notify then upsert once each on success', async () => {
    const order: string[] = [];
    await runPostOrderSideEffects({
      notify: async () => {
        order.push('notify');
      },
      upsertCustomer: async () => {
        order.push('upsert');
      },
      logError: () => {
        order.push('log');
      },
    });
    assert.deepEqual(order, ['notify', 'upsert']);
  });

  it('does not invoke follow-ups when order write is the failing step', async () => {
    const spies = { notify: 0, upsert: 0 };
    const writeOrder = async () => {
      throw new Error('Directus order create failed: HTTP 500');
    };

    let result: 'ok' | 'FAILED' = 'ok';
    try {
      await writeOrder();
      await runPostOrderSideEffects({
        notify: async () => {
          spies.notify += 1;
        },
        upsertCustomer: async () => {
          spies.upsert += 1;
        },
        logError: () => {},
      });
    } catch {
      result = 'FAILED';
    }

    assert.equal(result, 'FAILED');
    assert.deepEqual(spies, { notify: 0, upsert: 0 });
  });

  it('never lets a post-write failure become a checkout failure', async () => {
    const writeOrder = async () => 'CZ-TEST';
    const notify = async () => {
      throw new Error('settings unavailable');
    };
    const upsert = async () => {
      throw new Error('store unavailable');
    };

    let result: { ok: true; orderNumber: string } | { ok: false } | null = null;
    try {
      const orderNumber = await writeOrder();
      await runPostOrderSideEffects({
        notify,
        upsertCustomer: upsert,
        logError: () => {},
      });
      result = { ok: true, orderNumber };
    } catch {
      result = { ok: false };
    }

    assert.deepEqual(result, { ok: true, orderNumber: 'CZ-TEST' });
  });
});

describe('safeErrorDetail', () => {
  it('truncates long messages', () => {
    const detail = safeErrorDetail(new Error('x'.repeat(500)));
    assert.equal(detail.length, 200);
  });

  it('handles non-Error values', () => {
    assert.equal(safeErrorDetail('plain'), 'unknown error');
    assert.equal(safeErrorDetail(null), 'unknown error');
  });

  it('strips control characters', () => {
    const detail = safeErrorDetail(new Error('bad\u0000log\u001binjection'));
    for (const ch of detail) {
      const code = ch.charCodeAt(0);
      assert.ok(code >= 32 && code !== 127);
    }
  });
});
