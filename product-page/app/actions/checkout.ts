'use server';

import { headers } from 'next/headers';
import { checkoutSchema } from '@/lib/cart/validation';
import { CartQuoteError, quoteCartItems } from '@/lib/cart/server';
import {
  resolveNovaPoshtaCity,
  resolveNovaPoshtaPoint,
  resolveNovaPoshtaStreet,
} from '@/lib/nova-poshta';
import { notifyNewOrder } from '@/lib/order-notifications';
import { contactMethodLabel } from '@/lib/cart/contact-method';
import {
  findCustomerByPhone,
  normalizeCustomerPhone,
  upsertCustomerByPhone,
} from '@/lib/cart/customers';
import { withCheckoutPricing } from '@/lib/cart/checkout-pricing';
import { runPostOrderSideEffects, safeErrorDetail } from '@/lib/cart/checkout-reliability';
import { computeRequestFingerprint, isCheckoutAttemptId } from '@/lib/cart/checkout-attempt';
import { resolveOrderStoreBackend } from '@/lib/data/config';
import {
  OrderStoreError,
  createOrderRecord,
  findOrderByAttemptId,
} from '@/lib/data/orders';
import type { OrderSnapshot } from '@/lib/data/orders';
import type {
  CheckoutInput,
  CheckoutLoyaltyState,
  CheckoutResult,
  DeliveryMethod,
  NovaPoshtaPoint,
  NovaPoshtaStreet,
} from '@/lib/cart/types';

type ResolvedDelivery =
  | {
    method: 'BRANCH' | 'POSTOMAT';
    cityRef: string;
    cityName: string;
    point: NovaPoshtaPoint;
  }
  | {
    method: 'COURIER';
    cityRef: string;
    cityName: string;
    street: NovaPoshtaStreet;
    house: string;
    apartment: string | null;
  };

const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  BRANCH: 'У відділення',
  POSTOMAT: 'У поштомат',
  COURIER: 'Курʼєром',
};

const ATTEMPT_REUSED_MESSAGE =
  'Ця спроба оформлення вже використана для іншого замовлення. Перевірте дані та підтвердьте замовлення ще раз.';

