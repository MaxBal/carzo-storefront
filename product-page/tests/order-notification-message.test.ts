import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  escapeTelegramHtml,
  formatAmount,
  formatOrderNotificationHtml,
  type OrderNotificationMessageInput,
} from '../lib/cart/order-notification-message';

const ITEM_L = {
  title: 'Автокейс L Carzo 4.0',
  quantity: 2,
  lineTotal: 5180,
  fixationLabel: 'без фіксації',
  brandName: 'Без логотипа',
};
const ITEM_XL = {
  title: 'Автокейс XL Carzo 4.0',
  quantity: 2,
  lineTotal: 5980,
  fixationLabel: 'без фіксації',
  brandName: 'Без логотипа',
};
const ITEM_M_AUDI = {
  title: 'Автокейс M Carzo 2.0 для Audi',
  quantity: 1,
  lineTotal: 2539,
  fixationLabel: 'без фіксації',
  brandName: 'Audi',
};

const BASE: OrderNotificationMessageInput = {
  orderNumber: 'A-2026-1142',
  customerName: 'Yevgen Shvets',
  customerPhone: '+380931008292',
  contactMethod: 'Telegram',
  paymentOption: 'Передоплата 200 ₴',
  items: [ITEM_L],
  itemsQuantity: 2,
  quantityDiscount: 0,
  loyaltyDiscountAmount: 0,
  total: 5180,
  deliveryMethod: 'У відділення',
  deliveryCity: 'Київ',
  deliveryDestination: 'Відділення №15: вул. Хрещатик, 1',
};

function render(overrides: Partial<OrderNotificationMessageInput>): string {
  return formatOrderNotificationHtml({ ...BASE, ...overrides });
}

describe('order notification message — structure', () => {
  it('renders all blocks for a single-item order without item numbering', () => {
    const text = render({});
    for (const marker of [
      '🛒 <b>НОВЕ ЗАМОВЛЕННЯ CARZO</b>',
      '<b>Замовлення A-2026-1142</b>',
      '👤 <b>Покупець</b>',
      'Ім’я: Yevgen Shvets',
      'Телефон: +380931008292',
      '📦 <b>ТОВАРИ</b>',
      '<b>Автокейс L — Carzo 4.0</b>',
      'Кількість: 2 шт.',
      'Фіксація: без фіксації',
      'Вартість: 5 180 ₴',
      '💰 <b>ВАРТІСТЬ ЗАМОВЛЕННЯ</b>',
      'Кількість товарів: 2 шт.',
      '<b>До сплати: 5 180 ₴</b>',
      '🚚 <b>ДОСТАВКА</b>',
      'У відділення',
      'Київ, Відділення №15: вул. Хрещатик, 1',
      '💳 <b>ОПЛАТА</b>',
      'Передоплата 200 ₴',
      '💬 <b>ЗВ\'ЯЗОК</b>',
      'Telegram',
    ]) {
      assert.ok(text.includes(marker), `missing: ${marker}`);
    }
    assert.ok(!text.includes('1. Автокейс'), 'single item must not be numbered');
    assert.ok(!text.includes('📝'), 'comment block must be absent without comment');
  });

  it('numbers each position when the order has several different items', () => {
    const text = render({
      items: [ITEM_L, ITEM_XL, ITEM_M_AUDI],
      itemsQuantity: 5,
      quantityDiscount: 500,
      loyaltyDiscountAmount: 659,
      total: 12540,
      customerComment: 'Потрібні килимки в салон.',
    });
    assert.ok(text.includes('<b>1. Автокейс L — Carzo 4.0</b>'));
    assert.ok(text.includes('<b>2. Автокейс XL — Carzo 4.0</b>'));
    assert.ok(text.includes('<b>3. Автокейс M — Carzo 2.0</b>'));
    assert.ok(text.includes('Кількість: 2 шт.'));
    assert.ok(text.includes('Кількість: 1 шт.'));
    assert.ok(text.includes('Разом дешевше: −500 ₴'));
    assert.ok(text.includes('Знижка 5%: −659 ₴'));
    assert.ok(text.includes('<b>До сплати: 12 540 ₴</b>'));
    assert.ok(text.includes('📝 <b>КОМЕНТАР</b>'));
    assert.ok(text.includes('Потрібні килимки в салон.'));
  });

  it('separates blocks and items with exactly one blank line', () => {
    const text = render({ items: [ITEM_L, ITEM_XL] });
    assert.ok(!/\n{3,}/.test(text), 'excessive blank lines');
    assert.ok(text.includes('Вартість: 5 180 ₴\n\n<b>2.'));
  });
});

