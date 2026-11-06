import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isKeyCrmSyncEnabled, parseStatusIdList, readKeyCrmConfig } from '../lib/keycrm/config';
import { syncKeyCrmOrder } from '../lib/keycrm/sync';
import type { KeyCrmOrderInput } from '../lib/keycrm/types';

const FULL_ENV = {
  KEYCRM_API_KEY: 'test-key',
  KEYCRM_SOURCE_ID: '6',
  KEYCRM_DELIVERY_SERVICE_ID: '1',
  KEYCRM_CUSTOM_FIELD_CONTACT_METHOD_UUID: 'OR_1007',
  KEYCRM_LOYALTY_STATUS_IDS: '21,12',
  KEYCRM_WEBHOOK_SECRET: 'wh-secret',
  KEYCRM_SYNC_ENABLED: 'true',
} as unknown as NodeJS.ProcessEnv;

const ORDER: KeyCrmOrderInput = {
  orderNumber: 'CZ-20261106-SYNC01',
  customerName: 'Тест',
  customerPhone: '+380931234567',
  customerComment: null,
  contactMethod: 'phone',
  deliveryMethod: 'BRANCH',
  deliveryCityName: 'Київ',
  deliveryPointRef: 'ref-1',
  deliveryPointNumber: '1',
  deliveryPointName: 'Відділення №1',
  deliveryPointAddress: 'вул. Тестова, 1',
  subtotal: 2249,
  quantityDiscount: 0,
  loyaltyDiscountAmount: 0,
  total: 2249,
  lines: [{
    sizeCode: 'M',
    designSlug: '4-0',
    brandSlug: 'none',
    brandName: 'Без логотипа',
    fixationKey: 'none',
    fixationLabel: 'без фіксації',
    quantity: 1,
    unitPrice: 2249,
    basePrice: 2249,
    logoExtra: 0,
    fixationExtra: 0,
  }],
};

describe('keyCRM checkout sync gate', () => {
  it('disables sync when the flag is off (default)', () => {
    const env = { ...FULL_ENV, KEYCRM_SYNC_ENABLED: 'false' } as unknown as NodeJS.ProcessEnv;
    assert.equal(isKeyCrmSyncEnabled(env), false);
    assert.equal(isKeyCrmSyncEnabled({} as unknown as NodeJS.ProcessEnv), false);
  });

  it('disables sync when the config is incomplete', () => {
    const noSource = { ...FULL_ENV, KEYCRM_SOURCE_ID: '' } as unknown as NodeJS.ProcessEnv;
    assert.equal(isKeyCrmSyncEnabled(noSource), false);
  });

  it('never calls the API while disabled', async () => {
    let called = 0;
    const result = await syncKeyCrmOrder(ORDER, {
      env: { ...FULL_ENV, KEYCRM_SYNC_ENABLED: 'false' } as unknown as NodeJS.ProcessEnv,
      apiKey: 'test-key',
      fetchImpl: (async () => {
        called += 1;
        return new Response('{}', { status: 201 });
      }) as typeof fetch,
    });
    assert.equal(result, 'disabled');
    assert.equal(called, 0);
  });

  it('sends the built payload when enabled', async () => {
    let body = '';
    const result = await syncKeyCrmOrder(ORDER, {
      env: FULL_ENV,
      apiKey: 'test-key',
      fetchImpl: (async (_url: string, init: RequestInit) => {
        body = String(init.body);
        return new Response(JSON.stringify({ id: 1 }), { status: 201 });
      }) as typeof fetch,
    });
    assert.equal(result, 'sent');
    assert.match(body, /"source_id":6/);
    assert.match(body, /"source_uuid":"CZ-20261106-SYNC01"/);
  });

  it('reads the owner-provided config values', () => {
    const config = readKeyCrmConfig(FULL_ENV);
    assert.equal(config.sourceId, 6);
    assert.equal(config.deliveryServiceId, 1);
    assert.equal(config.contactMethodFieldUuid, 'OR_1007');
    assert.deepEqual(config.loyaltyStatusIds, [21, 12]);
    assert.equal(config.syncEnabled, true);
  });

  it('parses loyalty status id lists safely', () => {
    assert.deepEqual(parseStatusIdList('21,12'), [21, 12]);
    assert.deepEqual(parseStatusIdList('21, 12'), [21, 12]);
    assert.deepEqual(parseStatusIdList('21;12'), [21, 12]);
    assert.deepEqual(parseStatusIdList('21,12,21'), [21, 12]);
    assert.deepEqual(parseStatusIdList('21,abc,12,-5,0,3.5'), [21, 12]);
    assert.deepEqual(parseStatusIdList(''), []);
    assert.deepEqual(parseStatusIdList(undefined), []);
    assert.deepEqual(parseStatusIdList('abc'), []);
  });
});
