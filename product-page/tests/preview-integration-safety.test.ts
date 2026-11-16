import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createDirectusOrderRepository } from '../lib/data/orders/directus';
import type { OrderSnapshot } from '../lib/data/orders/types';
import { notifyNewOrder, notifyNewCarMatQuote, type NewOrderNotification } from '../lib/order-notifications';
import { deliverCarMatQuoteTelegram, type CarMatQuoteTelegramRequest } from '../lib/carmat-quote/notifications';

const snapshot: OrderSnapshot = {
  checkoutAttemptId: null, requestFingerprint: null,
  customerName: 'Synthetic buyer', customerPhone: '+380501112233', customerComment: null,
  contactMethod: 'phone', paymentOption: null, deliveryMethod: 'BRANCH',
  deliveryCityRef: 'synthetic-city', deliveryCityName: 'Synthetic city',
  deliveryPointRef: 'synthetic-point', deliveryPointNumber: '1', deliveryPointName: 'Synthetic point',
  deliveryPointAddress: 'Synthetic address', deliveryPointType: 'branch',
  deliveryStreetRef: null, deliveryStreetName: null, deliveryStreetType: null,
  deliveryHouse: null, deliveryApartment: null,
  itemsQuantity: 1, subtotal: 100, quantityDiscount: 0, total: 100,
  discountTierKey: null, managerNote: null,
  loyalty: { loyaltyPhone: null, eligible: false, discountPercent: 0, discountAmount: 0, phoneMismatch: false },
  items: [{ sort: 1, itemKey: 'synthetic', title: 'Synthetic item', designSlug: '2-0', designLabel: 'Synthetic design',
    sizeCode: 'M', sizeLabel: 'M', brandSlug: 'none', brandName: 'None', fixationKey: 'none', fixationLabel: 'None',
    unitPrice: 100, quantity: 1, lineTotal: 100, quantityDiscountEligible: true }],
};
const order: NewOrderNotification = { id: 'synthetic', orderNumber: 'CZ-SYNTHETIC',
  customerName: snapshot.customerName, customerPhone: snapshot.customerPhone, contactMethod: 'Phone', paymentOption: '',
  itemsQuantity: 1, quantityDiscount: 0, loyaltyDiscountAmount: 0, total: 100,
  deliveryMethod: 'Branch', deliveryCity: 'Synthetic city', deliveryDestination: 'Synthetic point', items: [] };
const quote = { customerName: snapshot.customerName, customerPhone: snapshot.customerPhone,
  carModel: 'Synthetic car', carYear: '2020', bodyType: 'Synthetic', interest: 'Synthetic', contactMethod: 'Phone', comment: '' };
const carmat: CarMatQuoteTelegramRequest = { ...quote, photoLabels: [], informationLabels: [], requestedAt: new Date(0) };

describe('legacy integrations fail closed outside explicit Vercel production', () => {
  const keys = ['VERCEL_ENV', 'NODE_ENV', 'DIRECTUS_URL', 'DIRECTUS_READ_TOKEN', 'ORDER_STORE', 'NOTIFICATION_SETTINGS_STORE', 'TELEGRAM_TEST_CHAT_IDS'] as const;
  let saved: Array<string | undefined>;
  let originalFetch: typeof fetch;
  let calls: Array<{ url: string; method: string }>;
  beforeEach(() => {
    saved = keys.map(k => process.env[k]); originalFetch = globalThis.fetch; calls = [];
    process.env.DIRECTUS_URL = 'https://directus.invalid'; process.env.DIRECTUS_READ_TOKEN = 'synthetic-only';
    Object.assign(process.env, { NODE_ENV: 'production' }); // build/start is not evidence of a Production target
    delete process.env.ORDER_STORE; delete process.env.NOTIFICATION_SETTINGS_STORE;
    process.env.TELEGRAM_TEST_CHAT_IDS = '-999';
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input); calls.push({ url, method: init?.method ?? 'GET' });
      const data = url.includes('carzo_notification_settings')
        ? { channel: 'both', directus_user_ids: ['00000000-0000-4000-8000-000000000001'], telegram_chat_ids: ['-111'] }
        : { bot_token: 'synthetic-bot', chat_ids: ['-111'] };
      return new Response(JSON.stringify({ data, ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    keys.forEach((k, i) => { if (saved[i] === undefined) delete process.env[k]; else Object.assign(process.env, { [k]: saved[i] }); });
  });

  for (const env of ['preview', 'development', 'custom-staging', undefined]) {
    it(`blocks Directus orders and both legacy notification entry points with VERCEL_ENV=${env}`, async () => {
      if (env === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = env;
      await assert.rejects(() => createDirectusOrderRepository().createOrder(snapshot), /disabled outside Vercel Production/);
      assert.deepEqual(calls, [], 'no order POST');
    });
    it(`blocks legacy order/quote notifications before credentials are read with VERCEL_ENV=${env}`, async () => {
      if (env === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = env;
      await notifyNewOrder(order);
      assert.equal(await notifyNewCarMatQuote(quote), false);
      assert.deepEqual(calls, [], 'no Directus settings/credential read, email, Telegram or order POST');
    });
    it(`blocks dedicated carmat sender before send or diagnostics with VERCEL_ENV=${env}`, async () => {
      let sent = 0;
      const ok = await deliverCarMatQuoteTelegram(carmat, {
        env: { VERCEL_ENV: env, TELEGRAM_CARMAT_BOT_TOKEN: 'synthetic-bot', TELEGRAM_CARMAT_CHAT_ID: '-111' },
        sendTelegramText: async () => { sent += 1; throw new Error('must never reach sender'); },
      });
      assert.equal(ok, false); assert.equal(sent, 0); assert.deepEqual(calls, []);
    });
  }

  it('keeps explicit Production legacy writes and destinations (mocked)', async () => {
    process.env.VERCEL_ENV = 'production';
    const result = await createDirectusOrderRepository().createOrder(snapshot);
    assert.equal(result.created, true);
    await notifyNewOrder(order);
    assert.equal(await notifyNewCarMatQuote(quote), true);
    assert.equal(calls.filter(c => c.url === 'https://directus.invalid/items/carzo_orders' && c.method === 'POST').length, 1);
    assert.equal(calls.filter(c => c.url.endsWith('/notifications') && c.method === 'POST').length, 2);
    assert.equal(calls.filter(c => c.url.includes('/sendMessage') && c.method === 'POST').length, 2);
    let usedChat = '';
    assert.equal(await deliverCarMatQuoteTelegram(carmat, {
      env: { VERCEL_ENV: 'production', TELEGRAM_CARMAT_BOT_TOKEN: 'synthetic', TELEGRAM_CARMAT_CHAT_ID: '-111' },
      sendTelegramText: async (_token, chatId) => { usedChat = chatId; },
    }), true);
    assert.equal(usedChat, '-111');
  });
});