describe('order notification message — item details', () => {
  it('moves the car logo to its own line and keeps the head clean', () => {
    const text = render({ items: [ITEM_M_AUDI] });
    assert.ok(text.includes('<b>Автокейс M — Carzo 2.0</b>'));
    assert.ok(text.includes('Автомобіль: Audi'));
    assert.ok(!text.includes('для Audi'), 'brand must not be duplicated in the head');
  });

  it('omits the brand line when no logo is chosen', () => {
    const text = render({ items: [{ ...ITEM_L, title: 'Автокейс L Carzo 4.0' }] });
    assert.ok(!text.includes('Автомобіль'));
    assert.ok(!text.includes('Без логотипа'));
  });

  it('keeps a configured fixation visible', () => {
    const text = render({
      items: [{ ...ITEM_L, fixationLabel: 'На дні + на стінці' }],
    });
    assert.ok(text.includes('Фіксація: На дні + на стінці'));
  });

  it('keeps an empty fixation line out', () => {
    const text = render({ items: [{ ...ITEM_L, fixationLabel: '   ' }] });
    assert.ok(!text.includes('Фіксація'));
  });
});

describe('order notification message — money blocks', () => {
  it('omits both discount rows when no discounts apply', () => {
    const text = render({ quantityDiscount: 0, loyaltyDiscountAmount: 0 });
    assert.ok(!text.includes('Разом дешевше'));
    assert.ok(!text.includes('Знижка 5%'));
  });

  it('shows only the discount rows that exist', () => {
    const withQuantity = render({ quantityDiscount: 500 });
    assert.ok(withQuantity.includes('Разом дешевше: −500 ₴'));
    assert.ok(!withQuantity.includes('Знижка 5%'));

    const withLoyalty = render({ loyaltyDiscountAmount: 659 });
    assert.ok(withLoyalty.includes('Знижка 5%: −659 ₴'));
    assert.ok(!withLoyalty.includes('Разом дешевше'));
  });

  it('groups thousands in amounts', () => {
    assert.equal(formatAmount(5180), '5 180');
    assert.equal(formatAmount(500), '500');
    assert.equal(formatAmount(-500), '−500');
  });
});

describe('order notification message — delivery, payment, contact', () => {
  it('renders courier delivery with the full address', () => {
    const text = render({
      deliveryMethod: 'Курʼєром',
      deliveryCity: 'Одеса',
      deliveryDestination: 'вул. Дерибасівська, буд. 10, кв. 5',
    });
    assert.ok(text.includes('Курʼєром'));
    assert.ok(text.includes('Одеса, вул. Дерибасівська, буд. 10, кв. 5'));
  });

  it('renders postomat delivery', () => {
    const text = render({
      deliveryMethod: 'У поштомат',
      deliveryDestination: 'Поштомат №12345',
    });
    assert.ok(text.includes('У поштомат'));
    assert.ok(text.includes('Київ, Поштомат №12345'));
  });

  it('renders full payment and a phone contact method', () => {
    const text = render({ paymentOption: 'Повна оплата', contactMethod: 'Зателефонувати' });
    assert.ok(text.includes('💳 <b>ОПЛАТА</b>\nПовна оплата'));
    assert.ok(text.includes('💬 <b>ЗВ\'ЯЗОК</b>\nЗателефонувати'));
  });

  it('omits the payment block when no option was recorded', () => {
    const text = render({ paymentOption: '' });
    assert.ok(!text.includes('💳'));
    assert.ok(!text.includes('ОПЛАТА'));
  });
});

describe('order notification message — safety', () => {
  it('escapes HTML in every user-supplied value', () => {
    const text = render({
      customerName: '<b>Иван</b> & Ко',
      customerPhone: '+380<0>',
      customerComment: '<script>alert(1)</script> & ok',
      items: [{
        title: 'Автокейс L Carzo <4.0>',
        quantity: 1,
        lineTotal: 100,
        fixationLabel: 'На дні & <стінці>',
        brandName: '<Audi>',
      }],
    });
    assert.ok(text.includes('Ім’я: &lt;b&gt;Иван&lt;/b&gt; &amp; Ко'));
    assert.ok(text.includes('Автомобіль: &lt;Audi&gt;'));
    assert.ok(text.includes('Фіксація: На дні &amp; &lt;стінці&gt;'));
    assert.ok(text.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; ok'));
    assert.ok(!text.includes('<script>'));
    assert.ok(!text.includes('<b>Иван</b>'));
  });

  it('escapeTelegramHtml neutralizes the three markup characters', () => {
    assert.equal(escapeTelegramHtml('a<b>&c>'), 'a&lt;b&gt;&amp;c&gt;');
  });

  it('includes the order link only when an URL is provided', () => {
    assert.ok(!render({}).includes('🔗'));
    const withUrl = render({ orderUrl: 'https://admin.example/order/1' });
    assert.ok(withUrl.includes('<a href="https://admin.example/order/1">Замовлення</a>'));
  });
});
