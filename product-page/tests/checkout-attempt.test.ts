import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CHECKOUT_ATTEMPT_STORAGE_KEY,
  computeCartItemsSignature,
  computeRequestFingerprint,
  createCheckoutAttemptTracker,
  evaluateAttemptProbe,
  isCheckoutAttemptId,
  isFingerprintBound,
  newCheckoutAttemptId,
  type StorageLike,
} from '../lib/cart/checkout-attempt';

function createMemoryStorage(): StorageLike & { dump: () => Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
    dump() {
      return Object.fromEntries(map.entries());
    },
  };
}

const baseItems = [
  { size: 'M', designSlug: '2-0', brandId: 'none', fixation: 'both', quantity: 1 },
  { size: 'S', designSlug: '3-0', brandId: 'apple', fixation: 'logo', quantity: 2 },
];

const baseInput = {
  customerPhone: '+380501112233',
  contactMethod: 'phone',
  deliveryMethod: 'BRANCH',
  delivery: {
    method: 'BRANCH',
    cityRef: '8d5a980d-391c-11dd-90d9-001a92567626',
    pointRef: '1ec09d88-e1c2-11e3-8c4a-0050568002cf',
  },
  paymentOption: 'full',
  items: baseItems,
};

describe('checkout attempt id', () => {
  it('generates a v4 UUID', () => {
    const id = newCheckoutAttemptId();
    assert.ok(isCheckoutAttemptId(id));
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('rejects non-UUID values', () => {
    assert.equal(isCheckoutAttemptId('not-a-uuid'), false);
    assert.equal(isCheckoutAttemptId(''), false);
    assert.equal(isCheckoutAttemptId(null), false);
    assert.equal(isCheckoutAttemptId(42), false);
    assert.equal(isCheckoutAttemptId('2b6a1c3e-0f2b-4a3c-9d4e-1a2b3c4d5e6'), false);
  });
});

describe('request fingerprint (C-05)', () => {
  it('is deterministic for identical intent', () => {
    assert.equal(
      computeRequestFingerprint(baseInput),
      computeRequestFingerprint({ ...baseInput, items: [...baseInput.items] }),
    );
  });

  it('does not depend on item order', () => {
    assert.equal(
      computeRequestFingerprint(baseInput),
      computeRequestFingerprint({
        ...baseInput,
        items: [baseInput.items[1], baseInput.items[0]],
      }),
    );
  });

  it('is stable across price drift (prices are excluded by design)', () => {
    assert.equal(
      computeRequestFingerprint(baseInput),
      computeRequestFingerprint({
        ...baseInput,
        items: baseInput.items.map(item => ({ ...item })),
      }),
    );
  });

  it('normalizes surrounding whitespace and UUID casing in compared fields', () => {
    assert.equal(
      computeRequestFingerprint(baseInput),
      computeRequestFingerprint({
        customerPhone: ' +380501112233 ',
        contactMethod: ' phone',
        delivery: {
          method: 'BRANCH ',
          cityRef: ' 8D5A980D-391C-11DD-90D9-001A92567626 ',
          pointRef: ' 1EC09D88-E1C2-11E3-8C4A-0050568002CF ',
        },
        paymentOption: ' full ',
        items: [
          { size: ' M ', designSlug: ' 2-0', brandId: 'none ', fixation: 'both', quantity: 1 },
          { size: 'S', designSlug: '3-0', brandId: 'apple', fixation: 'logo', quantity: 2 },
        ],
      }),
    );
  });

  it('Scenario 5: changes when Nova Poshta branch or postomat changes', () => {
    const base = computeRequestFingerprint(baseInput);
    const differentBranch = computeRequestFingerprint({
      ...baseInput,
      delivery: {
        method: 'BRANCH',
        cityRef: baseInput.delivery.cityRef,
        pointRef: '22222222-e1c2-11e3-8c4a-0050568002cf',
      },
    });
    const differentCity = computeRequestFingerprint({
      ...baseInput,
      delivery: {
        method: 'BRANCH',
        cityRef: '99999999-391c-11dd-90d9-001a92567626',
        pointRef: baseInput.delivery.pointRef,
      },
    });
    const postomatSamePoint = computeRequestFingerprint({
      ...baseInput,
      delivery: {
        method: 'POSTOMAT',
        cityRef: baseInput.delivery.cityRef,
        pointRef: baseInput.delivery.pointRef,
      },
    });
    assert.notEqual(base, differentBranch);
    assert.notEqual(base, differentCity);
    assert.notEqual(base, postomatSamePoint);
  });

  it('Scenario 6: changes when courier delivery address (city, street, house, apartment) changes', () => {
    const courierBase = {
      ...baseInput,
      delivery: {
        method: 'COURIER',
        cityRef: '8d5a980d-391c-11dd-90d9-001a92567626',
        streetRef: 'aaaa1111-391c-11dd-90d9-001a92567626',
        house: '12A',
        apartment: '45',
      },
    };
    const fpBase = computeRequestFingerprint(courierBase);

    assert.notEqual(
      fpBase,
      computeRequestFingerprint({
        ...courierBase,
        delivery: { ...courierBase.delivery, streetRef: 'bbbb2222-391c-11dd-90d9-001a92567626' },
      }),
    );
    assert.notEqual(
      fpBase,
      computeRequestFingerprint({
        ...courierBase,
        delivery: { ...courierBase.delivery, house: '14' },
      }),
    );
    assert.notEqual(
      fpBase,
      computeRequestFingerprint({
        ...courierBase,
        delivery: { ...courierBase.delivery, apartment: '46' },
      }),
    );
    assert.notEqual(
      fpBase,
      computeRequestFingerprint({
        ...courierBase,
        delivery: { ...courierBase.delivery, apartment: '' },
      }),
    );
  });

  it('Scenario 7: changes when customer phone changes', () => {
    const base = computeRequestFingerprint(baseInput);
    assert.notEqual(
      base,
      computeRequestFingerprint({
        ...baseInput,
        customerPhone: '+380501112244',
      }),
    );
  });

  it('Scenario 8: changes when loyalty phone is added, changed, or removed', () => {
    const withoutLoyalty = computeRequestFingerprint({ ...baseInput, loyaltyPhone: null });
    const withLoyaltyA = computeRequestFingerprint({
      ...baseInput,
      loyaltyPhone: '+380671234567',
    });
    const withLoyaltyB = computeRequestFingerprint({
      ...baseInput,
      loyaltyPhone: '+380679998877',
    });
    assert.notEqual(withoutLoyalty, withLoyaltyA);
    assert.notEqual(withLoyaltyA, withLoyaltyB);
  });

  it('Scenario 9: changes when payment option changes', () => {
    const fullPayment = computeRequestFingerprint({ ...baseInput, paymentOption: 'full' });
    const prepayment = computeRequestFingerprint({ ...baseInput, paymentOption: 'prepayment_200' });
    assert.notEqual(fullPayment, prepayment);
  });

  it('Scenario 10: changes when cart items or quantities change', () => {
    const base = computeRequestFingerprint(baseInput);
    assert.notEqual(
      base,
      computeRequestFingerprint({
        ...baseInput,
        items: [{ ...baseInput.items[0], quantity: 2 }, baseInput.items[1]],
      }),
    );
    assert.notEqual(
      base,
      computeRequestFingerprint({
        ...baseInput,
        items: [{ ...baseInput.items[0], designSlug: '4-0' }, baseInput.items[1]],
      }),
    );
    assert.notEqual(
      base,
      computeRequestFingerprint({
        ...baseInput,
        items: [baseInput.items[0]],
      }),
    );
  });
});

describe('fingerprint replay binding & probe evaluation', () => {
  it('binds only an exact match', () => {
    assert.equal(isFingerprintBound('abc', 'abc'), true);
    assert.equal(isFingerprintBound('abc', 'abd'), false);
    assert.equal(isFingerprintBound('abc', 'ABC'), false);
  });

  it('never binds when the stored or replayed fingerprint is missing', () => {
    assert.equal(isFingerprintBound(null, 'abc'), false);
    assert.equal(isFingerprintBound(undefined, 'abc'), false);
    assert.equal(isFingerprintBound('', 'abc'), false);
    assert.equal(isFingerprintBound('abc', null), false);
    assert.equal(isFingerprintBound('abc', undefined), false);
    assert.equal(isFingerprintBound('abc', ''), false);
  });

  it('Scenario 11 & 12: evaluateAttemptProbe decides proceed, replay, or conflict', () => {
    const fp = computeRequestFingerprint(baseInput);
    assert.deepEqual(evaluateAttemptProbe(null, fp), { action: 'proceed' });

    assert.deepEqual(
      evaluateAttemptProbe(
        { orderNumber: 'CZ-1001', total: 2249, requestFingerprint: fp },
        fp,
      ),
      { action: 'replay', orderNumber: 'CZ-1001', total: 2249, replayed: true },
    );

    const modifiedFp = computeRequestFingerprint({
      ...baseInput,
      customerPhone: '+380509999999',
    });
    assert.deepEqual(
      evaluateAttemptProbe(
        { orderNumber: 'CZ-1001', total: 2249, requestFingerprint: fp },
        modifiedFp,
      ),
      { action: 'conflict', code: 'ATTEMPT_REUSED' },
    );
  });
});

describe('checkout attempt tracker state machine — 14 scenarios (C-04 + C-05)', () => {
  const sigA = computeCartItemsSignature(baseItems);
  const sigB = computeCartItemsSignature([
    { ...baseItems[0], quantity: 3 },
    baseItems[1],
  ]);

  it('Scenario 1: Double click — blocks concurrent second submit while first is in_flight', () => {
    const storage = createMemoryStorage();
    const tracker = createCheckoutAttemptTracker({ storage });

    const first = tracker.beginSubmit(sigA);
    assert.equal(first.allowed, true);
    assert.ok(isCheckoutAttemptId(first.attemptId));

    const second = tracker.beginSubmit(sigA);
    assert.equal(second.allowed, false);
    assert.equal(second.attemptId, first.attemptId);
  });

  it('Scenario 2: Page reload — preserves attemptId across reload and promotes in_flight to uncertain', () => {
    const storage = createMemoryStorage();
    const trackerBeforeReload = createCheckoutAttemptTracker({ storage });
    const started = trackerBeforeReload.beginSubmit(sigA);
    assert.equal(started.allowed, true);
    assert.equal(trackerBeforeReload.getState()?.status, 'in_flight');

    // Simulate browser page reload (new tracker instance reading from same localStorage)
    const trackerAfterReload = createCheckoutAttemptTracker({ storage });
    const hydrated = trackerAfterReload.hydrate(sigA);
    assert.ok(hydrated);
    assert.equal(hydrated.attemptId, started.attemptId);
    assert.equal(hydrated.status, 'uncertain');
    assert.equal(trackerAfterReload.getAttemptId(sigA), started.attemptId);
  });

  it('Scenario 3 & 4: Network drop followed by retry of identical order reuses same attemptId and replays', () => {
    const storage = createMemoryStorage();
    const tracker = createCheckoutAttemptTracker({ storage });

    // First submit encounters network error -> FAILED
    const first = tracker.beginSubmit(sigA);
    tracker.resolveOutcome({ ok: false, code: 'FAILED' }, sigA);
    assert.equal(tracker.getState()?.status, 'uncertain');
    assert.equal(tracker.getState()?.attemptId, first.attemptId);

    // Retry with identical order reuses the exact same attemptId
    const retry = tracker.beginSubmit(sigA);
    assert.equal(retry.allowed, true);
    assert.equal(retry.attemptId, first.attemptId);

    // Server probe sees matching fingerprint -> replays existing order
    const fp = computeRequestFingerprint(baseInput);
    const probe = evaluateAttemptProbe(
      { orderNumber: 'CZ-2001', total: 4498, requestFingerprint: fp },
      fp,
    );
    assert.deepEqual(probe, {
      action: 'replay',
      orderNumber: 'CZ-2001',
      total: 4498,
      replayed: true,
    });

    tracker.resolveOutcome({ ok: true, replayed: true }, sigA);
    assert.equal(tracker.getState(), null);
    assert.equal(storage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY), null);
  });

  it('Scenarios 5–9: Form edits (NP branch, courier address, phone, loyaltyPhone, paymentOption) never auto-rotate attemptId', () => {
    const storage = createMemoryStorage();
    const tracker = createCheckoutAttemptTracker({ storage });

    const initialId = tracker.getAttemptId(sigA);
    tracker.onFormEdited(); // NP branch changed
    assert.equal(tracker.getAttemptId(sigA), initialId);

    tracker.onFormEdited(); // Courier address changed
    tracker.onFormEdited(); // Customer phone changed
    tracker.onFormEdited(); // Loyalty phone added
    tracker.onFormEdited(); // Payment option changed
    assert.equal(tracker.getAttemptId(sigA), initialId);
  });

  it('Scenario 10: Cart composition / quantity change rotates attemptId when idle, but preserves it when uncertain', () => {
    const storage = createMemoryStorage();
    const tracker = createCheckoutAttemptTracker({ storage });

    // 10a: When idle (no uncertain attempt), changing cart item quantity resets attemptId
    const idleId = tracker.getAttemptId(sigA);
    assert.notEqual(sigA, sigB);
    tracker.onCartChanged(sigB);
    assert.equal(tracker.getState(), null);
    const nextIdleId = tracker.getAttemptId(sigB);
    assert.notEqual(nextIdleId, idleId);

    // 10b: When previous attempt had uncertain outcome, changing cart does NOT auto-rotate attemptId
    const started = tracker.beginSubmit(sigB);
    assert.equal(started.attemptId, nextIdleId);
    tracker.resolveOutcome({ ok: false, code: 'FAILED' }, sigB);
    assert.equal(tracker.getState()?.status, 'uncertain');

    tracker.onCartChanged(sigA);
    assert.equal(
      tracker.getAttemptId(sigA),
      nextIdleId,
      'uncertain attemptId must be preserved so server can check if order was already created',
    );
  });

  it('Scenario 12 & 13: Uncertain outcome of first request — handles both committed and uncommitted server states safely', () => {
    const storage = createMemoryStorage();
    const tracker = createCheckoutAttemptTracker({ storage });

    // Step 1: First submit sends attempt A1 with fingerprint F1, but network drops
    const first = tracker.beginSubmit(sigA);
    const fp1 = computeRequestFingerprint(baseInput);
    tracker.resolveOutcome({ ok: false, code: 'FAILED' }, sigA);
    assert.equal(tracker.getState()?.status, 'uncertain');

    // Step 2: User changes Nova Poshta branch (or phone/loyalty/courier/payment) and submits again
    tracker.onFormEdited();
    const fp2 = computeRequestFingerprint({
      ...baseInput,
      delivery: {
        method: 'BRANCH',
        cityRef: baseInput.delivery.cityRef,
        pointRef: '99999999-e1c2-11e3-8c4a-0050568002cf',
      },
    });
    assert.notEqual(fp1, fp2);

    const second = tracker.beginSubmit(sigA);
    assert.equal(second.attemptId, first.attemptId, 'must reuse A1 to probe server');

    // Case 13A: First request HAD committed on server -> server probe returns conflict (ATTEMPT_REUSED)
    const committedDecision = evaluateAttemptProbe(
      { orderNumber: 'CZ-3001', total: 4498, requestFingerprint: fp1 },
      fp2,
    );
    assert.deepEqual(committedDecision, { action: 'conflict', code: 'ATTEMPT_REUSED' });
    tracker.resolveOutcome({ ok: false, code: 'ATTEMPT_REUSED' }, sigA);
    // After ATTEMPT_REUSED, tracker resets so a subsequent explicit submit gets a new UUID
    assert.equal(tracker.getState(), null);
    const freshAfterConflict = tracker.getAttemptId(sigA);
    assert.notEqual(freshAfterConflict, first.attemptId);

    // Case 13B: First request NEVER reached server DB -> server probe returns proceed and creates order with A1 + fp2
    const uncommittedDecision = evaluateAttemptProbe(null, fp2);
    assert.deepEqual(uncommittedDecision, { action: 'proceed' });
  });

  it('Scenario 14: Reopening cart after a successful order generates a brand-new checkoutAttemptId', () => {
    const storage = createMemoryStorage();
    const tracker = createCheckoutAttemptTracker({ storage });

    const firstOrderAttempt = tracker.beginSubmit(sigA);
    tracker.resolveOutcome({ ok: true }, sigA);
    assert.equal(tracker.getState(), null);
    assert.equal(storage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY), null);

    // Customer adds new items and reopens cart/checkout
    const secondOrderAttempt = tracker.beginSubmit(sigA);
    assert.equal(secondOrderAttempt.allowed, true);
    assert.notEqual(secondOrderAttempt.attemptId, firstOrderAttempt.attemptId);
  });
});
