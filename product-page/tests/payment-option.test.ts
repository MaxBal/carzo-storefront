import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_PAYMENT_OPTION,
  PAYMENT_OPTION_LABELS,
  PAYMENT_OPTION_VALUES,
  isPaymentOption,
  paymentOptionLabel,
} from '../lib/cart/payment-option';
import { checkoutSchema } from '../lib/cart/validation';
import { computeRequestFingerprint } from '../lib/cart/checkout-attempt';
import { buildKeyCrmOrder } from '../lib/keycrm/order-payload';
import type { KeyCrmOrderInput } from '../lib/keycrm/types';
import { applyPaymentOptionFallback } from '../lib/order-notifications';

const BASE_ITEM = {
  size: 'M', designSlug: '2-0', brandId: 'none', fixation: 'none', quantity: 1,
};

const BASE_CHECKOUT = {
  items: [BASE_ITEM],
  expectedTotal: 2249,
  customerName: 'Тест Тест',
  customerPhone: '+380931234567',
  contactMethod: 'phone',
  delivery: {
    method: 'BRANCH',
    cityRef: '8d5a980d-391c-11dd-90d9-001a92567626',
    pointRef: '1ec09d88-e1c2-11e3-8c4a-0050568002cf',
  },
} as const;

function keyCrmInput(overrides: Partial<KeyCrmOrderInput> = {}): KeyCrmOrderInput {
  const quantityDiscount = overrides.quantityDiscount ?? 0;
  const loyaltyDiscountAmount = overrides.loyaltyDiscountAmount ?? 0;
  return {
    orderNumber: 'CZ-20261107-ABC123',
    customerName: 'Тест Тест',
    customerPhone: '+380931234567',
    customerComment: null,
    contactMethod: 'phone',
    deliveryMethod: 'BRANCH',
    deliveryCityName: 'Київ',
    deliveryPointNumber: '1',
    deliveryPointName: 'Відділення №1',
    quantityDiscount,
    loyaltyDiscountAmount,
    subtotal: 2249,
    total: 2249 - quantityDiscount - loyaltyDiscountAmount,
    lines: [{
      sizeCode: 'M', designSlug: '2-0', brandSlug: 'none', brandName: 'Без логотипа',
      fixationKey: 'none', fixationLabel: 'без фіксації', quantity: 1, unitPrice: 2249,
      basePrice: 2249, logoExtra: 0, fixationExtra: 0,
    }],
    ...overrides,
  };
}

describe('payment option mapping', () => {
  it('default option is prepayment_200 «Передоплата 200 ₴»', () => {
    assert.equal(DEFAULT_PAYMENT_OPTION, 'prepayment_200');
    assert.equal(PAYMENT_OPTION_LABELS.prepayment_200, 'Передоплата 200 ₴');
    assert.equal(PAYMENT_OPTION_LABELS.full, 'Повна оплата');
  });

  it('exactly two stable values with the shared labels', () => {
    assert.deepEqual([...PAYMENT_OPTION_VALUES], ['prepayment_200', 'full']);
    assert.ok(isPaymentOption('prepayment_200'));
    assert.ok(isPaymentOption('full'));
    assert.equal(isPaymentOption('Повна сума'), false);
    assert.equal(isPaymentOption('anything else'), false);
    assert.equal(paymentOptionLabel('prepayment_200'), 'Передоплата 200 ₴');
    assert.equal(paymentOptionLabel('full'), 'Повна оплата');
    assert.equal(paymentOptionLabel(undefined), null);
    assert.equal(paymentOptionLabel('junk'), null);
  });
});

describe('checkout schema accepts only the two options', () => {
  it('accepts prepayment_200 and full', () => {
    for (const paymentOption of ['prepayment_200', 'full'] as const) {
      const result = checkoutSchema.safeParse({ ...BASE_CHECKOUT, paymentOption });
      assert.ok(result.success, `expected ${paymentOption} to validate`);
      assert.equal(result.success && result.data.paymentOption, paymentOption);
    }
  });

  it('rejects arbitrary text', () => {
    for (const paymentOption of ['Повна сума', 'prepayment', '100', '']) {
      const result = checkoutSchema.safeParse({ ...BASE_CHECKOUT, paymentOption });
      assert.equal(result.success, false, `expected ${paymentOption} to be rejected`);
    }
  });

  it('accepts a legacy request without paymentOption', () => {
    const result = checkoutSchema.safeParse(BASE_CHECKOUT);
    assert.ok(result.success);
    assert.equal(result.success && result.data.paymentOption, undefined);
  });
});

describe('fingerprint binds the payment option', () => {
  const base = {
    customerPhone: '+380931234567',
    contactMethod: 'phone',
    deliveryMethod: 'BRANCH',
    items: [BASE_ITEM],
  };

  it('same option → same fingerprint', () => {
    assert.equal(
      computeRequestFingerprint({ ...base, paymentOption: 'full' }),
      computeRequestFingerprint({ ...base, paymentOption: 'full' }),
    );
  });

  it('different option → different fingerprint (attempt reuse is not silent)', () => {
    assert.notEqual(
      computeRequestFingerprint({ ...base, paymentOption: 'prepayment_200' }),
      computeRequestFingerprint({ ...base, paymentOption: 'full' }),
    );
    assert.notEqual(
      computeRequestFingerprint({ ...base, paymentOption: 'full' }),
      computeRequestFingerprint(base),
    );
  });
});

