import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createCheckoutAttemptTracker, CHECKOUT_ATTEMPT_TTL_MS, computeCartItemsSignature } from '../lib/cart/checkout-attempt-client';
import { evaluateAttemptProbe } from '../lib/cart/checkout-attempt';

function memory() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); } };
}
const sig = computeCartItemsSignature([{ size: 'M', designSlug: '2-0', brandId: 'none', fixation: 'both', quantity: 1 }]);

it('lost response, reload, changed address, conflict, click again never creates a second order', () => {
  const storage = memory();
  const first = createCheckoutAttemptTracker({ storage });
  const id = first.beginSubmit(sig).attemptId;
  const orders = new Map([[id, { orderNumber: 'CZ-SYNTHETIC', total: 100, requestFingerprint: 'address-A' }]]);
  first.resolveOutcome({ ok: false, code: 'FAILED' }, sig);
  const reloaded = createCheckoutAttemptTracker({ storage });
  const retry = reloaded.beginSubmit(sig);
  const decision = evaluateAttemptProbe(orders.get(retry.attemptId) ?? null, 'address-B');
  assert.equal(decision.action, 'conflict');
  reloaded.resolveOutcome({ ok: false, code: 'ATTEMPT_REUSED' }, sig);
  const next = reloaded.beginSubmit(sig);
  if (next.allowed && !orders.has(next.attemptId)) {
    orders.set(next.attemptId, { orderNumber: 'CZ-DUPLICATE', total: 100, requestFingerprint: 'address-B' });
  }
  assert.equal(orders.size, 1);
  assert.equal(next.allowed, false);
  assert.equal(next.attemptId, id);
  const again = createCheckoutAttemptTracker({ storage });
  assert.equal(again.beginSubmit(sig).allowed, false, 'conflict survives reload');
});

it('unresolved attempt survives TTL, transient rejection and storage clearing in the current tab', () => {
  const storage = memory();
  let now = 1000;
  const t = createCheckoutAttemptTracker({ storage, now: () => now });
  const id = t.beginSubmit(sig).attemptId;
  t.resolveOutcome({ ok: false, code: 'FAILED' }, sig);
  now += CHECKOUT_ATTEMPT_TTL_MS + 1;
  const reload = createCheckoutAttemptTracker({ storage, now: () => now });
  assert.equal(reload.getAttemptId(sig), id);
  reload.beginSubmit(sig);
  reload.resolveOutcome({ ok: false, code: 'MAINTENANCE' }, sig);
  reload.onCartChanged(sig + '|changed');
  assert.equal(reload.getAttemptId(sig), id);
  storage.removeItem('carzo:checkout-attempt:v1');
  reload.hydrate(sig);
  assert.equal(reload.getAttemptId(sig), id);
});

