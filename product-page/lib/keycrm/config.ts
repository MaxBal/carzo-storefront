/**
 * keyCRM integration configuration (server-only env).
 * Values live in Vercel secrets / .env.local — never log them.
 */

function trimmed(value: string | undefined): string | null {
  const result = value?.trim();
  return result ? result : null;
}

export interface KeyCrmConfig {
  apiKey: string | null;
  /** keyCRM source "Сайт Carzo". */
  sourceId: number | null;
  /** keyCRM delivery service "Нова Пошта". */
  deliveryServiceId: number | null;
  /** Custom order field "Cпосіб зв'язку" (select). */
  contactMethodFieldUuid: string | null;
  /** Order status meaning "buyer received the goods". Owner-defined. */
  completedStatusId: number | null;
  /** Static secret checked on the inbound webhook URL. */
  webhookSecret: string | null;
  /** Master switch for pushing site orders to keyCRM. Default off. */
  syncEnabled: boolean;
}

function intOrNull(value: string | undefined): number | null {
  const raw = value?.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function readKeyCrmConfig(env: NodeJS.ProcessEnv = process.env): KeyCrmConfig {
  return {
    apiKey: trimmed(env.KEYCRM_API_KEY),
    sourceId: intOrNull(env.KEYCRM_SOURCE_ID),
    deliveryServiceId: intOrNull(env.KEYCRM_DELIVERY_SERVICE_ID),
    contactMethodFieldUuid: trimmed(env.KEYCRM_CUSTOM_FIELD_CONTACT_METHOD_UUID),
    completedStatusId: intOrNull(env.KEYCRM_COMPLETED_STATUS_ID),
    webhookSecret: trimmed(env.KEYCRM_WEBHOOK_SECRET),
    syncEnabled: env.KEYCRM_SYNC_ENABLED?.trim().toLowerCase() === 'true',
  };
}

/** Outbound order sync is allowed only with a complete config and the flag on. */
export function isKeyCrmSyncEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const config = readKeyCrmConfig(env);
  return Boolean(
    config.syncEnabled
    && config.apiKey
    && config.sourceId
    && config.deliveryServiceId,
  );
}
