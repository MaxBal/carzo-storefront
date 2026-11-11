import 'server-only';

/**
 * Car-mat quote delivery — dedicated Telegram bot (@carzoplus_bot) into the
 * "Carzo Коврики" group. Fully isolated from the order-notification path:
 * uses only TELEGRAM_CARMAT_BOT_TOKEN / TELEGRAM_CARMAT_CHAT_ID, touches no
 * Directus/Supabase settings and never the order bot credentials.
 */

export interface CarMatQuoteTelegramRequest {
  customerName: string;
  customerPhone: string;
  carModel: string;
  carYear: string;
  bodyType: string;
  interest: string;
  contactMethod: string;
  comment: string;
  /** Labels of the chosen "photos of finished work" options; empty = none. */
  photoLabels: string[];
  /** Labels of the chosen care/materials info options; empty = none. */
  informationLabels: string[];
  requestedAt: Date;
}

export interface CarMatQuoteTelegramDeps {
  env: Record<string, string | undefined>;
  sendTelegramText: (token: string, chatId: string, text: string) => Promise<void>;
}

export function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatKyivDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')}, ${get('hour')}:${get('minute')}`;
}

function photoLine(labels: string[]): string {
  if (labels.length === 0) return 'Ні';
  return `Так — ${labels.join(', ')}`;
}

export function formatCarMatQuoteTelegramText(request: CarMatQuoteTelegramRequest): string {
  const lines: string[] = [
    '🚘 <b>НОВА ЗАЯВКА — АВТОКИЛИМКИ CARZO</b>',
    '',
    `🚗 Автомобіль: ${escapeTelegramHtml(request.carModel)}`,
    `📅 Рік випуску: ${escapeTelegramHtml(request.carYear)}`,
    `🚙 Тип кузова: ${escapeTelegramHtml(request.bodyType)}`,
    '',
    `📋 Цікавить: ${escapeTelegramHtml(request.interest)}`,
    '',
    `💬 Спосіб звʼязку: ${escapeTelegramHtml(request.contactMethod)}`,
    `👤 Контакт: ${escapeTelegramHtml(request.customerName)}, ${escapeTelegramHtml(request.customerPhone)}`,
    '',
    `📷 Фото виконаних робіт: ${escapeTelegramHtml(photoLine(request.photoLabels))}`,
  ];

  if (request.informationLabels.length > 0) {
    lines.push(
      `ℹ️ Детально про догляд та матеріали: ${escapeTelegramHtml(request.informationLabels.join(', '))}`,
    );
  }

  if (request.comment) {
    lines.push('', '📝 Коментар:', escapeTelegramHtml(request.comment));
  }

  lines.push('', `🕒 Дата: ${formatKyivDateTime(request.requestedAt)}`);

  return lines.join('\n').slice(0, 4_000);
}

function safeErrorMessage(error: unknown, secrets: string[] = []) {
  const message = error instanceof Error ? error.message : 'Unknown notification error';
  return secrets
    .filter(Boolean)
    .reduce((safe, secret) => safe.replaceAll(secret, '[redacted]'), message)
    .slice(0, 240);
}

/**
 * Delivery core with injected env/sender. Returns true only when the Telegram
 * message was handed to the sender without throwing. Never logs the token.
 */
export async function deliverCarMatQuoteTelegram(
  request: CarMatQuoteTelegramRequest,
  deps: CarMatQuoteTelegramDeps,
): Promise<boolean> {
  const token = deps.env.TELEGRAM_CARMAT_BOT_TOKEN?.trim();
  const chatId = deps.env.TELEGRAM_CARMAT_CHAT_ID?.trim();
  if (!token || !chatId) {
    console.error('Car mat quote telegram config missing', {
      hasToken: Boolean(token),
      hasChatId: Boolean(chatId),
    });
    return false;
  }

  const text = formatCarMatQuoteTelegramText(request);
  try {
    await deps.sendTelegramText(token, chatId, text);
    return true;
  } catch (error) {
    console.error('Car mat quote telegram delivery failed', {
      error: safeErrorMessage(error, [token]),
    });
    return false;
  }
}

async function sendTelegramHtml(token: string, chatId: string, text: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json() as { ok?: boolean; description?: string };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.description || `Telegram notification failed: ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendCarMatQuoteTelegram(
  request: CarMatQuoteTelegramRequest,
): Promise<boolean> {
  return deliverCarMatQuoteTelegram(request, {
    env: process.env,
    sendTelegramText: sendTelegramHtml,
  });
}
