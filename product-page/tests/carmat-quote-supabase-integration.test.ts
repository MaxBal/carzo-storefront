/**
 * Stage 9 pre-cutover integration check: the car-mat quote notification path
 * must make ZERO Directus requests when NOTIFICATION_SETTINGS_STORE=supabase.
 * Real Supabase SELECTs (settings), Telegram HTTP is intercepted locally —
 * no message is ever sent to a real chat. Run with --env-file=.env.local.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { notifyNewCarMatQuote } from '../lib/order-notifications';

const DIRECTUS_SENTINEL = 'https://directus-sentinel.invalid';

const REQUEST = {
  customerName: 'Інтеграційний тест',
  customerPhone: '+380500000000',
  carModel: 'Тест',
  carYear: '2020',
  bodyType: 'Тест',
  interest: 'Тест',
  contactMethod: 'Телефон',
  comment: 'не надсилати',
};

describe('car mat quote — Supabase path makes no Directus requests', () => {
  const fetchLog: string[] = [];
  const telegramLog: Array<{ chatId: string; text: string }> = [];
  let realFetch: typeof globalThis.fetch;

  before(() => {
    assert.ok(process.env.SUPABASE_URL?.trim(), 'SUPABASE_URL must be set');
    assert.ok(process.env.SUPABASE_SECRET_KEY?.trim(), 'SUPABASE_SECRET_KEY must be set');
    process.env.NOTIFICATION_SETTINGS_STORE = 'supabase';
    process.env.ORDER_STORE = 'supabase';
    process.env.DIRECTUS_URL = DIRECTUS_SENTINEL;
    process.env.DIRECTUS_READ_TOKEN = 'must-never-be-used';
    process.env.TELEGRAM_BOT_TOKEN = 'integration-test-token';
    process.env.VERCEL_ENV = 'preview';
    process.env.TELEGRAM_TEST_CHAT_IDS = '-1005555555555';

    realFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      fetchLog.push(url);
      if (url.includes('api.telegram.org')) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        telegramLog.push({ chatId: String(body.chat_id ?? ''), text: String(body.text ?? '') });
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return realFetch(input, init);
    }) as typeof globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = realFetch;
  });

  it('quote submission performs zero Directus requests', async () => {
    fetchLog.length = 0;
    const delivered = await notifyNewCarMatQuote(REQUEST);
    const directusHits = fetchLog.filter(url => url.includes('directus-sentinel'));
    assert.deepEqual(directusHits, [], `unexpected Directus requests: ${directusHits.join(', ')}`);
    assert.ok(fetchLog.every(url =>
      url.includes('supabase') || url.includes('api.telegram.org'),
    ), `unexpected hosts: ${fetchLog.join(', ')}`);
    // Whatever the live channel value is, the outcome is boolean and no throw.
    assert.equal(typeof delivered, 'boolean');
  });

  it('when the live channel sends telegram, it is intercepted and routed to the test chat only', async () => {
    fetchLog.length = 0;
    telegramLog.length = 0;
    const delivered = await notifyNewCarMatQuote(REQUEST);
    if (delivered) {
      assert.ok(telegramLog.length > 0, 'delivered=true but no telegram send was attempted');
      for (const entry of telegramLog) {
        assert.equal(entry.chatId, '-1005555555555', 'test-chat routing violated');
        assert.ok(entry.text.startsWith('Новий запит на прорахунок автокилимків'));
      }
    }
    assert.deepEqual(fetchLog.filter(url => url.includes('directus-sentinel')), []);
  });

  it('telegram failure surfaces as delivered=false without touching Directus', async () => {
    const failingFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      fetchLog.push(url);
      if (url.includes('api.telegram.org')) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: false, description: 'down' }), { status: 500 }),
        );
      }
      return realFetch(input, init);
    }) as typeof globalThis.fetch;
    globalThis.fetch = failingFetch;
    try {
      fetchLog.length = 0;
      const delivered = await notifyNewCarMatQuote(REQUEST);
      assert.equal(typeof delivered, 'boolean');
      if (delivered) {
        // channel off short-circuits before any send — false is expected when a send fails
        assert.fail('telegram 500 must not report delivered=true');
      }
      assert.deepEqual(fetchLog.filter(url => url.includes('directus-sentinel')), []);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
