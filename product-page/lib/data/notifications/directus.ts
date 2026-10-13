import 'server-only';

import type {
  NotificationChannel,
  NotificationSettings,
  NotificationSettingsRepository,
  TelegramCredentials,
} from './types';
import { NotificationSettingsError } from './types';

const VALID_CHANNELS = new Set<NotificationChannel>(['off', 'email', 'telegram', 'both']);

function directusConfig() {
  const url = process.env.DIRECTUS_URL?.trim().replace(/\/$/, '');
  const token = process.env.DIRECTUS_READ_TOKEN?.trim();
  if (!url || !token) {
    throw new NotificationSettingsError('Directus notification delivery is not configured', 'CONFIG');
  }
  return { url, token };
}

function stringList(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value
      .map(item => String(item).trim())
      .filter(Boolean)));
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  return Array.from(new Set(value.split(',').map(item => item.trim()).filter(Boolean)));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Directus notification settings — preserves current rollback path including
 * directus_user_ids and bot_token in Directus.
 */
export function createDirectusNotificationSettingsRepository(): NotificationSettingsRepository {
  return {
    async readSettings(): Promise<NotificationSettings> {
      const { url, token } = directusConfig();
      const fields = [
        'channel',
        'directus_user_ids',
        'telegram_chat_ids',
        'subject_template',
        'message_template',
      ].join(',');
      const response = await fetchWithTimeout(
        `${url}/items/carzo_notification_settings?fields=${encodeURIComponent(fields)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
      );
      if (!response.ok) {
        throw new NotificationSettingsError(
          `Directus notification settings failed: ${response.status}`,
          'UNAVAILABLE',
        );
      }
      const payload = await response.json() as { data?: Record<string, unknown> };
      const data = payload.data || {};
      const rawChannel = typeof data.channel === 'string' ? data.channel : 'off';
      const channel = VALID_CHANNELS.has(rawChannel as NotificationChannel)
        ? rawChannel as NotificationChannel
        : 'off';
      return {
        channel,
        directusUserIds: stringList(data.directus_user_ids)
          .filter(value => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)),
        telegramChatIds: stringList(data.telegram_chat_ids)
          .filter(value => /^-?\d+$/.test(value)),
        subjectTemplate: typeof data.subject_template === 'string'
          ? data.subject_template
          : 'Нове замовлення {{order_number}}',
        messageTemplate: typeof data.message_template === 'string'
          ? data.message_template
          : 'Покупець: {{customer_name}}\nТелефон: {{customer_phone}}\nСпосіб зв’язку: {{contact_method}}\nТовари:\n{{items_summary}}\nКількість: {{items_quantity}}\n{{discounts_summary}}\nСума: {{total}} ₴\nДоставка: {{delivery_method}}\nАдреса: {{delivery_city}}, {{delivery_destination}}\n{{order_url}}',
      };
    },

    async readTelegramCredentials(): Promise<TelegramCredentials> {
      const { url, token } = directusConfig();
      const fields = ['chat_ids', 'bot_token'].join(',');
      const response = await fetchWithTimeout(
        `${url}/items/carzo_telegram_bot_settings?fields=${encodeURIComponent(fields)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
      );
      if (!response.ok) return { chatIds: [], token: '' };
      const payload = await response.json() as { data?: Record<string, unknown> };
      const data = payload.data || {};
      return {
        chatIds: stringList(data.chat_ids).filter(value => /^-?\d+$/.test(value)),
        token: typeof data.bot_token === 'string' ? data.bot_token.trim() : '',
      };
    },
  };
}
