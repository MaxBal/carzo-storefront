/**
 * Checkout payment option — a recorded intent, never a payment.
 * Shared mapping for checkout UI, Supabase, Telegram and keyCRM.
 */
export const PAYMENT_OPTION_VALUES = ['prepayment_200', 'full'] as const;

export type PaymentOption = typeof PAYMENT_OPTION_VALUES[number];

export const PAYMENT_OPTION_LABELS: Record<PaymentOption, string> = {
  prepayment_200: 'Передоплата 200 ₴',
  full: 'Повна оплата',
};

export const DEFAULT_PAYMENT_OPTION: PaymentOption = 'prepayment_200';

export function isPaymentOption(value: unknown): value is PaymentOption {
  return typeof value === 'string' && (PAYMENT_OPTION_VALUES as readonly string[]).includes(value);
}

/** Ukrainian label for notifications/CRM; null when no option was recorded. */
export function paymentOptionLabel(value: unknown): string | null {
  return isPaymentOption(value) ? PAYMENT_OPTION_LABELS[value] : null;
}
