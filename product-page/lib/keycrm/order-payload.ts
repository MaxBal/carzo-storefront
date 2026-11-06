/**
 * Pure builder: Carzo order snapshot + cart lines → keyCRM POST /order payload.
 *
 * Money invariants (enforced before any send):
 *   Σ (line prices × quantities) === order.subtotal
 *   discount_amount === quantityDiscount + loyaltyDiscountAmount
 *   subtotal - discount_amount === order.total
 * A mismatch throws — the caller must NOT send the order.
 */

import {
  badgeSku,
  caseSku,
  contactMethodLabel,
  PAID_FIXATION_KEY,
  paidFixationSku,
} from './sku';
import type {
  KeyCrmOrderConfig,
  KeyCrmOrderInput,
  KeyCrmOrderPayload,
  KeyCrmProductLine,
  KeyCrmSourceLine,
} from './types';

export class KeyCrmPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyCrmPayloadError';
  }
}

/** Owner-created informational fields (number type, model order). */
export const KEYCRM_FIELD_QUANTITY_DISCOUNT = 'OR_1008';
export const KEYCRM_FIELD_LOYALTY_DISCOUNT = 'OR_1009';

interface ComboGroup {
  brandName: string;
  fixationLabel: string;
  quantity: number;
}

interface CaseGroup {
  sku: string;
  basePrice: number;
  quantity: number;
}

function wholeUah(value: number): number {
  return Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0));
}

function groupCombos(lines: KeyCrmSourceLine[]): ComboGroup[] {
  const groups = new Map<string, ComboGroup>();
  for (const line of lines) {
    const key = `${line.brandSlug}:${line.fixationKey}`;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += line.quantity;
    } else {
      groups.set(key, {
        brandName: line.brandName,
        fixationLabel: line.fixationLabel,
        quantity: line.quantity,
      });
    }
  }
  return Array.from(groups.values());
}

/**
 * "Комплектація:" comment that keeps the logo↔fixation pairing per case unit.
 * Empty string when every unit is "Без логотипа" + "без фіксації".
 */
export function buildCompositionComment(lines: KeyCrmSourceLine[]): string {
  const combos = groupCombos(lines);
  const onlyDefaults = combos.length === 1
    && combos[0].brandName === 'Без логотипа'
    && combos[0].fixationLabel === 'без фіксації';
  if (onlyDefaults) return '';

  const parts = combos.map((combo) => (
    `${combo.quantity} шт. — ${combo.brandName}, ${combo.fixationLabel}`
  ));
  return parts.length === 1
    ? `Комплектація: ${parts[0]}.`
    : `Комплектація:\n${parts.map((part) => `- ${part}.`).join('\n')}`;
}

function buildShipping(input: KeyCrmOrderInput, deliveryServiceId: number): KeyCrmOrderPayload['shipping'] {
  const shipping: KeyCrmOrderPayload['shipping'] = {
    shipping_service: 'Нова Пошта',
    delivery_service_id: deliveryServiceId,
    recipient_full_name: input.customerName || null,
    recipient_phone: input.customerPhone || null,
    shipping_address_city: input.deliveryCityName || null,
  };

  if (input.deliveryMethod === 'COURIER') {
    const street = [input.deliveryStreetType, input.deliveryStreetName].filter(Boolean).join(' ');
    const address = [
      street,
      input.deliveryHouse ? `буд. ${input.deliveryHouse}` : '',
      input.deliveryApartment ? `кв. ${input.deliveryApartment}` : '',
    ].filter(Boolean).join(', ');
    shipping.shipping_secondary_line = address || null;
    shipping.shipping_receive_point = 'Курʼєрська доставка';
    return shipping;
  }

  shipping.warehouse_ref = input.deliveryPointRef || null;
  const kind = input.deliveryMethod === 'POSTOMAT' ? 'Поштомат' : 'Відділення';
  const number = input.deliveryPointNumber ? `№${input.deliveryPointNumber}: ` : '';
  const destination = [input.deliveryPointName, input.deliveryPointAddress].filter(Boolean).join(', ');
  shipping.shipping_receive_point = `${kind} ${number}${destination}`.trim() || null;
  return shipping;
}

