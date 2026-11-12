import 'server-only';

import {
  formatOrderItemsSummary,
  type NotificationOrderItem,
} from '@/lib/cart/order-items-summary';
import { formatOrderDiscountsSummary } from '@/lib/cart/order-discounts-summary';
import { formatOrderNotificationHtml } from '@/lib/cart/order-notification-message';
import { resolveOrderStoreBackend } from '@/lib/data/config';
import {
  getNotificationSettingsRepository,
  resolveNotificationSettingsBackend,
  type NotificationSettings as RepositoryNotificationSettings,
  type TelegramCredentials,
} from '@/lib/data/notifications';
import { resolveTelegramRecipients } from '@/lib/data/notifications/recipients';

type NotificationChannel = 'off' | 'email' | 'telegram' | 'both';

interface NotificationSettings {
  channel: NotificationChannel;
  directusUserIds: string[];
  telegramChatIds: string[];
  subjectTemplate: string;
  messageTemplate: string;
}

interface TelegramBotSettings {
  chatIds: string[];
  token: string;
}

export interface NewOrderNotification {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  contactMethod: string;
  /** Payment terms label ("Передоплата 200 ₴" | "Повна оплата"); '' when not recorded. */
  paymentOption: string;
  /** Freeform buyer comment; shown in the notification only when present. */
  customerComment?: string;
  itemsQuantity: number;
  /** Authoritative quantity discount from server quote (0 when not applied). */
  quantityDiscount: number;
  /** Authoritative loyalty discount amount from server pricing (0 when not applied). */
  loyaltyDiscountAmount: number;
  total: number;
  deliveryMethod: string;
  deliveryCity: string;
  deliveryDestination: string;
  items: NotificationOrderItem[];
}

export interface NewCarMatQuoteNotification {
  customerName: string;
  customerPhone: string;
  carModel: string;
  carYear: string;
  bodyType: string;
  interest: string;
  contactMethod: string;
  comment: string;
}

const VALID_CHANNELS = new Set<NotificationChannel>(['off', 'email', 'telegram', 'both']);

function directusConfig() {
  const url = process.env.DIRECTUS_URL?.trim().replace(/\/$/, '');
  const token = process.env.DIRECTUS_READ_TOKEN?.trim();
  if (!url || !token) throw new Error('Directus notification delivery is not configured');
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

async function readSettings(): Promise<NotificationSettings> {
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
  if (!response.ok) throw new Error(`Directus notification settings failed: ${response.status}`);
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
}

async function readTelegramBotSettings(): Promise<TelegramBotSettings> {
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
}

function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/{{\s*([a-z_]+)\s*}}/gi, (_, key: string) => variables[key] ?? '');
}

/**
 * Custom templates may predate `{{payment_option}}`.
 * When the token is absent and an option was recorded, insert the line
 * after the `Адреса:` line (or append at the end).
 */
const PAYMENT_OPTION_TOKEN = /\{\{\s*payment_option\s*\}\}/i;

/** Exported for tests. */
export function applyPaymentOptionFallback(
  template: string,
  rendered: string,
  paymentOption: string,
): string {
  if (!paymentOption || PAYMENT_OPTION_TOKEN.test(template)) return rendered;
  const line = `Варіант оплати: ${paymentOption}`;
  const lines = rendered.split('\n');
  const addressIndex = lines.findIndex((entry) => /^\s*Адреса\s*:/i.test(entry));
  if (addressIndex >= 0) {
    lines.splice(addressIndex + 1, 0, line);
    return lines.join('\n');
  }
  return `${rendered}\n${line}`;
}

