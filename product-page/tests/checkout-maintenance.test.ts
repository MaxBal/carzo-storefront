import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CHECKOUT_MAINTENANCE_MESSAGE,
  QUOTE_MAINTENANCE_MESSAGE,
  isCheckoutMaintenance,
} from '../lib/checkout-maintenance';

const env = (values: Record<string, string>) => values as NodeJS.ProcessEnv;

describe('checkout maintenance flag', () => {
  it('enabled for 1 / true / on (any case, trimmed)', () => {
    for (const value of ['1', 'true', 'on', 'TRUE', 'On', ' 1 ']) {
      assert.equal(isCheckoutMaintenance(env({ CHECKOUT_MAINTENANCE: value })), true, value);
    }
  });

  it('disabled when unset, empty, or any other value', () => {
    for (const value of ['', '  ', '0', 'false', 'off', 'yes', '2']) {
      assert.equal(isCheckoutMaintenance(env({ CHECKOUT_MAINTENANCE: value })), false, value);
    }
    assert.equal(isCheckoutMaintenance(env({})), false);
    assert.equal(isCheckoutMaintenance(), false);
  });

  it('customer messages are distinct and non-empty', () => {
    assert.ok(CHECKOUT_MAINTENANCE_MESSAGE.length > 20);
    assert.ok(QUOTE_MAINTENANCE_MESSAGE.length > 20);
    assert.notEqual(CHECKOUT_MAINTENANCE_MESSAGE, QUOTE_MAINTENANCE_MESSAGE);
    assert.ok(CHECKOUT_MAINTENANCE_MESSAGE.includes('Оформлення'));
  });
});
