import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildCompositionComment,
  buildKeyCrmOrder,
} from '../lib/keycrm/order-payload';
import type { KeyCrmOrderInput, KeyCrmSourceLine } from '../lib/keycrm/types';

const CONFIG = {
  sourceId: 6,
  deliveryServiceId: 1,
  contactMethodFieldUuid: 'OR_1007',
};

function line(overrides: Partial<KeyCrmSourceLine> = {}): KeyCrmSourceLine {
  return {
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
    ...overrides,
  };
}

function input(overrides: Partial<KeyCrmOrderInput> = {}): KeyCrmOrderInput {
  const lines = overrides.lines ?? [line()];
  const subtotal = overrides.subtotal
    ?? lines.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const quantityDiscount = overrides.quantityDiscount ?? 0;
  const loyaltyDiscountAmount = overrides.loyaltyDiscountAmount ?? 0;
  const total = overrides.total ?? subtotal - quantityDiscount - loyaltyDiscountAmount;
  return {
    orderNumber: 'CZ-20261106-ABC123',
    customerName: 'Приклад Імʼя',
    customerPhone: '+380931234567',
    customerComment: null,
    contactMethod: 'telegram',
    deliveryMethod: 'BRANCH',
    deliveryCityName: 'Київ',
    deliveryPointRef: '00000000-0000-0000-0000-000000000001',
    deliveryPointNumber: '123',
    deliveryPointName: 'Відділення №123',
    deliveryPointAddress: 'вул. Хрещатик, 1',
    quantityDiscount,
    loyaltyDiscountAmount,
    ...overrides,
    lines,
    subtotal,
    total,
  };
}

