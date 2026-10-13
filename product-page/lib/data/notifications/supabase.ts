import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/server';
import type {
  NotificationChannel,
  NotificationSettings,
  NotificationSettingsRepository,
  TelegramCredentials,
} from './types';
import { NotificationSettingsError } from './types';

const VALID_CHANNELS = new Set<NotificationChannel>(['off', 'email', 'telegram', 'both']);

function stringList(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value
      .map(item => String(item).trim())
      .filter(Boolean)));
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  return Array.from(new Set(value.split(',').map(item => item.trim()).filter(Boolean)));
}

/**
 * Supabase notification settings reader — SELECT-only.
 * Reads channel, templates, telegram_chat_ids. Never reads directus_user_ids
 * or a bot token from the database. Telegram token comes from TELEGRAM_BOT_TOKEN.
 */
export function createSupabaseNotificationSettingsRepository(): NotificationSettingsRepository {
  return {
    async readSettings(): Promise<NotificationSettings> {
      const { data, error } = await getSupabaseAdminClient()
        .from('notification_settings')
        .select('channel,subject_template,message_template,telegram_chat_ids')
        .limit(1);
      if (error) {
        throw new NotificationSettingsError(
          `Supabase notification settings read failed: ${error.message}`,
          'UNAVAILABLE',
        );
      }
      const row = (data ?? [])[0] as Record<string, unknown> | undefined;
      const rawChannel = typeof row?.channel === 'string' ? row.channel : 'off';
      const channel = VALID_CHANNELS.has(rawChannel as NotificationChannel)
        ? rawChannel as NotificationChannel
        : 'off';

      return {
        channel,
        directusUserIds: [],
        telegramChatIds: stringList(row?.telegram_chat_ids)
          .filter(value => /^-?\d+$/.test(value)),
        subjectTemplate: typeof row?.subject_template === 'string'
          ? row.subject_template
          : 'Нове замовлення {{order_number}}',
        messageTemplate: typeof row?.message_template === 'string'
          ? row.message_template
          : 'Покупець: {{customer_name}}\nТелефон: {{customer_phone}}\nСпосіб зв’язку: {{contact_method}}\nТовари:\n{{items_summary}}\nКількість: {{items_quantity}}\n{{discounts_summary}}\nСума: {{total}} ₴\nДоставка: {{delivery_method}}\nАдреса: {{delivery_city}}, {{delivery_destination}}\n{{order_url}}',
      };
    },

    async readTelegramCredentials(): Promise<TelegramCredentials> {
      const { data, error } = await getSupabaseAdminClient()
        .from('notification_settings')
        .select('telegram_chat_ids')
        .limit(1);
      if (error) {
        throw new NotificationSettingsError(
          `Supabase notification settings read failed: ${error.message}`,
          'UNAVAILABLE',
        );
      }
      const row = (data ?? [])[0] as Record<string, unknown> | undefined;
      return {
        chatIds: stringList(row?.telegram_chat_ids).filter(value => /^-?\d+$/.test(value)),
        token: process.env.TELEGRAM_BOT_TOKEN?.trim() || '',
      };
    },
  };
}
