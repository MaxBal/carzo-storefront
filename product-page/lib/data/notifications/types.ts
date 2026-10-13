export type NotificationChannel = 'off' | 'email' | 'telegram' | 'both';

export interface NotificationSettings {
  channel: NotificationChannel;
  /**
   * Directus-only legacy inbox recipients.
   * Always empty on the Supabase path (IDs do not exist there).
   */
  directusUserIds: string[];
  telegramChatIds: string[];
  subjectTemplate: string;
  messageTemplate: string;
}

export interface TelegramCredentials {
  chatIds: string[];
  /** Bot token is never stored in the DB on the Supabase path. */
  token: string;
}

export interface NotificationSettingsRepository {
  readSettings(): Promise<NotificationSettings>;
  /**
   * Telegram routing + token. Supabase path: token from TELEGRAM_BOT_TOKEN env only.
   * Does not send messages.
   */
  readTelegramCredentials(): Promise<TelegramCredentials>;
}

export class NotificationSettingsError extends Error {
  readonly code: 'CONFIG' | 'UNAVAILABLE' | 'UNSUPPORTED';

  constructor(message: string, code: 'CONFIG' | 'UNAVAILABLE' | 'UNSUPPORTED') {
    super(message);
    this.name = 'NotificationSettingsError';
    this.code = code;
  }
}