describe('keyCRM order payload builder', () => {
  it('sends a plain case as one position without comment', () => {
    const payload = buildKeyCrmOrder(input(), CONFIG);
    assert.equal(payload.source_id, 6);
    assert.equal(payload.source_uuid, 'CZ-20261106-ABC123');
    assert.equal(payload.products.length, 1);
    assert.equal(payload.products[0].sku, 'M4.0');
    assert.equal(payload.products[0].price, 2249);
    assert.equal(payload.products[0].quantity, 1);
    assert.equal(payload.products[0].comment, undefined);
    assert.equal(payload.discount_amount, undefined);
    assert.deepEqual(payload.custom_fields, [{ uuid: 'OR_1007', value: ['Telegram'] }]);
  });

  it('groups identical base SKUs and keeps free fixations in the comment', () => {
    const payload = buildKeyCrmOrder(input({
      lines: [
        line({ fixationKey: 'bottom', fixationLabel: 'фікс.на дні' }),
        line({ fixationKey: 'wall', fixationLabel: 'фікс.на стінці' }),
      ],
    }), CONFIG);
    assert.equal(payload.products.length, 1);
    assert.equal(payload.products[0].sku, 'M4.0');
    assert.equal(payload.products[0].quantity, 2);
    assert.equal(
      payload.products[0].comment,
      'Комплектація:\n- 1 шт. — Без логотипа, фікс.на дні.\n- 1 шт. — Без логотипа, фікс.на стінці.',
    );
  });

  it('keeps logo↔fixation pairing in the composition comment', () => {
    const payload = buildKeyCrmOrder(input({
      lines: [
        line({
          brandSlug: 'bmw', brandName: 'BMW', fixationKey: 'wall', fixationLabel: 'фікс.на стінці',
          logoExtra: 290, unitPrice: 2539, basePrice: 2249,
        }),
        line({
          brandSlug: 'toyota', brandName: 'Toyota', fixationKey: 'both', fixationLabel: 'фікс.дно+стінка',
          logoExtra: 290, fixationExtra: 80, unitPrice: 2619, basePrice: 2249,
        }),
      ],
    }), CONFIG);
    const bySku = Object.fromEntries(payload.products.map((item) => [item.sku, item]));
    const base = bySku['M4.0'];
    assert.ok(base);
    assert.equal(base.quantity, 2);
    assert.equal(
      base.comment,
      'Комплектація:\n- 1 шт. — BMW, фікс.на стінці.\n- 1 шт. — Toyota, фікс.дно+стінка.',
    );
    assert.equal(bySku['FIX-M-DW']?.quantity, 1);
    assert.equal(bySku['FIX-M-DW']?.price, 80);
    assert.equal(bySku['BMW-ST']?.quantity, 1);
    assert.equal(bySku['BMW-ST']?.price, 290);
    assert.equal(bySku['TOYOTA-ST']?.quantity, 1);
  });

  it('aggregates paid fixations across different case SKUs of the same size', () => {
    const payload = buildKeyCrmOrder(input({
      lines: [
        line({ designSlug: '4-0', fixationKey: 'both', fixationLabel: 'фікс.дно+стінка', fixationExtra: 80, unitPrice: 2329, basePrice: 2249 }),
        line({ designSlug: '2-0', fixationKey: 'both', fixationLabel: 'фікс.дно+стінка', fixationExtra: 80, unitPrice: 2329, basePrice: 2249 }),
      ],
    }), CONFIG);
    const bySku = Object.fromEntries(payload.products.map((item) => [item.sku, item]));
    assert.equal(bySku['M4.0']?.quantity, 1);
    assert.equal(bySku['M2.0']?.quantity, 1);
    assert.equal(bySku['FIX-M-DW']?.quantity, 2);
  });

  it('never charges add-ons twice: positions sum equals subtotal', () => {
    const payload = buildKeyCrmOrder(input({
      lines: [
        line({ brandSlug: 'toyota', brandName: 'Toyota', fixationKey: 'both', fixationLabel: 'фікс.дно+стінка', logoExtra: 290, fixationExtra: 80, unitPrice: 2619, basePrice: 2249 }),
      ],
    }), CONFIG);
    const sum = payload.products.reduce((total, item) => total + item.price * item.quantity, 0);
    assert.equal(sum, 2619);
    assert.equal(payload.products.find((item) => item.sku === 'M4.0')?.price, 2249);
  });

  it('passes quantity + loyalty discounts as one order-level amount', () => {
    const payload = buildKeyCrmOrder(input({
      lines: [
        line({ quantity: 2, unitPrice: 2249, basePrice: 2249 }),
        line({ brandSlug: 'kia', brandName: 'Kia', fixationKey: 'both', fixationLabel: 'фікс.дно+стінка', logoExtra: 290, fixationExtra: 80, unitPrice: 2619, basePrice: 2249 }),
      ],
      subtotal: 7117,
      quantityDiscount: 200,
      discountTierKey: 'quantity-2',
      loyaltyDiscountAmount: 345,
      total: 6572,
    }), CONFIG);
    assert.equal(payload.discount_amount, 545);
    assert.match(payload.manager_comment ?? '', /Знижка за кількість: 200 ₴ \(quantity-2\)/);
    assert.match(payload.manager_comment ?? '', /Знижка постійного клієнта 5%: 345 ₴/);
  });

  it('rejects orders whose positions do not sum to subtotal', () => {
    assert.throws(
      () => buildKeyCrmOrder(input({
        lines: [line()],
        subtotal: 999,
      }), CONFIG),
      /POSITIONS_SUM_MISMATCH/,
    );
  });

  it('rejects a unit_price that does not match its parts', () => {
    assert.throws(
      () => buildKeyCrmOrder(input({
        lines: [line({ brandSlug: 'bmw', brandName: 'BMW', logoExtra: 290, unitPrice: 2249, basePrice: 2249 })],
      }), CONFIG),
      /UNIT_PRICE_SPLIT_MISMATCH/,
    );
  });

  it('rejects a total that does not follow subtotal minus discounts', () => {
    assert.throws(
      () => buildKeyCrmOrder(input({
        lines: [line()],
        subtotal: 2249,
        quantityDiscount: 200,
        total: 2249,
      }), CONFIG),
      /TOTAL_MISMATCH/,
    );
  });

  it('rejects unknown SKUs instead of sending a partial order', () => {
    assert.throws(() => buildKeyCrmOrder(input({ lines: [line({ sizeCode: '2XL' })] }), CONFIG), /UNKNOWN_CASE_SKU/);
    assert.throws(() => buildKeyCrmOrder(input({ lines: [line({ brandSlug: 'byd' })] }), CONFIG), /UNKNOWN_BADGE_SKU/);
  });

  it('passes a real buyer comment only and skips empty ones', () => {
    const withComment = buildKeyCrmOrder(input({ customerComment: 'Подарункове пакування' }), CONFIG);
    assert.equal(withComment.buyer_comment, 'Подарункове пакування');
    const withoutComment = buildKeyCrmOrder(input({ customerComment: '   ' }), CONFIG);
    assert.equal(withoutComment.buyer_comment, undefined);
  });

  it('maps branch, postomat and courier delivery to shipping fields', () => {
    const branch = buildKeyCrmOrder(input(), CONFIG);
    assert.equal(branch.shipping.delivery_service_id, 1);
    assert.equal(branch.shipping.warehouse_ref, '00000000-0000-0000-0000-000000000001');
    assert.equal(branch.shipping.shipping_address_city, 'Київ');
    assert.match(branch.shipping.shipping_receive_point ?? '', /^Відділення №123:/);

    const postomat = buildKeyCrmOrder(input({ deliveryMethod: 'POSTOMAT' }), CONFIG);
    assert.match(postomat.shipping.shipping_receive_point ?? '', /^Поштомат №123:/);

    const courier = buildKeyCrmOrder(input({
      deliveryMethod: 'COURIER',
      deliveryPointRef: null,
      deliveryPointNumber: null,
      deliveryPointName: null,
      deliveryPointAddress: null,
      deliveryStreetName: 'Хрещатик',
      deliveryStreetType: 'вул.',
      deliveryHouse: '10',
      deliveryApartment: '5',
    }), CONFIG);
    assert.equal(courier.shipping.warehouse_ref, undefined);
    assert.equal(courier.shipping.shipping_secondary_line, 'вул. Хрещатик, буд. 10, кв. 5');
    assert.equal(courier.shipping.shipping_receive_point, 'Курʼєрська доставка');
    assert.equal(courier.shipping.recipient_phone, '+380931234567');
  });

  it('builds a default-combo comment only when options differ from defaults', () => {
    assert.equal(buildCompositionComment([line()]), '');
    assert.equal(
      buildCompositionComment([line({ brandSlug: 'bmw', brandName: 'BMW', fixationKey: 'none', fixationLabel: 'без фіксації', logoExtra: 290, unitPrice: 2539, basePrice: 2249 })]),
      'Комплектація: 1 шт. — BMW, без фіксації.',
    );
  });

  it('does not include custom_fields when the uuid is not configured', () => {
    const payload = buildKeyCrmOrder(input(), { sourceId: 6, deliveryServiceId: 1 });
    assert.equal(payload.custom_fields, undefined);
  });

  it('includes the email only when provided', () => {
    const payload = buildKeyCrmOrder(input({ customerEmail: 'test@example.com' }), CONFIG);
    assert.equal(payload.buyer.email, 'test@example.com');
    const payloadNoEmail = buildKeyCrmOrder(input(), CONFIG);
    assert.equal('email' in payloadNoEmail.buyer, false);
  });
});