export function buildKeyCrmOrder(
  input: KeyCrmOrderInput,
  config: KeyCrmOrderConfig,
): KeyCrmOrderPayload {
  if (input.lines.length === 0) {
    throw new KeyCrmPayloadError('EMPTY_LINES');
  }

  // ---- Split lines into base case / paid fixation / badge positions ----
  const cases = new Map<string, CaseGroup>();
  const fixations = new Map<string, { sku: string; price: number; quantity: number }>();
  const badges = new Map<string, { sku: string; price: number; quantity: number }>();
  let positionsSum = 0;

  for (const line of input.lines) {
    if (line.quantity < 1) throw new KeyCrmPayloadError('INVALID_QUANTITY');

    const base = caseSku(line.sizeCode, line.designSlug);
    if (!base) {
      throw new KeyCrmPayloadError(`UNKNOWN_CASE_SKU:${line.sizeCode}:${line.designSlug}`);
    }
    const caseGroup = cases.get(base) ?? {
      sku: base,
      basePrice: line.basePrice,
      quantity: 0,
    };
    caseGroup.quantity += line.quantity;
    cases.set(base, caseGroup);
    positionsSum += line.basePrice * line.quantity;

    if (line.fixationKey === PAID_FIXATION_KEY) {
      const sku = paidFixationSku(line.fixationKey, line.sizeCode);
      if (!sku) throw new KeyCrmPayloadError(`UNKNOWN_FIXATION_SKU:${line.sizeCode}`);
      const current = fixations.get(sku) ?? { sku, price: line.fixationExtra, quantity: 0 };
      current.quantity += line.quantity;
      fixations.set(sku, current);
      positionsSum += line.fixationExtra * line.quantity;
    }

    const badge = badgeSku(line.brandSlug);
    if (badge) {
      const current = badges.get(badge) ?? { sku: badge, price: line.logoExtra, quantity: 0 };
      current.quantity += line.quantity;
      badges.set(badge, current);
      positionsSum += line.logoExtra * line.quantity;
    } else if (line.brandSlug !== 'none') {
      throw new KeyCrmPayloadError(`UNKNOWN_BADGE_SKU:${line.brandSlug}`);
    }

    // unit_price consistency: it must equal the sum of its parts.
    if (line.unitPrice !== line.basePrice + line.logoExtra + line.fixationExtra) {
      throw new KeyCrmPayloadError('UNIT_PRICE_SPLIT_MISMATCH');
    }
  }

  const products: KeyCrmProductLine[] = [];
  for (const group of Array.from(cases.values())) {
    const comment = buildCompositionComment(
      input.lines.filter((item) => caseSku(item.sizeCode, item.designSlug) === group.sku),
    );
    products.push({
      sku: group.sku,
      price: group.basePrice,
      quantity: group.quantity,
      ...(comment ? { comment } : {}),
    });
  }
  for (const fixation of Array.from(fixations.values())) {
    products.push({ sku: fixation.sku, price: fixation.price, quantity: fixation.quantity });
  }
  for (const badge of Array.from(badges.values())) {
    products.push({ sku: badge.sku, price: badge.price, quantity: badge.quantity });
  }

  // ---- Money invariants: never send an inconsistent order ----
  if (positionsSum !== input.subtotal) {
    throw new KeyCrmPayloadError(
      `POSITIONS_SUM_MISMATCH:${positionsSum}!=${input.subtotal}`,
    );
  }
  const discountAmount = wholeUah(input.quantityDiscount) + wholeUah(input.loyaltyDiscountAmount);
  if (input.subtotal - discountAmount !== input.total) {
    throw new KeyCrmPayloadError('TOTAL_MISMATCH');
  }

  const buyerComment = input.customerComment?.trim();
  const managerNote = input.managerNote?.trim();
  const contactLabel = contactMethodLabel(input.contactMethod);

  const payload: KeyCrmOrderPayload = {
    source_id: config.sourceId,
    source_uuid: input.orderNumber,
    buyer: {
      full_name: input.customerName || null,
      phone: input.customerPhone || null,
      ...(input.customerEmail ? { email: input.customerEmail } : {}),
    },
    shipping: buildShipping(input, config.deliveryServiceId),
    products,
    ...(buyerComment ? { buyer_comment: buyerComment } : {}),
    // Real manager notes only — discount breakdowns go to custom fields.
    ...(managerNote ? { manager_comment: managerNote } : {}),
    ...(discountAmount > 0 ? { discount_amount: discountAmount } : {}),
  };

  if (config.contactMethodFieldUuid && !contactLabel) {
    throw new KeyCrmPayloadError(`UNKNOWN_CONTACT_METHOD:${input.contactMethod}`);
  }
  payload.custom_fields = [
    ...(config.contactMethodFieldUuid
      ? [{ uuid: config.contactMethodFieldUuid, value: [contactLabel as string] }]
      : []),
    // Informational only — the real discount is discount_amount above.
    { uuid: KEYCRM_FIELD_QUANTITY_DISCOUNT, value: wholeUah(input.quantityDiscount) },
    { uuid: KEYCRM_FIELD_LOYALTY_DISCOUNT, value: wholeUah(input.loyaltyDiscountAmount) },
  ];

  return payload;
}
