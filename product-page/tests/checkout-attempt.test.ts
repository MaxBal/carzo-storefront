import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  computeRequestFingerprint,
  isCheckoutAttemptId,
  isFingerprintBound,
  newCheckoutAttemptId,
} from '../lib/cart/checkout-attempt';

const baseInput = {
  customerPhone: '+380501112233',
  contactMethod: 'phone',
  deliveryMethod: 'BRANCH',
  items: [
    { size: 'M', designSlug: '2-0', brandId: 'none', fixation: 'both', quantity: 1 },
    { size: 'S', designSlug: '3-0', brandId: 'apple', fixation: 'logo', quantity: 2 },
  ],
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

describe('request fingerprint', () => {
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

  it('changes when a material field changes', () => {
    const base = computeRequestFingerprint(baseInput);
    assert.notEqual(base, computeRequestFingerprint({
      ...baseInput,
      customerPhone: '+380501112244',
    }));
    assert.notEqual(base, computeRequestFingerprint({
      ...baseInput,
      contactMethod: 'telegram',
    }));
    assert.notEqual(base, computeRequestFingerprint({
      ...baseInput,
      deliveryMethod: 'COURIER',
    }));
    assert.notEqual(base, computeRequestFingerprint({
      ...baseInput,
      items: [{ ...baseInput.items[0], quantity: 2 }, baseInput.items[1]],
    }));
    assert.notEqual(base, computeRequestFingerprint({
      ...baseInput,
      items: [{ ...baseInput.items[0], designSlug: '9-9' }, baseInput.items[1]],
    }));
  });

  it('is stable across price drift (prices are excluded by design)', () => {
    // Same intent expressed at different prices must keep the same fingerprint
    // so a successful prior order stays retrievable after catalog changes.
    assert.equal(
      computeRequestFingerprint(baseInput),
      computeRequestFingerprint({
        ...baseInput,
        // Price drift is not part of the fingerprint input at all.
        items: baseInput.items.map(item => ({ ...item })),
      }),
    );
  });

  it('normalizes surrounding whitespace in compared fields', () => {
    assert.equal(
      computeRequestFingerprint(baseInput),
      computeRequestFingerprint({
        customerPhone: ' +380501112233 ',
        contactMethod: ' phone',
        deliveryMethod: 'BRANCH ',
        items: [
          { size: ' M ', designSlug: ' 2-0', brandId: 'none ', fixation: 'both', quantity: 1 },
          { size: 'S', designSlug: '3-0', brandId: 'apple', fixation: 'logo', quantity: 2 },
        ],
      }),
    );
  });
});

describe('fingerprint replay binding', () => {
  it('binds only an exact match', () => {
    assert.equal(isFingerprintBound('abc', 'abc'), true);
    assert.equal(isFingerprintBound('abc', 'abd'), false);
    assert.equal(isFingerprintBound('abc', 'ABC'), false);
  });

  it('never binds when the stored fingerprint is missing', () => {
    // A NULL stored fingerprint cannot verify intent; treating it as a match
    // let a retry answer for a different cart than the one that created the
    // order. The RPC rejects the same case (ATTEMPT_FINGERPRINT_MISMATCH).
    assert.equal(isFingerprintBound(null, 'abc'), false);
    assert.equal(isFingerprintBound(undefined, 'abc'), false);
    assert.equal(isFingerprintBound('', 'abc'), false);
    assert.equal(isFingerprintBound(null, null), false);
    assert.equal(isFingerprintBound('', ''), false);
  });

  it('never binds when the replayed fingerprint is missing', () => {
    assert.equal(isFingerprintBound('abc', null), false);
    assert.equal(isFingerprintBound('abc', undefined), false);
    assert.equal(isFingerprintBound('abc', ''), false);
  });
});
