'use server';

import { randomUUID } from 'node:crypto';
import { checkoutSchema } from '@/lib/cart/validation';
import { CartQuoteError, quoteCartItems } from '@/lib/cart/server';
import {
  resolveNovaPoshtaCity,
  resolveNovaPoshtaPoint,
  resolveNovaPoshtaStreet,
} from '@/lib/nova-poshta';
import { notifyNewOrder } from '@/lib/order-notifications';
import { contactMethodLabel } from '@/lib/cart/contact-method';
import type {
  CheckoutInput,
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

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `+38${digits}`;
  if (digits.length === 12 && digits.startsWith('380')) return `+${digits}`;
  return null;
}

function orderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `CZ-${date}-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
}

async function writeOrder(body: Record<string, unknown>) {
  const url = process.env.DIRECTUS_URL?.replace(/\/$/, '');
  const token = process.env.DIRECTUS_READ_TOKEN?.trim();
  if (!url || !token) throw new Error('Directus order writer is not configured');
  const response = await fetch(`${url}/items/carzo_orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Directus order create failed: ${response.status} ${payload.slice(0, 300)}`);
  }
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

export async function createOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: 'INVALID', message: 'Перевірте контактні дані та спосіб доставки.' };
  }
  const phone = normalizePhone(parsed.data.customerPhone);
  if (!phone) {
    return { ok: false, code: 'INVALID', message: 'Вкажіть коректний український номер телефону.' };
  }

  try {
    const quote = await quoteCartItems(parsed.data.items);
    if (!quote.canCheckout) {
      return { ok: false, code: 'UNAVAILABLE', message: 'Один із товарів зараз недоступний для замовлення.' };
    }
    if (quote.total !== parsed.data.expectedTotal) {
      return {
        ok: false,
        code: 'PRICE_CHANGED',
        message: 'Ціна змінилася. Ми оновили суму — перевірте її та підтвердьте замовлення ще раз.',
        quote,
      };
    }

    if (parsed.data.delivery.method === 'POSTOMAT' && !quote.allowPostomat) {
      return { ok: false, code: 'INVALID', message: 'Для цього кошика оберіть відділення замість поштомата.' };
    }
    const delivery = await resolveDelivery(parsed.data.delivery);
    const destination = deliveryDestination(delivery);

    const number = orderNumber();
    const orderId = randomUUID();
    await writeOrder({
      id: orderId,
      status: 'new',
      order_number: number,
      created_at: new Date().toISOString(),
      customer_name: parsed.data.customerName.trim(),
      customer_phone: phone,
      customer_comment: parsed.data.customerComment?.trim() || null,
      contact_method: parsed.data.contactMethod,
      delivery_method: delivery.method,
      delivery_city_ref: delivery.cityRef,
      delivery_city_name: delivery.cityName,
      delivery_point_ref: delivery.method === 'COURIER' ? null : delivery.point.ref,
      delivery_point_number: delivery.method === 'COURIER' ? null : delivery.point.number,
      delivery_point_name: delivery.method === 'COURIER' ? null : delivery.point.name,
      delivery_point_address: delivery.method === 'COURIER' ? null : delivery.point.address,
      delivery_point_type: delivery.method === 'COURIER' ? null : delivery.point.type,
      delivery_street_ref: delivery.method === 'COURIER' ? delivery.street.ref : null,
      delivery_street_name: delivery.method === 'COURIER' ? delivery.street.name : null,
      delivery_street_type: delivery.method === 'COURIER' ? delivery.street.type : null,
      delivery_house: delivery.method === 'COURIER' ? delivery.house : null,
      delivery_apartment: delivery.method === 'COURIER' ? delivery.apartment : null,
      items_quantity: quote.itemsQuantity,
      subtotal: quote.subtotal,
      quantity_discount: quote.quantityDiscount,
      total: quote.total,
      discount_tier_key: quote.appliedTier?.key || null,
      items: quote.lines.map((line, index) => ({
        id: randomUUID(),
        sort: index + 1,
        item_key: line.itemKey,
        title: line.title,
        design_slug: line.item.designSlug,
        design_label: line.designLabel,
        size_code: line.item.size,
        size_label: line.sizeLabel,
        brand_slug: line.item.brandId,
        brand_name: line.brandName,
        fixation_key: line.item.fixation,
        fixation_label: line.fixationLabel,
        unit_price: line.unitPrice,
        quantity: line.quantity,
        line_total: line.lineTotal,
        quantity_discount_eligible: line.quantityDiscountEligible,
      })),
    });

    await notifyNewOrder({
      id: orderId,
      orderNumber: number,
      customerName: parsed.data.customerName.trim(),
      customerPhone: phone,
      contactMethod: contactMethodLabel(parsed.data.contactMethod),
      itemsQuantity: quote.itemsQuantity,
      total: quote.total,
      deliveryMethod: DELIVERY_METHOD_LABELS[delivery.method],
      deliveryCity: delivery.cityName,
      deliveryDestination: destination,
      items: quote.lines.map(line => ({
        title: line.title,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
      })),
    });

    return { ok: true, orderNumber: number, total: quote.total };
  } catch (error) {
    console.error('Order creation failed', error);
    if (error instanceof CartQuoteError) {
      return { ok: false, code: error.code, message: error.message };
    }
    return { ok: false, code: 'FAILED', message: 'Не вдалося оформити замовлення. Кошик збережено — спробуйте ще раз.' };
  }
}