// Same convention as app/api/customer-discount/check/route.ts.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_HITS = 20;
const rateHits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string) {
  const now = Date.now();
  const bucket = rateHits.get(ip);
  if (!bucket || bucket.resetAt < now) {
    rateHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_MAX_HITS;
}

async function clientIp(): Promise<string> {
  const headerList = await headers();
  return headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

async function resolveDelivery(delivery: CheckoutInput['delivery']): Promise<ResolvedDelivery> {
  if (delivery.method === 'BRANCH' || delivery.method === 'POSTOMAT') {
    const resolved = await resolveNovaPoshtaPoint(delivery.cityRef, delivery.pointRef, delivery.method);
    return { method: delivery.method, ...resolved };
  }

  const [city, street] = await Promise.all([
    resolveNovaPoshtaCity(delivery.cityRef),
    resolveNovaPoshtaStreet(delivery.cityRef, delivery.streetRef),
  ]);
  return {
    method: 'COURIER',
    ...city,
    street,
    house: delivery.house.trim(),
    apartment: delivery.apartment?.trim() || null,
  };
}

function deliveryDestination(delivery: ResolvedDelivery) {
  if (delivery.method !== 'COURIER') return delivery.point.name;
  const street = [delivery.street.type, delivery.street.name].filter(Boolean).join(' ');
  return [street, `буд. ${delivery.house}`, delivery.apartment ? `кв. ${delivery.apartment}` : '']
    .filter(Boolean)
    .join(', ');
}

function loyaltyStateFromPricing(pricing: {
  loyalty: {
    applied: boolean;
    eligible: boolean;
    discountPercent: number;
    discountAmount: number;
    phoneMismatch: boolean;
  };
  discount: { amount: number };
}): CheckoutLoyaltyState {
  return {
    applied: pricing.loyalty.applied,
    eligible: pricing.loyalty.eligible,
    discountPercent: pricing.loyalty.discountPercent,
    discountAmount: pricing.discount.amount,
    phoneMismatch: pricing.loyalty.phoneMismatch,
  };
}

function buildOrderSnapshot(input: {
  attemptId: string | null;
  requestFingerprint: string | null;
  parsed: CheckoutInput;
  phone: string;
  delivery: ResolvedDelivery;
  quote: Awaited<ReturnType<typeof quoteCartItems>>;
  pricing: {
    total: number;
    discount: { amount: number };
    loyalty: {
      loyaltyPhone: string | null;
      eligible: boolean;
      discountPercent: number;
      phoneMismatch: boolean;
    };
  };
}): OrderSnapshot {
  const { parsed, delivery, quote, pricing } = input;
  return {
    checkoutAttemptId: input.attemptId,
    requestFingerprint: input.requestFingerprint,
    customerName: parsed.customerName.trim(),
    customerPhone: input.phone,
    customerComment: parsed.customerComment?.trim() || null,
    contactMethod: parsed.contactMethod,
    deliveryMethod: delivery.method,
    deliveryCityRef: delivery.cityRef,
    deliveryCityName: delivery.cityName,
    deliveryPointRef: delivery.method === 'COURIER' ? null : delivery.point.ref,
    deliveryPointNumber: delivery.method === 'COURIER' ? null : delivery.point.number,
    deliveryPointName: delivery.method === 'COURIER' ? null : delivery.point.name,
    deliveryPointAddress: delivery.method === 'COURIER' ? null : delivery.point.address,
    deliveryPointType: delivery.method === 'COURIER' ? null : delivery.point.type,
    deliveryStreetRef: delivery.method === 'COURIER' ? delivery.street.ref : null,
    deliveryStreetName: delivery.method === 'COURIER' ? delivery.street.name : null,
    deliveryStreetType: delivery.method === 'COURIER' ? delivery.street.type : null,
    deliveryHouse: delivery.method === 'COURIER' ? delivery.house : null,
    deliveryApartment: delivery.method === 'COURIER' ? delivery.apartment : null,
    itemsQuantity: quote.itemsQuantity,
    subtotal: quote.subtotal,
    quantityDiscount: quote.quantityDiscount,
    loyalty: {
      loyaltyPhone: pricing.loyalty.loyaltyPhone,
      eligible: pricing.loyalty.eligible,
      discountPercent: pricing.loyalty.discountPercent,
      discountAmount: pricing.discount.amount,
      phoneMismatch: pricing.loyalty.phoneMismatch,
    },
    // Persisted total is the server-authoritative final (includes loyalty).
    total: pricing.total,
    discountTierKey: quote.appliedTier?.key || null,
    // Human freeform only. Loyalty audit goes to structured loyalty_* columns.
    managerNote: null,
    items: quote.lines.map((line, index) => ({
      sort: index + 1,
      itemKey: line.itemKey,
      title: line.title,
      designSlug: line.item.designSlug,
      designLabel: line.designLabel,
      sizeCode: line.item.size,
      sizeLabel: line.sizeLabel,
      brandSlug: line.item.brandId,
      brandName: line.brandName,
      fixationKey: line.item.fixation,
      fixationLabel: line.fixationLabel,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
      quantityDiscountEligible: line.quantityDiscountEligible,
    })),
  };
}

export async function createOrder(input: CheckoutInput): Promise<CheckoutResult> {
  if (rateLimited(await clientIp())) {
    return {
      ok: false,
      code: 'FAILED',
      message: 'Забагато спроб оформлення. Зачекайте хвилину та спробуйте ще раз.',
    };
  }

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: 'INVALID', message: 'Перевірте контактні дані та спосіб доставки.' };
  }
  const phone = normalizeCustomerPhone(parsed.data.customerPhone);
  if (!phone) {
    return { ok: false, code: 'INVALID', message: 'Вкажіть коректний український номер телефону.' };
  }

  const orderStore = resolveOrderStoreBackend();
  const attemptId = parsed.data.checkoutAttemptId ?? null;
  let requestFingerprint: string | null = null;

  if (orderStore === 'supabase') {
    if (!attemptId || !isCheckoutAttemptId(attemptId)) {
      return {
        ok: false,
        code: 'INVALID',
        message: 'Не вдалося ідентифікувати спробу оформлення. Оновіть сторінку та спробуйте ще раз.',
      };
    }
    requestFingerprint = computeRequestFingerprint({
      customerPhone: phone,
      contactMethod: parsed.data.contactMethod,
      deliveryMethod: parsed.data.delivery.method,
      items: parsed.data.items,
    });

    // Replay-before-pricing: a successful prior order must stay retrievable
    // even if catalog/loyalty drifted since the original submit.
    try {
      const existing = await findOrderByAttemptId(attemptId);
      if (existing) {
        const bound = !existing.requestFingerprint
          || existing.requestFingerprint === requestFingerprint;
        if (!bound) {
          return { ok: false, code: 'ATTEMPT_REUSED', message: ATTEMPT_REUSED_MESSAGE };
        }
        return {
          ok: true,
          orderNumber: existing.orderNumber,
          total: existing.total,
          replayed: true,
        };
      }
    } catch (error) {
      // Probe outage: fall through to the idempotent RPC (created:false on replay).
      console.error('Order replay probe failed', safeErrorDetail(error));
    }
  }

  try {
    const quote = await quoteCartItems(parsed.data.items);
    if (!quote.canCheckout) {
      return { ok: false, code: 'UNAVAILABLE', message: 'Один із товарів зараз недоступний для замовлення.' };
    }

    // Server-authoritative loyalty + total. Client percent/amount are never trusted.
    // Persistence runs only inside onReady after pricing is confirmed.
    return await withCheckoutPricing({
      quote,
      customerPhone: phone,
      loyaltyPhone: parsed.data.loyaltyPhone || null,
      expectedTotal: parsed.data.expectedTotal,
      expectedBaseTotal: parsed.data.expectedBaseTotal ?? null,
      lookup: async (canonicalPhone) => findCustomerByPhone(canonicalPhone),
      onBlocked: (outcome) => {
        if (outcome.code === 'LOYALTY_UNAVAILABLE') {
          return { ok: false, code: 'LOYALTY_UNAVAILABLE', message: outcome.message } as CheckoutResult;
        }
        return {
          ok: false,
          code: outcome.code,
          message: outcome.message,
          quote: outcome.pricing.quote,
          loyalty: loyaltyStateFromPricing(outcome.pricing),
          total: outcome.pricing.total,
        } as CheckoutResult;
      },
      onReady: async (pricing) => {
        const authoritativeTotal = pricing.total;

        if (parsed.data.delivery.method === 'POSTOMAT' && !quote.allowPostomat) {
          return { ok: false, code: 'INVALID', message: 'Для цього кошика оберіть відділення замість поштомата.' };
        }
        const delivery = await resolveDelivery(parsed.data.delivery);
        const destination = deliveryDestination(delivery);

        const snapshot = buildOrderSnapshot({
          attemptId,
          requestFingerprint,
          parsed: parsed.data,
          phone,
          delivery,
          quote,
          pricing,
        });
        const result = await createOrderRecord(snapshot);

        // Order write succeeded — that is the success boundary.
        // Notify + customer upsert are best-effort and must not flip this to FAILED.
        // Replays never re-send notifications or re-upsert customers.
        if (result.created) {
          await runPostOrderSideEffects({
            notify: async () => {
              await notifyNewOrder({
                id: result.id,
                orderNumber: result.orderNumber,
                customerName: parsed.data.customerName.trim(),
                customerPhone: phone,
                contactMethod: contactMethodLabel(parsed.data.contactMethod),
                itemsQuantity: quote.itemsQuantity,
                // Authoritative server amounts — never recomputed in notification layer.
                quantityDiscount: quote.quantityDiscount,
                loyaltyDiscountAmount: pricing.discount.amount,
                // Authoritative discounted total, never the pre-loyalty quote.total.
                total: authoritativeTotal,
                deliveryMethod: DELIVERY_METHOD_LABELS[delivery.method],
                deliveryCity: delivery.cityName,
                deliveryDestination: destination,
                items: quote.lines.map(line => ({
                  title: line.title,
                  quantity: line.quantity,
                  lineTotal: line.lineTotal,
                  fixationLabel: line.fixationLabel,
                })),
              });
            },
            upsertCustomer: async () => {
              await upsertCustomerByPhone({
                phone,
                fullName: parsed.data.customerName.trim(),
                source: 'site',
                imported: false,
              });
            },
            logError: (message, detail) => {
              console.error(message, { orderNumber: result.orderNumber, detail });
            },
          });
        }

        return {
          ok: true,
          orderNumber: result.orderNumber,
          total: result.total,
          replayed: !result.created,
        };
      },
    });
  } catch (error) {
    if (error instanceof OrderStoreError && error.code === 'REPLAY_MISMATCH') {
      return { ok: false, code: 'ATTEMPT_REUSED', message: ATTEMPT_REUSED_MESSAGE };
    }
    console.error('Order creation failed', safeErrorDetail(error));
    if (error instanceof CartQuoteError) {
      return { ok: false, code: error.code, message: error.message };
    }
    return { ok: false, code: 'FAILED', message: 'Не вдалося оформити замовлення. Кошик збережено — спробуйте ще раз.' };
  }
}
