export type TelegramRecipientDecision =
  | { ok: true; chatIds: string[] }
  | { ok: false; reason: 'TEST_RECIPIENTS_UNAVAILABLE' | 'NO_RECIPIENTS' };

function parseChatIds(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return Array.from(new Set(raw
    .split(',')
    .map(value => value.trim())
    .filter(value => /^-?\d+$/.test(value))));
}

/**
 * Resolve Telegram recipients for the Supabase notification path.
 *
 * Production keeps the historical routing from the shared
 * `notification_settings` row. Every non-production environment must use
 * `TELEGRAM_TEST_CHAT_IDS` alone: it fully replaces the shared recipients and
 * a missing/empty/unusable value blocks the send instead of falling back to
 * the work chats. Recipients are returned for delivery only and must never be
 * logged.
 */
export function resolveTelegramRecipients(input: {
  vercelEnv: string | undefined;
  testChatIdsRaw: string | undefined;
  settingsChatIds: string[];
  credentialsChatIds: string[];
}): TelegramRecipientDecision {
  if (input.vercelEnv === 'production') {
    const chatIds = input.settingsChatIds.length > 0
      ? input.settingsChatIds
      : input.credentialsChatIds;
    return chatIds.length > 0
      ? { ok: true, chatIds }
      : { ok: false, reason: 'NO_RECIPIENTS' };
  }

  const testChatIds = parseChatIds(input.testChatIdsRaw);
  return testChatIds.length > 0
    ? { ok: true, chatIds: testChatIds }
    : { ok: false, reason: 'TEST_RECIPIENTS_UNAVAILABLE' };
}
