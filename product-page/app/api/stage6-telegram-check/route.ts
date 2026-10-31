import { resolveTelegramRecipients } from '@/lib/data/notifications/recipients';

export const dynamic = 'force-dynamic';

/**
 * TEMPORARY Stage 6 Telegram acceptance probe. Deleted immediately after use.
 *
 * Gated three ways:
 *   1. Vercel Deployment Protection (not reachable without the automation bypass)
 *   2. `VERCEL_ENV === 'preview'` — never active outside Preview
 *   3. one-time nonce in `x-stage6-nonce`, compared against STAGE6_CHECK_NONCE
 *      which lives only in a temporary Preview env var removed after the check
 *
 * The send runs only when `getMe` confirms the runtime bot token is valid.
 * Nothing is written to Supabase or Directus, no orders are created, and no
 * secret is emitted — only masked chat references and booleans.
 */

function hidden() {
  return new Response(null, { status: 404 });
}

function mask(value: string): string {
  const s = String(value);
  return s.length <= 6 ? '***' : `${s.slice(0, 4)}***${s.slice(-2)}`;
}

function nonceMatches(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

const CONTROL_TEXT = [
  'TEST — Stage 6 Telegram acceptance',
  '',
  'Контрольне повідомлення перевірки маршрутизації сповіщень.',
  'Реальних замовлень і клієнтів не створювались. Персональні дані відсутні.',
  'Отримувачі: лише затверджені TELEGRAM_TEST_CHAT_IDS.',
  'Середовище: Preview.',
].join('\n');

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== 'preview') return hidden();

  const expected = process.env.STAGE6_CHECK_NONCE?.trim() ?? '';
  const provided = request.headers.get('x-stage6-nonce')?.trim() ?? '';
  if (expected.length < 16 || !nonceMatches(expected, provided)) return hidden();

  let diagnoseOnly = false;
  try {
    const body = await request.json() as { diagnose?: unknown };
    diagnoseOnly = body?.diagnose === true;
  } catch {
    diagnoseOnly = false;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
  const diagnostics = {
    token_present: token.length > 0,
    token_length: token.length,
    token_shape_ok: /^\d+:[A-Za-z0-9_-]{20,}$/.test(token),
    token_has_stray_quotes_or_space: /["'\s]/.test(token),
    telegram_getMe_ok: false as boolean,
    telegram_getMe_status: null as number | null,
  };
  if (token) {
    try {
      const me = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: 'no-store' });
      diagnostics.telegram_getMe_status = me.status;
      const mePayload = await me.json() as { ok?: boolean };
      diagnostics.telegram_getMe_ok = mePayload.ok === true;
    } catch {
      diagnostics.telegram_getMe_status = null;
    }
  }

  if (diagnoseOnly) {
    return Response.json(
      { mode: 'diagnose', environment: process.env.VERCEL_ENV, ...diagnostics },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Sending is strictly conditional on a valid runtime bot token.
  if (!token || !diagnostics.telegram_getMe_ok) {
    return Response.json(
      { error: 'telegram token not accepted by getMe', ...diagnostics },
      { status: 503 },
    );
  }

  // Recipients come from TELEGRAM_TEST_CHAT_IDS alone. The shared
  // notification_settings list is deliberately not consulted outside
  // production, so a test send can never reach another destination.
  const decision = resolveTelegramRecipients({
    vercelEnv: process.env.VERCEL_ENV,
    testChatIdsRaw: process.env.TELEGRAM_TEST_CHAT_IDS,
    settingsChatIds: [],
    credentialsChatIds: [],
  });
  if (!decision.ok || decision.chatIds.length === 0) {
    return Response.json(
      { error: 'recipients blocked', reason: decision.ok ? 'NO_RECIPIENTS' : decision.reason, ...diagnostics },
      { status: 503 },
    );
  }

  const results: Array<{ chat: string; status: number; ok: boolean; messageId: unknown; errorDescription?: string }> = [];
  for (const chatId of decision.chatIds) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          chat_id: chatId,
          text: CONTROL_TEXT,
          disable_web_page_preview: true,
        }),
        cache: 'no-store',
      });
      const payload = await response.json() as {
        ok?: boolean;
        description?: string;
        result?: { message_id?: unknown };
      };
      results.push({
        chat: mask(chatId),
        status: response.status,
        ok: payload.ok === true,
        messageId: payload.result?.message_id ?? null,
        ...(payload.ok === true ? {} : { errorDescription: (payload.description ?? '').slice(0, 80) }),
      });
    } catch {
      results.push({ chat: mask(chatId), status: 0, ok: false, messageId: null, errorDescription: 'request failed' });
    }
  }

  return Response.json(
    {
      environment: process.env.VERCEL_ENV,
      recipientCount: decision.chatIds.length,
      delivered: results.filter(r => r.ok).length,
      results,
      ...diagnostics,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET() {
  return hidden();
}
