/**
 * Server-authoritative loyalty + order total resolution for checkout.
 * Pure enough to unit-test: customer lookup is injected.
 */

import { normalizeCustomerPhone } from './customer-phone';
import {
  LOYALTY_DISCOUNT_PERCENT,
  calculateLoyaltyDiscount,
  type LoyaltyDiscountResult,
} from './loyalty-math';
import type { CartQuote } from './types';

export interface LoyaltyPricingState {
  /** Loyalty discount is part of the authoritative total. */
  applied: boolean;
  eligible: boolean;
  discountPercent: number;
  discountAmount: number;
  /** Canonical loyalty phone when a lookup phone was supplied. */
  loyaltyPhone: string | null;
  /** Canonical checkout phone. */
  customerPhone: string | null;
  /** Loyalty phone present but does not match the checkout phone (or is invalid). */
  phoneMismatch: boolean;
}

export interface AuthoritativePricing {
  quote: CartQuote;
  loyalty: LoyaltyPricingState;
  /** quote.total without loyalty. */
  baseTotal: number;
  /** Server-computed final order total. */
  total: number;
  discount: LoyaltyDiscountResult;
}

export type PricingChangeCode = 'PRICE_CHANGED' | 'LOYALTY_CHANGED';

export type ResolveLoyaltyOutcome =
  | { ok: true; loyalty: LoyaltyPricingState }
  | { ok: false; code: 'LOYALTY_UNAVAILABLE'; message: string };

export type CheckoutPricingOutcome =
  | { ok: true; pricing: AuthoritativePricing }
  | {
    ok: false;
    code: PricingChangeCode;
    message: string;
    pricing: AuthoritativePricing;
  }
  | { ok: false; code: 'LOYALTY_UNAVAILABLE'; message: string };

export type CustomerLookup = (canonicalPhone: string) => Promise<unknown | null>;

export const PRICE_CHANGED_MESSAGE =
  'Ціна змінилася. Ми оновили суму — перевірте її та підтвердьте замовлення ще раз.';
export const LOYALTY_CHANGED_MESSAGE =
  'Умови знижки постійного клієнта змінилися. Ми оновили суму — перевірте її та підтвердьте замовлення ще раз.';
export const LOYALTY_UNAVAILABLE_MESSAGE =
  'Не вдалося перевірити знижку постійного клієнта. Спробуйте ще раз.';

/**
 * Resolve loyalty eligibility server-side.
 * - No loyalty phone → no discount (loyalty is opt-in via lookup phone).
 * - Loyalty phone != customer phone → no discount (phoneMismatch).
 * - Match → customer-store lookup; store failure is infrastructure error, never ineligible.
 */
export async function resolveLoyaltyState(input: {
  customerPhone: string;
  loyaltyPhone?: string | null;
  subtotal: number;
  quantityDiscount: number;
  lookup: CustomerLookup;
}): Promise<ResolveLoyaltyOutcome> {
  const customerPhone = normalizeCustomerPhone(input.customerPhone);
  const rawLoyaltyPhone = input.loyaltyPhone?.trim() ? input.loyaltyPhone : null;
  const loyaltyPhone = rawLoyaltyPhone ? normalizeCustomerPhone(rawLoyaltyPhone) : null;

  if (!rawLoyaltyPhone) {
    return {
      ok: true,
      loyalty: {
        applied: false,
        eligible: false,
        discountPercent: 0,
        discountAmount: 0,
        loyaltyPhone: null,
        customerPhone,
        phoneMismatch: false,
      },
    };
  }

  if (!loyaltyPhone || !customerPhone || loyaltyPhone !== customerPhone) {
    return {
      ok: true,
      loyalty: {
        applied: false,
        eligible: false,
        discountPercent: 0,
        discountAmount: 0,
        loyaltyPhone,
        customerPhone,
        phoneMismatch: true,
      },
    };
  }

  let customer: unknown | null;
  try {
    customer = await input.lookup(loyaltyPhone);
  } catch {
    return {
      ok: false,
      code: 'LOYALTY_UNAVAILABLE',
      message: LOYALTY_UNAVAILABLE_MESSAGE,
    };
  }

  const eligible = Boolean(customer);
  const discountPercent = eligible ? LOYALTY_DISCOUNT_PERCENT : 0;
  const discount = calculateLoyaltyDiscount({
    subtotal: input.subtotal,
    quantityDiscount: input.quantityDiscount,
    discountPercent,
  });

  return {
    ok: true,
    loyalty: {
      applied: discountPercent > 0,
      eligible,
      discountPercent,
      discountAmount: discount.amount,
      loyaltyPhone,
      customerPhone,
      phoneMismatch: false,
    },
  };
}

function matchesStandardLoyaltyTotal(baseTotal: number, expectedTotal: number): boolean {
  const preview = calculateLoyaltyDiscount({
    subtotal: baseTotal,
    quantityDiscount: 0,
    discountPercent: LOYALTY_DISCOUNT_PERCENT,
  });
  return preview.discountedTotal === expectedTotal;
}

