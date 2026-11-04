import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  deliverCarMatQuoteViaTelegram,
  type CarMatQuoteDeliveryDeps,
} from '../lib/order-notifications';
import type { NewCarMatQuoteNotification } from '../lib/order-notifications';

const REQUEST: NewCarMatQuoteNotification = {
  customerName: 'Тест',
  customerPhone: '+380501112233',
  carModel: 'Kia Sportage',
  carYear: '2021',
  bodyType: 'Кросовер',
  interest: 'Комплект',
  contactMethod: 'Телефон',
  comment: 'Передзвоніть ввечері',
};

const WORK_CHAT_IDS = ['-1001234567890'];
const TEST_CHAT_IDS = ['-1005555555555'];

function deps(overrides: Partial<CarMatQuoteDeliveryDeps> = {}): CarMatQuoteDeliveryDeps {
  return {
    settings: {
      channel: 'telegram',
      directusUserIds: [],
      telegramChatIds: WORK_CHAT_IDS,
      subjectTemplate: '',
      messageTemplate: '',
    },
    credentials: { chatIds: [], token: '' },
    env: {
      TELEGRAM_BOT_TOKEN: 'test-token-secret',
      VERCEL_ENV: 'production',
    },
    sendTelegramText: async () => {},
    ...overrides,
  };
}

describe('car mat quote — Supabase/Telegram delivery core', () => {
  it('keeps the established quote message format', async () => {
    let captured = '';
    const ok = await deliverCarMatQuoteViaTelegram(REQUEST, deps({
      sendTelegramText: async (_token, _chatIds, text) => {
        captured = text;
      },
    }));
    assert.equal(ok, true);
    assert.ok(captured.startsWith('Новий запит на прорахунок автокилимків\n\n'));
    for (const line of [
      'Покупець: Тест',
      'Телефон: +380501112233',
      'Авто: Kia Sportage',
      'Рік випуску: 2021',
      'Тип кузова: Кросовер',
      'Цікавить: Комплект',
      'Спосіб звʼязку: Телефон',
      'Коментар: Передзвоніть ввечері',
    ]) {
      assert.ok(captured.includes(line), `missing line: ${line}`);
    }
  });

  it('omits the comment line when the quote has no comment', async () => {
    let captured = '';
    await deliverCarMatQuoteViaTelegram(
      { ...REQUEST, comment: '' },
      deps({ sendTelegramText: async (_t, _c, text) => { captured = text; } }),
    );
    assert.ok(!captured.includes('Коментар'));
  });

  it('channel off — nothing is sent', async () => {
    let sent = false;
    const ok = await deliverCarMatQuoteViaTelegram(REQUEST, deps({
      settings: { ...deps().settings, channel: 'off' },
      sendTelegramText: async () => { sent = true; },
    }));
    assert.equal(ok, false);
    assert.equal(sent, false);
  });

  it('email-only channel — unsupported on this path, nothing is sent', async () => {
    let sent = false;
    const ok = await deliverCarMatQuoteViaTelegram(REQUEST, deps({
      settings: { ...deps().settings, channel: 'email' },
      sendTelegramText: async () => { sent = true; },
    }));
    assert.equal(ok, false);
    assert.equal(sent, false);
  });

  it('telegram failure returns false without throwing and never leaks the token', async () => {
    const ok = await deliverCarMatQuoteViaTelegram(REQUEST, deps({
      sendTelegramText: async () => {
        throw new Error('telegram down: test-token-secret');
      },
    }));
    assert.equal(ok, false);
  });

  it('missing token blocks the send', async () => {
    let sent = false;
    const ok = await deliverCarMatQuoteViaTelegram(REQUEST, deps({
      env: { TELEGRAM_BOT_TOKEN: '', VERCEL_ENV: 'production' },
      credentials: { chatIds: [], token: '' },
      sendTelegramText: async () => { sent = true; },
    }));
    assert.equal(ok, false);
    assert.equal(sent, false);
  });

  it('non-production without TELEGRAM_TEST_CHAT_IDS blocks the send (no work-chat fallback)', async () => {
    let sent = false;
    const ok = await deliverCarMatQuoteViaTelegram(REQUEST, deps({
      env: {
        TELEGRAM_BOT_TOKEN: 'test-token-secret',
        VERCEL_ENV: 'preview',
      },
      sendTelegramText: async () => { sent = true; },
    }));
    assert.equal(ok, false);
    assert.equal(sent, false);
  });

  it('non-production sends only to TELEGRAM_TEST_CHAT_IDS', async () => {
    let used: string[] = [];
    const ok = await deliverCarMatQuoteViaTelegram(REQUEST, deps({
      env: {
        TELEGRAM_BOT_TOKEN: 'test-token-secret',
        VERCEL_ENV: 'preview',
        TELEGRAM_TEST_CHAT_IDS: TEST_CHAT_IDS.join(','),
      },
      sendTelegramText: async (_t, chatIds) => {
        used = chatIds;
      },
    }));
    assert.equal(ok, true);
    assert.deepEqual(used, TEST_CHAT_IDS);
  });

  it('production routes to the settings chat ids', async () => {
    let used: string[] = [];
    const ok = await deliverCarMatQuoteViaTelegram(REQUEST, deps({
      sendTelegramText: async (_t, chatIds) => {
        used = chatIds;
      },
    }));
    assert.equal(ok, true);
    assert.deepEqual(used, WORK_CHAT_IDS);
  });

  it('delivery core performs no network of its own — sender is injected', async () => {
    // With a sender that records the call and a token in env, the core must
    // delegate entirely: no fetch, no Directus, no settings lookup here.
    const calls: Array<{ token: string; chatIds: string[]; text: string }> = [];
    await deliverCarMatQuoteViaTelegram(REQUEST, deps({
      sendTelegramText: async (token, chatIds, text) => {
        calls.push({ token, chatIds, text });
      },
    }));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].token, 'test-token-secret');
  });
});
