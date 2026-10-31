import 'server-only';

/**
 * Notification settings backend selection reuses CONTENT_STORE-adjacent
 * operational config via CUSTOMER_STORE-style flags. For Stage 4 the
 * notification settings reader follows ORDER_STORE-side delivery config
 * and is selected by the same directus/supabase semantics through env.
 *
 * Default remains the existing Directus path (rollback compatible).
 */
export type NotificationSettingsBackend = 'directus' | 'supabase';

import { DataStoreConfigError } from '../config';
import { createDirectusNotificationSettingsRepository } from './directus';
import { createSupabaseNotificationSettingsRepository } from './supabase';
import type { NotificationSettingsRepository } from './types';

export type {
  NotificationChannel,
  NotificationSettings,
  NotificationSettingsRepository,
  TelegramCredentials,
} from './types';
export { NotificationSettingsError } from './types';

/**
 * Explicit backend for notification settings. Uses NOTIFICATION_SETTINGS_STORE
 * when set; otherwise follows ORDER_STORE (same operational plane as order delivery).
 */
export function resolveNotificationSettingsBackend(
  env: NodeJS.ProcessEnv = process.env,
): NotificationSettingsBackend {
  const raw = env.NOTIFICATION_SETTINGS_STORE?.trim().toLowerCase()
    || env.ORDER_STORE?.trim().toLowerCase();
  if (!raw) return 'directus';
  if (raw === 'directus' || raw === 'supabase') return raw;
  throw new DataStoreConfigError(
    'Invalid notification settings backend; expected "directus" or "supabase"',
  );
}

export function createNotificationSettingsRepository(
  backend: NotificationSettingsBackend,
): NotificationSettingsRepository {
  switch (backend) {
    case 'directus':
      return createDirectusNotificationSettingsRepository();
    case 'supabase':
      return createSupabaseNotificationSettingsRepository();
    default: {
      const exhaustive: never = backend;
      throw new Error(`Unsupported notification settings backend: ${String(exhaustive)}`);
    }
  }
}

export function getNotificationSettingsRepository(): NotificationSettingsRepository {
  return createNotificationSettingsRepository(resolveNotificationSettingsBackend());
}