function renderedMessage(settings: NotificationSettings, order: NewOrderNotification, orderUrl: string) {
  const discountsSummary = formatOrderDiscountsSummary({
    quantityDiscount: order.quantityDiscount,
    loyaltyDiscountAmount: order.loyaltyDiscountAmount,
  });
  const variables = {
    order_number: order.orderNumber,
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    contact_method: order.contactMethod,
    items_quantity: String(order.itemsQuantity),
    items_summary: formatOrderItemsSummary(order.items),
    discounts_summary: discountsSummary,
    quantity_discount: order.quantityDiscount > 0 ? String(Math.trunc(order.quantityDiscount)) : '',
    loyalty_discount: order.loyaltyDiscountAmount > 0 ? String(Math.trunc(order.loyaltyDiscountAmount)) : '',
    total: String(order.total),
    payment_option: order.paymentOption,
    delivery_method: order.deliveryMethod,
    delivery_city: order.deliveryCity,
    delivery_destination: order.deliveryDestination,
    // Existing custom templates can keep using this token for all delivery methods.
    delivery_point: order.deliveryDestination,
    order_url: orderUrl,
  };
  return {
    subject: renderTemplate(settings.subjectTemplate, variables).trim().slice(0, 255),
    message: formatOrderNotificationHtml({ ...order, orderUrl }).trim().slice(0, 4_000),
    orderUrl,
  };
}

