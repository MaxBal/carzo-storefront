import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveTelegramRecipients } from '../lib/data/notifications/recipients';

/** Shared-work-chat ids from notification_settings — never a test recipient. */
const WORK_CHAT_IDS = ['-1001234567890', '-1009876543210'];
const TEST_CHAT_IDS = ['-1005555555555'];

describe('telegram recipients — preview uses the test chat only', () => {
  it('routes preview to TELEGRAM_TEST_CHAT_IDS and nothing else', () => {
    const decision = resolveTelegramRecipients({
      vercelEnv: 'preview',
      testChatIdsRaw: TEST_CHAT_IDS.join(','),
      settingsChatIds: WORK_CHAT_IDS,
      credentialsChatIds: WORK_CHAT_IDS,
    });
    assert.equal(decision.ok, true);
    // Full replacement: the shared work chats must never be merged in.
    if (decision.ok) assert.deepEqual(decision.chatIds, TEST_CHAT_IDS);
  });

  it('does not merge test recipients with notification_settings recipients', () => {
    const decision = resolveTelegramRecipients({
      vercelEnv: 'preview',
      testChatIdsRaw: '-1005555555555',
      settingsChatIds: WORK_CHAT_IDS,
      credentialsChatIds: WORK_CHAT_IDS,
    });
    assert.equal(decision.ok, true);
    if (decision.ok) {
      for (const workId of WORK_CHAT_IDS) {
        assert.equal(decision.chatIds.includes(workId), false);
      }
    }
  });

  it('accepts several comma-separated test chat ids', () => {
    const decision = resolveTelegramRecipients({
      vercelEnv: 'preview',
      testChatIdsRaw: ' -1005555555555 , -1007777777777 ',
      settingsChatIds: [],
      credentialsChatIds: [],
    });
    assert.equal(decision.ok, true);
    if (decision.ok) assert.deepEqual(decision.chatIds, ['-1005555555555', '-1007777777777']);
  });

  it('deduplicates repeated test chat ids', () => {
    const decision = resolveTelegramRecipients({
      vercelEnv: 'preview',
      testChatIdsRaw: '-1005555555555,-1005555555555',
      settingsChatIds: [],
      credentialsChatIds: [],
    });
    assert.equal(decision.ok, true);
    if (decision.ok) assert.deepEqual(decision.chatIds, ['-1005555555555']);
  });
});

describe('telegram recipients — preview blocks instead of falling back', () => {
  it('blocks when TELEGRAM_TEST_CHAT_IDS is missing', () => {
    const decision = resolveTelegramRecipients({
      vercelEnv: 'preview',
      testChatIdsRaw: undefined,
      settingsChatIds: WORK_CHAT_IDS,
      credentialsChatIds: WORK_CHAT_IDS,
    });
    assert.deepEqual(decision, { ok: false, reason: 'TEST_RECIPIENTS_UNAVAILABLE' });
  });

  it('blocks when TELEGRAM_TEST_CHAT_IDS is empty or whitespace', () => {
    for (const raw of ['', '   ', ',' , ' , , ']) {
      const decision = resolveTelegramRecipients({
        vercelEnv: 'preview',
        testChatIdsRaw: raw,
        settingsChatIds: WORK_CHAT_IDS,
        credentialsChatIds: WORK_CHAT_IDS,
      });
      assert.deepEqual(decision, { ok: false, reason: 'TEST_RECIPIENTS_UNAVAILABLE' });
    }
  });

  it('blocks when TELEGRAM_TEST_CHAT_IDS is malformed', () => {
    for (const raw of ['abc', 'chat-1', '+100555', '12ab34', '1e9']) {
      const decision = resolveTelegramRecipients({
        vercelEnv: 'preview',
        testChatIdsRaw: raw,
        settingsChatIds: WORK_CHAT_IDS,
        credentialsChatIds: WORK_CHAT_IDS,
      });
      assert.deepEqual(decision, { ok: false, reason: 'TEST_RECIPIENTS_UNAVAILABLE' });
    }
  });

  it('never falls back to the shared work chats on preview', () => {
    // Work chat ids are present but must be ignored entirely.
    const decision = resolveTelegramRecipients({
      vercelEnv: 'preview',
      testChatIdsRaw: undefined,
      settingsChatIds: WORK_CHAT_IDS,
      credentialsChatIds: WORK_CHAT_IDS,
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.equal(decision.reason, 'TEST_RECIPIENTS_UNAVAILABLE');
  });

  it('applies the same rule to development and to an unset environment', () => {
    for (const vercelEnv of ['development', undefined]) {
      const decision = resolveTelegramRecipients({
        vercelEnv,
        testChatIdsRaw: undefined,
        settingsChatIds: WORK_CHAT_IDS,
        credentialsChatIds: WORK_CHAT_IDS,
      });
      assert.equal(decision.ok, false);
    }
  });
});

describe('telegram recipients — production routing unchanged', () => {
  it('keeps using notification_settings recipients on production', () => {
    const decision = resolveTelegramRecipients({
      vercelEnv: 'production',
      testChatIdsRaw: TEST_CHAT_IDS.join(','),
      settingsChatIds: WORK_CHAT_IDS,
      credentialsChatIds: ['-1000000000000'],
    });
    assert.equal(decision.ok, true);
    if (decision.ok) assert.deepEqual(decision.chatIds, WORK_CHAT_IDS);
  });

  it('ignores TELEGRAM_TEST_CHAT_IDS on production even if it is set', () => {
    const decision = resolveTelegramRecipients({
      vercelEnv: 'production',
      testChatIdsRaw: TEST_CHAT_IDS.join(','),
      settingsChatIds: WORK_CHAT_IDS,
      credentialsChatIds: [],
    });
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.chatIds.includes(TEST_CHAT_IDS[0]), false);
      assert.deepEqual(decision.chatIds, WORK_CHAT_IDS);
    }
  });

  it('falls back to credential chat ids when settings has none (historical order)', () => {
    const decision = resolveTelegramRecipients({
      vercelEnv: 'production',
      testChatIdsRaw: undefined,
      settingsChatIds: [],
      credentialsChatIds: ['-1000000000000'],
    });
    assert.equal(decision.ok, true);
    if (decision.ok) assert.deepEqual(decision.chatIds, ['-1000000000000']);
  });

  it('reports NO_RECIPIENTS on production when nothing is configured', () => {
    const decision = resolveTelegramRecipients({
      vercelEnv: 'production',
      testChatIdsRaw: undefined,
      settingsChatIds: [],
      credentialsChatIds: [],
    });
    assert.deepEqual(decision, { ok: false, reason: 'NO_RECIPIENTS' });
  });
});