describe('keyCRM payment option custom field', () => {
  const config = {
    sourceId: 6,
    deliveryServiceId: 1,
    contactMethodFieldUuid: 'OR_1007',
    paymentOptionFieldUuid: 'OR_1010',
  };

  it('sends «Передоплата 200 ₴» for prepayment_200', () => {
    const payload = buildKeyCrmOrder(
      keyCrmInput({ paymentOptionLabel: 'Передоплата 200 ₴' }),
      config,
    );
    const fields = (payload.custom_fields ?? []).map((f) => [f.uuid, f.value]);
    assert.deepEqual(fields[0], ['OR_1007', ['Зателефонувати']]);
    assert.deepEqual(fields[1], ['OR_1010', ['Передоплата 200 ₴']]);
  });

  it('sends «Повна оплата» for full', () => {
    const payload = buildKeyCrmOrder(
      keyCrmInput({ paymentOptionLabel: 'Повна оплата' }),
      config,
    );
    const fields = Object.fromEntries((payload.custom_fields ?? []).map((f) => [f.uuid, f.value]));
    assert.deepEqual(fields.OR_1010, ['Повна оплата']);
  });

  it('keeps OR_1007 / OR_1008 / OR_1009 alongside OR_1010', () => {
    const payload = buildKeyCrmOrder(
      keyCrmInput({ paymentOptionLabel: 'Повна оплата', quantityDiscount: 200 }),
      config,
    );
    const fields = Object.fromEntries((payload.custom_fields ?? []).map((f) => [f.uuid, f.value]));
    assert.deepEqual(fields.OR_1007, ['Зателефонувати']);
    assert.equal(fields.OR_1008, 200);
    assert.equal(fields.OR_1009, 0);
    assert.deepEqual(fields.OR_1010, ['Повна оплата']);
    assert.deepEqual((payload.custom_fields ?? []).map((f) => f.uuid), ['OR_1007', 'OR_1010', 'OR_1008', 'OR_1009']);
  });

  it('skips the field when the option was not recorded or the uuid is not configured', () => {
    const withoutOption = buildKeyCrmOrder(keyCrmInput(), config);
    const withoutUuid = buildKeyCrmOrder(
      keyCrmInput({ paymentOptionLabel: 'Повна оплата' }),
      { sourceId: 6, deliveryServiceId: 1 },
    );
    assert.deepEqual((withoutOption.custom_fields ?? []).map((f) => f.uuid), ['OR_1007', 'OR_1008', 'OR_1009']);
    assert.deepEqual((withoutUuid.custom_fields ?? []).map((f) => f.uuid), ['OR_1008', 'OR_1009']);
  });

  it('does not change money fields, payments or status', () => {
    const prepay = buildKeyCrmOrder(
      keyCrmInput({ paymentOptionLabel: 'Передоплата 200 ₴', quantityDiscount: 200, loyaltyDiscountAmount: 119 }),
      config,
    );
    const full = buildKeyCrmOrder(
      keyCrmInput({ paymentOptionLabel: 'Повна оплата', quantityDiscount: 200, loyaltyDiscountAmount: 119 }),
      config,
    );
    assert.equal(prepay.discount_amount, full.discount_amount);
    assert.deepEqual({ ...prepay, custom_fields: null }, { ...full, custom_fields: null });
    assert.equal((prepay as unknown as Record<string, unknown>).payments, undefined);
    assert.equal((full as unknown as Record<string, unknown>).status, undefined);
  });
});

describe('Telegram payment option line', () => {
  const base = 'Покупець: Тест\nТелефон: +380931234567\nСпосіб зв’язку: Телефон\nТовари:\n— 1 × M\nКількість: 1\nСума: 2249 ₴\nДоставка: У відділення\nАдреса: Київ, Відділення №1';

  it('inserts «Варіант оплати» after the Адреса line for legacy templates', () => {
    const rendered = applyPaymentOptionFallback(base, base, 'Передоплата 200 ₴');
    assert.ok(rendered.includes('Адреса: Київ, Відділення №1\nВаріант оплати: Передоплата 200 ₴'));
    assert.equal(rendered.split('Варіант оплати:').length - 1, 1);
  });

  it('does not insert when the template already renders the token', () => {
    const template = `${base}\nВаріант оплати: {{payment_option}}`;
    const rendered = applyPaymentOptionFallback(template, base, 'Повна оплата');
    assert.equal(rendered, base);
  });

  it('does not insert when no option was recorded', () => {
    assert.equal(applyPaymentOptionFallback(base, base, ''), base);
    assert.equal(applyPaymentOptionFallback(base, base, undefined as unknown as string), base);
  });

  it('appends when the template has no Адреса line', () => {
    const short = 'Покупець: Тест\nСума: 2249 ₴';
    assert.equal(
      applyPaymentOptionFallback(short, short, 'Повна оплата'),
      `${short}\nВаріант оплати: Повна оплата`,
    );
  });
});