/**
 * Classify a confirmed-total mismatch.
 * PRICE_CHANGED = underlying quote differs from what the client confirmed.
 * LOYALTY_CHANGED = base quote matches (or loyalty state alone diverged).
 */
export function classifyPricingMismatch(input: {
  baseTotal: number;
  discountAmount: number;
  expectedTotal: number;
  expectedBaseTotal?: number | null;
}): PricingChangeCode {
  const { baseTotal, discountAmount, expectedTotal } = input;
  const expectedBaseTotal = input.expectedBaseTotal;

  if (expectedBaseTotal !== null && expectedBaseTotal !== undefined) {
    if (expectedBaseTotal !== baseTotal) return 'PRICE_CHANGED';
    return 'LOYALTY_CHANGED';
  }

  // Fallback without explicit base confirmation.
  if (discountAmount === 0) {
    // Server has no loyalty. A total equal to base−5% means the client still had a discount.
    if (matchesStandardLoyaltyTotal(baseTotal, expectedTotal)) return 'LOYALTY_CHANGED';
    return 'PRICE_CHANGED';
  }

  // Server applies loyalty. Client confirmed the undiscounted base → gained discount.
  if (expectedTotal === baseTotal) return 'LOYALTY_CHANGED';
  return 'PRICE_CHANGED';
}

export function buildAuthoritativePricing(input: {
  quote: CartQuote;
  loyalty: LoyaltyPricingState;
}): AuthoritativePricing {
  const discount = calculateLoyaltyDiscount({
    subtotal: input.quote.subtotal,
    quantityDiscount: input.quote.quantityDiscount,
    discountPercent: input.loyalty.discountPercent,
  });
  return {
    quote: input.quote,
    loyalty: {
      ...input.loyalty,
      discountAmount: discount.amount,
      applied: input.loyalty.discountPercent > 0,
    },
    baseTotal: discount.baseTotal,
    total: discount.discountedTotal,
    discount,
  };
}

/**
 * Full server pricing gate for checkout.
 * Never trusts client discount percent/amount/total as authority — only compares.
 */
export async function resolveCheckoutPricing(input: {
  quote: CartQuote;
  customerPhone: string;
  loyaltyPhone?: string | null;
  expectedTotal: number;
  expectedBaseTotal?: number | null;
  lookup: CustomerLookup;
}): Promise<CheckoutPricingOutcome> {
  const loyaltyOutcome = await resolveLoyaltyState({
    customerPhone: input.customerPhone,
    loyaltyPhone: input.loyaltyPhone,
    subtotal: input.quote.subtotal,
    quantityDiscount: input.quote.quantityDiscount,
    lookup: input.lookup,
  });
  if (!loyaltyOutcome.ok) return loyaltyOutcome;

  const pricing = buildAuthoritativePricing({
    quote: input.quote,
    loyalty: loyaltyOutcome.loyalty,
  });

  if (pricing.total === input.expectedTotal) {
    // Explicit base confirmation still guards against coincidental total matches.
    if (
      input.expectedBaseTotal !== null
      && input.expectedBaseTotal !== undefined
      && input.expectedBaseTotal !== pricing.baseTotal
    ) {
      return {
        ok: false,
        code: 'PRICE_CHANGED',
        message: PRICE_CHANGED_MESSAGE,
        pricing,
      };
    }
    return { ok: true, pricing };
  }

  const code = classifyPricingMismatch({
    baseTotal: pricing.baseTotal,
    discountAmount: pricing.discount.amount,
    expectedTotal: input.expectedTotal,
    expectedBaseTotal: input.expectedBaseTotal,
  });

  return {
    ok: false,
    code,
    message: code === 'PRICE_CHANGED' ? PRICE_CHANGED_MESSAGE : LOYALTY_CHANGED_MESSAGE,
    pricing,
  };
}

/**
 * Pricing gate used by checkout. `onReady` runs only for a confirmed authoritative total —
 * persistence side effects must live inside `onReady` so change/error paths cannot write orders.
 */
export async function withCheckoutPricing<T>(input: {
  quote: CartQuote;
  customerPhone: string;
  loyaltyPhone?: string | null;
  expectedTotal: number;
  expectedBaseTotal?: number | null;
  lookup: CustomerLookup;
  onBlocked: (outcome: Exclude<CheckoutPricingOutcome, { ok: true }>) => T;
  onReady: (pricing: AuthoritativePricing) => Promise<T> | T;
}): Promise<T> {
  const outcome = await resolveCheckoutPricing({
    quote: input.quote,
    customerPhone: input.customerPhone,
    loyaltyPhone: input.loyaltyPhone,
    expectedTotal: input.expectedTotal,
    expectedBaseTotal: input.expectedBaseTotal,
    lookup: input.lookup,
  });
  if (!outcome.ok) return input.onBlocked(outcome);
  return input.onReady(outcome.pricing);
}
