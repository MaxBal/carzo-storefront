import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  badgeSku,
  caseSku,
  contactMethodLabel,
  paidFixationSku,
} from '../lib/keycrm/sku';

describe('keyCRM SKU mapping', () => {
  it('maps every size × design to the catalog case SKU', () => {
    assert.equal(caseSku('S', '2-0'), 'S2.0');
    assert.equal(caseSku('M', '4-0'), 'M4.0');
    assert.equal(caseSku('L', '3-0'), 'L3.0');
    assert.equal(caseSku('XL', '2-0'), 'XL2.0');
    assert.equal(caseSku('m', '4-0'), 'M4.0');
  });

  it('returns null for unknown case combinations', () => {
    assert.equal(caseSku('XXL', '4-0'), null);
    assert.equal(caseSku('M', '5-0'), null);
    assert.equal(caseSku('', ''), null);
  });

  it('maps paid fixation to FIX-*-DW per size only', () => {
    assert.equal(paidFixationSku('both', 'S'), 'FIX-S-DW');
    assert.equal(paidFixationSku('both', 'M'), 'FIX-M-DW');
    assert.equal(paidFixationSku('both', 'L'), 'FIX-L-DW');
    assert.equal(paidFixationSku('both', 'XL'), 'FIX-XL-DW');
    assert.equal(paidFixationSku('both', '2XL'), null);
    assert.equal(paidFixationSku('bottom', 'M'), null);
    assert.equal(paidFixationSku('none', 'M'), null);
    assert.equal(paidFixationSku('wall', 'M'), null);
  });

  it('maps all 25 site brands to badge SKUs incl. non-formula slugs', () => {
    assert.equal(badgeSku('audi'), 'AUDI-ST');
    assert.equal(badgeSku('bmw-m'), 'BMWM-ST');
    assert.equal(badgeSku('rr'), 'RANGEROVER-ST');
    assert.equal(badgeSku('alfa'), 'ALFAROMEO-ST');
    assert.equal(badgeSku('land-rover'), 'LANDROVER-ST');
    assert.equal(badgeSku('s-line'), 'SLINE-ST');
    assert.equal(badgeSku('volkswagen'), 'VOLKSWAGEN-ST');
    assert.equal(badgeSku('none'), null);
    assert.equal(badgeSku(''), null);
    assert.equal(badgeSku('byd'), null);
  });

  it('maps contact methods to the keyCRM select option labels', () => {
    assert.equal(contactMethodLabel('phone'), 'Зателефонувати');
    assert.equal(contactMethodLabel('telegram'), 'Telegram');
    assert.equal(contactMethodLabel('viber'), 'Viber');
    assert.equal(contactMethodLabel('whatsapp'), 'WhatsApp');
    assert.equal(contactMethodLabel('email'), null);
  });
});