async function sendDirectusMessage(
  settings: NotificationSettings,
  subject: string,
  message: string,
  context?: { collection: string; item: string },
) {
  if (settings.directusUserIds.length === 0) {
    throw new Error('Directus email recipients are not configured');
  }
  const { url, token } = directusConfig();
  const response = await fetchWithTimeout(`${url}/notifications`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(settings.directusUserIds.map(recipient => ({
      recipient,
      subject,
      message,
      ...(context ? { collection: context.collection, item: context.item } : {}),
    }))),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Directus email notification failed: ${response.status}`);
}

async function sendTelegramToChatIds(
  token: string,
  chatIds: string[],
  text: string,
  parseMode?: 'HTML',
) {
  try {
    await Promise.all(chatIds.map(async (chatId) => {
      const response = await fetchWithTimeout(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
          ...(parseMode ? { parse_mode: parseMode } : {}),
        }),
        cache: 'no-store',
      });
      const payload = await response.json() as { ok?: boolean; description?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.description || `Telegram notification failed: ${response.status}`);
      }
    }));
  } catch (error) {
    throw new Error(safeErrorMessage(error, [token]));
  }
}

async function sendTelegram(
  settings: NotificationSettings,
  subject: string,
  message: string,
  orderUrl?: string,
  parseMode?: 'HTML',
) {
  const botSettings = await readTelegramBotSettings();
  const token = botSettings.token || process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatIds = botSettings.chatIds.length > 0
    ? botSettings.chatIds
    : settings.telegramChatIds;
  if (!token) throw new Error('Telegram bot token is not configured');
  if (chatIds.length === 0) throw new Error('Telegram chat recipients are not configured');
  const suffix = orderUrl && !message.includes(orderUrl) ? `\n\n${orderUrl}` : '';
  // HTML order messages are self-contained (header + link); plain messages
  // keep the legacy subject prefix and URL suffix.
  const text = (parseMode === 'HTML'
    ? message
    : `${subject}\n\n${message}${suffix}`).slice(0, 4_000);
  await sendTelegramToChatIds(token, chatIds, text, parseMode);
}

function safeErrorMessage(error: unknown, extraSecrets: string[] = []) {
  const secrets = [process.env.TELEGRAM_BOT_TOKEN?.trim(), ...extraSecrets].filter(Boolean) as string[];
  const message = error instanceof Error ? error.message : 'Unknown notification error';
  return secrets
    .reduce((safeMessage, secret) => safeMessage.replaceAll(secret, '[redacted]'), message)
    .slice(0, 240);
}

export async function notifyNewOrder(order: NewOrderNotification) {
  if (resolveOrderStoreBackend() === 'supabase') {
    return notifyNewOrderSupabase(order);
  }
  try {
    const settings = await readSettings();
    if (settings.channel === 'off') return;
    const { url } = directusConfig();
    const orderUrl = `${url}/admin/content/carzo_orders/${encodeURIComponent(order.id)}`;
    const { subject, message } = renderedMessage(settings, order, orderUrl);
    const deliveries: Array<{ channel: 'email' | 'telegram'; task: Promise<void> }> = [];
    if (settings.channel === 'email' || settings.channel === 'both') {
      deliveries.push({
        channel: 'email',
        task: sendDirectusMessage(settings, subject, message, {
          collection: 'carzo_orders',
          item: order.id,
        }),
      });
    }
    if (settings.channel === 'telegram' || settings.channel === 'both') {
      deliveries.push({
        channel: 'telegram',
        task: sendTelegram(settings, subject, message, orderUrl, 'HTML'),
      });
    }
    const results = await Promise.allSettled(deliveries.map(item => item.task));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error('Order notification delivery failed', {
          orderId: order.id,
          channel: deliveries[index]?.channel,
          error: safeErrorMessage(result.reason),
        });
      }
    });
  } catch (error) {
    console.error('Order notification setup failed', {
      orderId: order.id,
      error: safeErrorMessage(error),
    });
  }
}

/**
 * Supabase-order notification path.
 * Settings/templates/chat IDs from notification_settings (Supabase reader);
 * bot token only from server-side TELEGRAM_BOT_TOKEN. No Directus inbox, no
 * Directus bot-token table, no Directus admin URL.
 * Channel email/both has no email provider on this path — Telegram-only
 * delivery plus an explicit UNSUPPORTED log; never claim emails sent.
 */
async function notifyNewOrderSupabase(order: NewOrderNotification) {
  try {
    const repository = getNotificationSettingsRepository();
    const settings = await repository.readSettings();
    if (settings.channel === 'off') return;

    if (settings.channel === 'email' || settings.channel === 'both') {
      console.error('Order notification email channel unsupported on Supabase path', {
        orderId: order.id,
        channel: settings.channel,
      });
    }
    if (settings.channel === 'email') return;

    const { message } = renderedMessage(settings, order, '');
    const credentials = await repository.readTelegramCredentials();
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || credentials.token;
    // Preview/development must send only to TELEGRAM_TEST_CHAT_IDS; a missing
    // or unusable value blocks the send rather than falling back to the shared
    // work chats. Production routing is unchanged.
    const recipients = resolveTelegramRecipients({
      vercelEnv: process.env.VERCEL_ENV,
      testChatIdsRaw: process.env.TELEGRAM_TEST_CHAT_IDS,
      settingsChatIds: settings.telegramChatIds,
      credentialsChatIds: credentials.chatIds,
    });
    if (!token) {
      console.error('Order notification telegram token missing on Supabase path', {
        orderId: order.id,
      });
      return;
    }
    if (!recipients.ok) {
      console.error('Order notification telegram recipients blocked on Supabase path', {
        orderId: order.id,
        reason: recipients.reason,
      });
      return;
    }
    await sendTelegramToChatIds(token, recipients.chatIds, message.slice(0, 4_000), 'HTML');
  } catch (error) {
    console.error('Order notification setup failed', {
      orderId: order.id,
      error: safeErrorMessage(error),
    });
  }
}

const CARMAT_QUOTE_SUBJECT = 'Новий запит на прорахунок автокилимків';

/**
 * Quote message format is shared by the Directus and Supabase delivery paths
 * and must stay stable — managers parse these lines.
 */
function carMatQuoteMessage(request: NewCarMatQuoteNotification): string {
  return [
    `Покупець: ${request.customerName}`,
    `Телефон: ${request.customerPhone}`,
    `Авто: ${request.carModel}`,
    `Рік випуску: ${request.carYear}`,
    `Тип кузова: ${request.bodyType}`,
    `Цікавить: ${request.interest}`,
    `Спосіб звʼязку: ${request.contactMethod}`,
    request.comment ? `Коментар: ${request.comment}` : '',
  ].filter(Boolean).join('\n').slice(0, 3_500);
}

export interface CarMatQuoteDeliveryDeps {
  settings: RepositoryNotificationSettings;
  credentials: TelegramCredentials;
  /** Env subset: TELEGRAM_BOT_TOKEN / VERCEL_ENV / TELEGRAM_TEST_CHAT_IDS. */
  env: Record<string, string | undefined>;
  sendTelegramText: (token: string, chatIds: string[], text: string) => Promise<void>;
}

/**
 * Delivery core for the Supabase notification path. Settings from Supabase,
 * bot token from server env only, recipients guarded by resolveTelegramRecipients
 * (non-production sends only to TELEGRAM_TEST_CHAT_IDS). No Directus access.
 * Returns true only when a Telegram message was handed to the sender without
 * throwing; every failure path returns false and never leaks the token.
 */
export async function deliverCarMatQuoteViaTelegram(
  request: NewCarMatQuoteNotification,
  deps: CarMatQuoteDeliveryDeps,
): Promise<boolean> {
  const { settings, credentials, env, sendTelegramText } = deps;
  if (settings.channel === 'off') return false;

  if (settings.channel === 'email' || settings.channel === 'both') {
    console.error('Car mat quote notification email channel unsupported on Supabase path', {
      channel: settings.channel,
    });
  }
  if (settings.channel === 'email') return false;

  const token = env.TELEGRAM_BOT_TOKEN?.trim() || credentials.token;
  const recipients = resolveTelegramRecipients({
    vercelEnv: env.VERCEL_ENV,
    testChatIdsRaw: env.TELEGRAM_TEST_CHAT_IDS,
    settingsChatIds: settings.telegramChatIds,
    credentialsChatIds: credentials.chatIds,
  });
  if (!token) {
    console.error('Car mat quote notification telegram token missing on Supabase path');
    return false;
  }
  if (!recipients.ok) {
    console.error('Car mat quote notification telegram recipients blocked on Supabase path', {
      reason: recipients.reason,
    });
    return false;
  }

  const text = `${CARMAT_QUOTE_SUBJECT}\n\n${carMatQuoteMessage(request)}`.slice(0, 4_000);
  try {
    await sendTelegramText(token, recipients.chatIds, text);
    return true;
  } catch (error) {
    console.error('Car mat quote notification delivery failed', {
      channel: 'telegram',
      error: safeErrorMessage(error, [token]),
    });
    return false;
  }
}

/**
 * Supabase-car-mat-quote notification path (NOTIFICATION_SETTINGS_STORE=supabase).
 * Settings/templates/chat IDs from the Supabase notification reader; bot token
 * only from server-side TELEGRAM_BOT_TOKEN. Zero Directus requests.
 */
async function notifyNewCarMatQuoteSupabase(
  request: NewCarMatQuoteNotification,
): Promise<boolean> {
  try {
    const repository = getNotificationSettingsRepository();
    const [settings, credentials] = await Promise.all([
      repository.readSettings(),
      repository.readTelegramCredentials(),
    ]);
    return await deliverCarMatQuoteViaTelegram(request, {
      settings,
      credentials,
      env: process.env,
      sendTelegramText: sendTelegramToChatIds,
    });
  } catch (error) {
    console.error('Car mat quote notification setup failed', {
      error: safeErrorMessage(error),
    });
    return false;
  }
}

export async function notifyNewCarMatQuote(request: NewCarMatQuoteNotification) {
  if (resolveNotificationSettingsBackend() === 'supabase') {
    return notifyNewCarMatQuoteSupabase(request);
  }

  // Legacy Directus path — Production until the Stage 9 cutover.
  const settings = await readSettings();
  if (settings.channel === 'off') return false;

  const subject = CARMAT_QUOTE_SUBJECT;
  const message = carMatQuoteMessage(request);

  const deliveries: Array<{ channel: 'email' | 'telegram'; task: Promise<void> }> = [];
  if (settings.channel === 'email' || settings.channel === 'both') {
    deliveries.push({
      channel: 'email',
      task: sendDirectusMessage(settings, subject, message),
    });
  }
  if (settings.channel === 'telegram' || settings.channel === 'both') {
    deliveries.push({
      channel: 'telegram',
      task: sendTelegram(settings, subject, message),
    });
  }

  const results = await Promise.allSettled(deliveries.map(item => item.task));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error('Car mat quote notification delivery failed', {
        channel: deliveries[index]?.channel,
        error: safeErrorMessage(result.reason),
      });
    }
  });

  return results.some(result => result.status === 'fulfilled');
}
