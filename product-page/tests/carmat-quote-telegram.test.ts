import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  deliverCarMatQuoteTelegram,
  formatCarMatQuoteTelegramText,
  type CarMatQuoteTelegramDeps,
  type CarMatQuoteTelegramRequest,
} from '../lib/carmat-quote/notifications';

const REQUEST: CarMatQuoteTelegramRequest = {
  customerName: 'Олена Тест',
  customerPhone: '+380501112233',
  carModel: 'Volkswagen Passat B8',
  carYear: '2018',
  bodyType: 'Універсал',
  interest: 'Килимки в салон',
  contactMethod: 'Telegram',
  comment: 'Потрібні килимки в салон.',
  photoLabels: ['Усі дизайни'],
  informationLabels: [],
  requestedAt: new Date('2026-11-11T16:50:00Z'),
};

function deps(overrides: Partial<CarMatQuoteTelegramDeps> = {}): CarMatQuoteTelegramDeps {
  return {
    env: {
      TELEGRAM_CARMAT_BOT_TOKEN: 'carmat-token-secret',
      TELEGRAM_CARMAT_CHAT_ID: '-1005353419581',
    },
    sendTelegramText: async () => {},
    ...overrides,
  };
}

describe('car mat quote — telegram message format', () => {
  it('contains every submitted field with Ukrainian labels', () => {
    const text = formatCarMatQuoteTelegramText(REQUEST);
    for (const line of [
      'НОВА ЗАЯВКА — АВТОКИЛИМКИ CARZO',
      '🚗 Автомобіль: Volkswagen Passat B8',
      '📅 Рік випуску: 2018',
      '🚙 Тип кузова: Універсал',
      '📋 Цікавить: Килимки в салон',
      '💬 Спосіб звʼязку: Telegram',
      '👤 Контакт: Олена Тест, +380501112233',
      '📷 Фото виконаних робіт: Так — Усі дизайни',
      '📝 Коментар:',
      'Потрібні килимки в салон.',
    ]) {
      assert.ok(text.includes(line), `missing line: ${line}`);
    }
  });

  it('formats the request timestamp in Kyiv time as DD.MM.YYYY, HH:mm', () => {
    const text = formatCarMatQuoteTelegramText(REQUEST);
    assert.ok(/🕒 Дата: 11\.11\.2026, 1[89]:50/.test(text), `bad date line: ${text}`);
  });

  it('omits the comment block when the comment is empty', () => {
    const text = formatCarMatQuoteTelegramText({ ...REQUEST, comment: '' });
    assert.ok(!text.includes('Коментар'));
    assert.ok(!text.includes('Потрібні килимки'));
  });

  it('reports "Ні" for photos when nothing is selected', () => {
    const text = formatCarMatQuoteTelegramText({ ...REQUEST, photoLabels: [] });
    assert.ok(text.includes('📷 Фото виконаних робіт: Ні'));
  });

  it('lists chosen photo labels', () => {
    const text = formatCarMatQuoteTelegramText({
      ...REQUEST,
      photoLabels: ['Carzo 2.0 (подовжений ромб)', 'Carzo 3.0 (Сота)'],
    });
    assert.ok(text.includes('📷 Фото виконаних робіт: Так — Carzo 2.0 (подовжений ромб), Carzo 3.0 (Сота)'));
  });

  it('omits the care/materials line when nothing is selected', () => {
    const text = formatCarMatQuoteTelegramText({ ...REQUEST, informationLabels: [] });
    assert.ok(!text.includes('Детально про догляд'));
  });

  it('includes the care/materials line when selected', () => {
    const text = formatCarMatQuoteTelegramText({
      ...REQUEST,
      informationLabels: ['Як доглядати за килимками'],
    });
    assert.ok(text.includes('ℹ️ Детально про догляд та матеріали: Як доглядати за килимками'));
  });

  it('escapes user input for Telegram HTML', () => {
    const text = formatCarMatQuoteTelegramText({
      ...REQUEST,
      carModel: '<b>Passat</b> & <script>',
      comment: 'A & B <i>',
    });
    assert.ok(text.includes('🚗 Автомобіль: &lt;b&gt;Passat&lt;/b&gt; &amp; &lt;script&gt;'));
    assert.ok(text.includes('A &amp; B &lt;i&gt;'));
    assert.ok(!text.includes('<script>'));
    assert.ok(!text.includes('<i>'));
  });
});

describe('car mat quote — telegram delivery core', () => {
  it('delivers to the configured carmat chat only and returns true', async () => {
    const calls: Array<{ token: string; chatId: string; text: string }> = [];
    const ok = await deliverCarMatQuoteTelegram(REQUEST, deps({
      sendTelegramText: async (token, chatId, text) => {
        calls.push({ token, chatId, text });
      },
    }));
    assert.equal(ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].chatId, '-1005353419581');
    assert.equal(calls[0].token, 'carmat-token-secret');
  });

  it('missing token blocks the send', async () => {
    let sent = false;
    const ok = await deliverCarMatQuoteTelegram(REQUEST, deps({
      env: { TELEGRAM_CARMAT_CHAT_ID: '-1005353419581' },
      sendTelegramText: async () => { sent = true; },
    }));
    assert.equal(ok, false);
    assert.equal(sent, false);
  });

  it('missing chat id blocks the send', async () => {
    let sent = false;
    const ok = await deliverCarMatQuoteTelegram(REQUEST, deps({
      env: { TELEGRAM_CARMAT_BOT_TOKEN: 'carmat-token-secret' },
      sendTelegramText: async () => { sent = true; },
    }));
    assert.equal(ok, false);
    assert.equal(sent, false);
  });

  it('delivery failure returns false, does not throw, and never leaks the token', async () => {
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' '));
    };
    try {
      const ok = await deliverCarMatQuoteTelegram(REQUEST, deps({
        sendTelegramText: async () => {
          throw new Error('telegram down: carmat-token-secret');
        },
      }));
      assert.equal(ok, false);
    } finally {
      console.error = originalError;
    }
    const logged = errors.join('\n');
    assert.ok(!logged.includes('carmat-token-secret'), 'token leaked into logs');
    assert.ok(logged.includes('[redacted]'));
  });

  it('reads credentials from process.env via sendCarMatQuoteTelegram (fetch contract)', async () => {
    process.env.TELEGRAM_CARMAT_BOT_TOKEN = 'fetch-token-secret';
    process.env.TELEGRAM_CARMAT_CHAT_ID = '-1005353419581';

    const realFetch = globalThis.fetch;
    const seen: Array<{ url: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      seen.push({ url, body: init?.body ? JSON.parse(String(init.body)) : {} });
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    }) as typeof globalThis.fetch;

    try {
      const { sendCarMatQuoteTelegram } = await import('../lib/carmat-quote/notifications');
      const ok = await sendCarMatQuoteTelegram(REQUEST);
      assert.equal(ok, true);
      assert.equal(seen.length, 1);
      assert.ok(seen[0].url.includes('api.telegram.org/botfetch-token-secret/sendMessage'));
      assert.equal(seen[0].body.chat_id, '-1005353419581');
      assert.equal(seen[0].body.parse_mode, 'HTML');
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.TELEGRAM_CARMAT_BOT_TOKEN;
      delete process.env.TELEGRAM_CARMAT_CHAT_ID;
    }
  });
});
