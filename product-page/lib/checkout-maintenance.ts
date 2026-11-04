/**
 * Server-side checkout maintenance switch for the Stage 8B → Stage 9 window.
 *
 * `CHECKOUT_MAINTENANCE=1` (or `true`/`on`) blocks order submission and car-mat
 * quote submission at the server-action boundary — before any customer/order
 * write, before any notification. Browsing, catalog and cart editing stay up.
 * Unset/empty keeps checkout enabled (Production default).
 */
export function isCheckoutMaintenance(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.CHECKOUT_MAINTENANCE?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on';
}

export const CHECKOUT_MAINTENANCE_MESSAGE =
  'Оформлення замовлень тимчасово недоступне — ми оновлюємо систему. Кошик збережено: спробуйте за кілька хвилин або напишіть нам у месенджер.';

export const QUOTE_MAINTENANCE_MESSAGE =
  'Прийом заявок тимчасово недоступний — ми оновлюємо систему. Спробуйте за кілька хвилин або напишіть нам у месенджер.';
