import 'server-only';

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
  itemsQuantity: number;
  total: number;
  deliveryMethod: string;
  deliveryCity: string;
  deliveryDestination: string;
  items: Array<{ title: string; quantity: number; lineTotal: number }>;
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
      : 'Покупець: {{customer_name}}\nТелефон: {{customer_phone}}\nСпосіб зв’язку: {{contact_method}}\nСума: {{total}} ₴\nДоставка: {{delivery_method}}\nАдреса: {{delivery_city}}, {{delivery_destination}}\n{{order_url}}',
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

function renderedMessage(settings: NotificationSettings, order: NewOrderNotification) {
  const { url } = directusConfig();
  const orderUrl = `${url}/admin/content/carzo_orders/${encodeURIComponent(order.id)}`;
  const variables = {
    order_number: order.orderNumber,
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    contact_method: order.contactMethod,
    items_quantity: String(order.itemsQuantity),
    items_summary: order.items
      .map(item => `• ${item.title} × ${item.quantity} — ${item.lineTotal} ₴`)
      .join('\n'),
    total: String(order.total),
    delivery_method: order.deliveryMethod,
    delivery_city: order.deliveryCity,
    delivery_destination: order.deliveryDestination,
    // Existing custom templates can keep using this token for all delivery methods.
    delivery_point: order.deliveryDestination,
    order_url: orderUrl,
  };
  return {
    subject: renderTemplate(settings.subjectTemplate, variables).trim().slice(0, 255),
    message: renderTemplate(settings.messageTemplate, variables).trim().slice(0, 3_500),
    orderUrl,
  };
}

async function sendDirectusEmail(
  settings: NotificationSettings,
  order: NewOrderNotification,
  subject: string,
  message: string,
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
      collection: 'carzo_orders',
      item: order.id,
    }))),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Directus email notification failed: ${response.status}`);
}

async function sendTelegram(
  settings: NotificationSettings,
  subject: string,
  message: string,
  orderUrl: string,
) {
  const botSettings = await readTelegramBotSettings();
  const token = botSettings.token || process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatIds = botSettings.chatIds.length > 0
    ? botSettings.chatIds
    : settings.telegramChatIds;
  if (!token) throw new Error('Telegram bot token is not configured');
  if (chatIds.length === 0) throw new Error('Telegram chat recipients are not configured');
  const text = `${subject}\n\n${message}${message.includes(orderUrl) ? '' : `\n\n${orderUrl}`}`.slice(0, 4_000);
  try {
    await Promise.all(chatIds.map(async (chatId) => {
      const response = await fetchWithTimeout(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
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

function safeErrorMessage(error: unknown, extraSecrets: string[] = []) {
  const secrets = [process.env.TELEGRAM_BOT_TOKEN?.trim(), ...extraSecrets].filter(Boolean) as string[];
  const message = error instanceof Error ? error.message : 'Unknown notification error';
  return secrets
    .reduce((safeMessage, secret) => safeMessage.replaceAll(secret, '[redacted]'), message)
    .slice(0, 240);
}

export async function notifyNewOrder(order: NewOrderNotification) {
  try {
    const settings = await readSettings();
    if (settings.channel === 'off') return;
    const { subject, message, orderUrl } = renderedMessage(settings, order);
    const deliveries: Array<{ channel: 'email' | 'telegram'; task: Promise<void> }> = [];
    if (settings.channel === 'email' || settings.channel === 'both') {
      deliveries.push({
        channel: 'email',
        task: sendDirectusEmail(settings, order, subject, message),
      });
    }
    if (settings.channel === 'telegram' || settings.channel === 'both') {
      deliveries.push({
        channel: 'telegram',
        task: sendTelegram(settings, subject, message, orderUrl),
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
