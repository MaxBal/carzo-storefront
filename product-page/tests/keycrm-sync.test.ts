import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isKeyCrmSyncEnabled, parseStatusIdList, readKeyCrmConfig } from '../lib/keycrm/config';
import { syncKeyCrmOrder } from '../lib/keycrm/sync';
import type { KeyCrmOrderInput, KeyCrmOrderPayload } from '../lib/keycrm/types';
import { applyPaymentOptionFallback } from '../lib/order-notifications';

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

// Regression: paymentOptionFieldUuid must travel config → syncKeyCrmOrder →
// buildKeyCrmOrder, or the keyCRM «Варіанти оплати» field (OR_1010) stays empty.
describe('keyCRM payment option through the full sync path', () => {
  const PAYMENT_ENV = {
    ...FULL_ENV,
    KEYCRM_CUSTOM_FIELD_PAYMENT_OPTION_UUID: 'OR_1010',
  } as unknown as NodeJS.ProcessEnv;

  const ORDER_WITH_PAYMENT: KeyCrmOrderInput = {
    ...ORDER,
    paymentOptionLabel: 'Передоплата 200 ₴',
    quantityDiscount: 200,
    loyaltyDiscountAmount: 112,
    subtotal: 2449,
    total: 2137,
    lines: [{ ...ORDER.lines[0], unitPrice: 2449, basePrice: 2449 }],
  };

  async function capturePayload(
    input: KeyCrmOrderInput,
    env: NodeJS.ProcessEnv,
  ): Promise<{ result: string; body: KeyCrmOrderPayload }> {
    let body: unknown = null;
    const result = await syncKeyCrmOrder(input, {
      env,
      apiKey: 'test-key',
      fetchImpl: (async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ id: 1 }), { status: 201 });
      }) as typeof fetch,
    });
    return { result, body: body as KeyCrmOrderPayload };
  }

  function fieldValue(payload: KeyCrmOrderPayload, uuid: string) {
    const field = (payload.custom_fields ?? []).find(entry => entry.uuid === uuid);
    return field ? field.value : undefined;
  }

  it('sends «Передоплата 200 ₴» to OR_1010 as a string array', async () => {
    const { result, body } = await capturePayload(ORDER_WITH_PAYMENT, PAYMENT_ENV);
    assert.equal(result, 'sent');
    assert.deepEqual(fieldValue(body, 'OR_1010'), ['Передоплата 200 ₴']);
  });

  it('sends «Повна оплата» to OR_1010 as a string array', async () => {
    const { result, body } = await capturePayload(
      { ...ORDER_WITH_PAYMENT, paymentOptionLabel: 'Повна оплата' },
      PAYMENT_ENV,
    );
    assert.equal(result, 'sent');
    assert.deepEqual(fieldValue(body, 'OR_1010'), ['Повна оплата']);
  });

  it('keeps OR_1007, OR_1008 and OR_1009 alongside OR_1010', async () => {
    const { body } = await capturePayload(ORDER_WITH_PAYMENT, PAYMENT_ENV);
    const uuids = (body.custom_fields ?? []).map(entry => entry.uuid);
    assert.ok(uuids.includes('OR_1007'), 'contact method field present');
    assert.ok(uuids.includes('OR_1008'), 'quantity discount field present');
    assert.ok(uuids.includes('OR_1009'), 'loyalty discount field present');
    assert.ok(uuids.includes('OR_1010'), 'payment option field present');
    assert.deepEqual(fieldValue(body, 'OR_1007'), ['Зателефонувати']);
    assert.equal(fieldValue(body, 'OR_1008'), 200);
    assert.equal(fieldValue(body, 'OR_1009'), 112);
  });

  it('does not change totals or discounts when the payment option is attached', async () => {
    const { body: prepay } = await capturePayload(ORDER_WITH_PAYMENT, PAYMENT_ENV);
    const { body: full } = await capturePayload(
      { ...ORDER_WITH_PAYMENT, paymentOptionLabel: 'Повна оплата' },
      PAYMENT_ENV,
    );
    // Money fields are identical for both payment terms — the option is informational only.
    assert.equal(prepay.discount_amount, full.discount_amount);
    assert.equal(prepay.discount_amount, 312); // 200 quantity + 112 loyalty
    assert.deepEqual({ ...prepay, custom_fields: null }, { ...full, custom_fields: null });
  });

  it('creates no payments[] and no payment status', async () => {
    const { body } = await capturePayload(ORDER_WITH_PAYMENT, PAYMENT_ENV);
    const record = body as unknown as Record<string, unknown>;
    assert.equal(record.payments, undefined);
    assert.equal(record.payment_status, undefined);
    assert.equal(record.status, undefined);
  });

  it('omits OR_1010 when the env uuid is not configured (legacy config)', async () => {
    const { body } = await capturePayload(ORDER_WITH_PAYMENT, FULL_ENV);
    assert.equal(fieldValue(body, 'OR_1010'), undefined);
    assert.ok((body.custom_fields ?? []).some(entry => entry.uuid === 'OR_1007'));
  });

  it('omits OR_1010 when the order recorded no payment option', async () => {
    const { body } = await capturePayload(
      { ...ORDER_WITH_PAYMENT, paymentOptionLabel: null },
      PAYMENT_ENV,
    );
    assert.equal(fieldValue(body, 'OR_1010'), undefined);
    assert.equal(fieldValue(body, 'OR_1008'), 200);
  });

  it('gives Telegram the same payment label that goes to OR_1010', async () => {
    const label = 'Передоплата 200 ₴';
    const { body } = await capturePayload(
      { ...ORDER_WITH_PAYMENT, paymentOptionLabel: label },
      PAYMENT_ENV,
    );
    const telegram = applyPaymentOptionFallback(
      'Покупець: Тест\nАдреса: Київ\nСума: 2137 ₴',
      'Покупець: Тест\nАдреса: Київ\nСума: 2137 ₴',
      label,
    );
    assert.match(telegram, /Варіант оплати: Передоплата 200 ₴/);
    assert.deepEqual(fieldValue(body, 'OR_1010'), ['Передоплата 200 ₴']);
    assert.deepEqual(fieldValue(body, 'OR_1010'), [label]);
  });
});
