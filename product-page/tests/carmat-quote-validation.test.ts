import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildFullPhone } from '../lib/cart/phone';
import { carMatQuoteSchema } from '../lib/carmat-quote/validation';

/**
 * Regression: PhoneInput stores subscriber digits only (max 9), so the
 * schema must accept that contract — the exact payload from the production
 * bug where a filled form was rejected with "Перевірте поля".
 */
const FILLED_FORM = {
  customerName: 'Yevgen Shvets',
  customerPhone: '931008292',
  carModel: 'Тойota',
  carYear: '1995',
  bodyType: 'седан',
  interest: 'salon-and-trunk',
  contactMethod: 'telegram',
  comment: '',
  photoChoices: ['none'],
  informationChoices: ['care'],
};

describe('car mat quote — input validation', () => {
  it('accepts the PhoneInput subscriber-digits payload from the filled form', () => {
    const result = carMatQuoteSchema.safeParse(FILLED_FORM);
    assert.equal(result.success, true);
  });

  it('accepts the full +380 form produced by buildFullPhone', () => {
    const result = carMatQuoteSchema.safeParse({
      ...FILLED_FORM,
      customerPhone: buildFullPhone(FILLED_FORM.customerPhone),
    });
    assert.equal(result.success, true);
    assert.equal(buildFullPhone(FILLED_FORM.customerPhone), '+380931008292');
  });

  it('still rejects an empty or short phone and an empty car model', () => {
    assert.equal(carMatQuoteSchema.safeParse({ ...FILLED_FORM, customerPhone: '9310082' }).success, false);
    assert.equal(carMatQuoteSchema.safeParse({ ...FILLED_FORM, carModel: '' }).success, false);
    assert.equal(carMatQuoteSchema.safeParse({ ...FILLED_FORM, carYear: '18' }).success, false);
  });

  it('rejects unknown option values', () => {
    assert.equal(carMatQuoteSchema.safeParse({ ...FILLED_FORM, interest: 'wheels' }).success, false);
    assert.equal(carMatQuoteSchema.safeParse({ ...FILLED_FORM, photoChoices: ['carzo-9'] }).success, false);
    assert.equal(carMatQuoteSchema.safeParse({ ...FILLED_FORM, contactMethod: 'pigeon' }).success, false);
  });
});
