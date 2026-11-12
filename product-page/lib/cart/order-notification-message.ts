import type { NotificationOrderItem } from './order-items-summary';

export interface OrderNotificationMessageInput {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  contactMethod: string;
  paymentOption: string;
  items: NotificationOrderItem[];
  itemsQuantity: number;
  quantityDiscount: number;
  loyaltyDiscountAmount: number;
  total: number;
  deliveryMethod: string;
  deliveryCity: string;
  deliveryDestination: string;
  customerComment?: string;
  orderUrl?: string;
}

export function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** "5180" → "5 180" (non-breaking groups), "−500" for negatives. */
export function formatAmount(value: number): string {
  const rounded = Math.trunc(value);
  const sign = rounded < 0 ? '−' : '';
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${digits}`;
}

function money(value: number): string {
  return `${formatAmount(value)} ₴`;
}

/**
 * Head line for a cart line: "Автокейс L — Carzo 4.0".
 * The brand suffix ("для Audi") moves to its own "Автомобіль" line.
 */
function itemHead(item: NotificationOrderItem): string {
  const brandName = item.brandName?.trim();
  let title = item.title.trim();
  const brandSuffix = brandName && brandName !== 'Без логотипа' ? ` для ${brandName}` : '';
  if (brandSuffix && title.endsWith(brandSuffix)) {
    title = title.slice(0, -brandSuffix.length);
  }
  return title.replace(/^Автокейс (\S+) Carzo /, 'Автокейс $1 — Carzo ');
}

function itemBlock(item: NotificationOrderItem, index: number, numbered: boolean): string {
  const lines: string[] = [];
  const head = numbered ? `${index}. ${itemHead(item)}` : itemHead(item);
  lines.push(`<b>${escapeTelegramHtml(head)}</b>`);

  const brandName = item.brandName?.trim();
  if (brandName && brandName !== 'Без логотипа') {
    lines.push(`Автомобіль: ${escapeTelegramHtml(brandName)}`);
  }
  lines.push(`Кількість: ${item.quantity} шт.`);
  const fixation = item.fixationLabel?.trim();
  if (fixation) {
    lines.push(`Фіксація: ${escapeTelegramHtml(fixation)}`);
  }
  lines.push(`Вартість: ${money(item.lineTotal)}`);
  return lines.join('\n');
}

function positiveAmount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

/**
 * Telegram HTML message for a new Carzo order notification, styled like the
 * car-mat quote bot: bold block headings, thematic emoji, one blank line
 * between blocks. Every value is escaped; calculations are never recomputed.
 */
export function formatOrderNotificationHtml(
  order: OrderNotificationMessageInput,
): string {
  const blocks: string[] = [];

  blocks.push(
    [
      '🛒 <b>НОВЕ ЗАМОВЛЕННЯ CARZO</b>',
      `<b>Замовлення ${escapeTelegramHtml(order.orderNumber)}</b>`,
    ].join('\n'),
  );

  blocks.push(
    [
      '👤 <b>Покупець</b>',
      `Ім’я: ${escapeTelegramHtml(order.customerName)}`,
      `Телефон: ${escapeTelegramHtml(order.customerPhone)}`,
    ].join('\n'),
  );

  const numbered = order.items.length > 1;
  const itemBlocks = order.items.map((item, index) =>
    itemBlock(item, index + 1, numbered),
  );
  blocks.push(['📦 <b>ТОВАРИ</b>', '', itemBlocks.join('\n\n')].join('\n'));

  const costLines = [
    '💰 <b>ВАРТІСТЬ ЗАМОВЛЕННЯ</b>',
    `Кількість товарів: ${order.itemsQuantity} шт.`,
  ];
  const quantityDiscount = positiveAmount(order.quantityDiscount);
  if (quantityDiscount > 0) {
    costLines.push(`Разом дешевше: −${formatAmount(quantityDiscount)} ₴`);
  }
  const loyaltyDiscount = positiveAmount(order.loyaltyDiscountAmount);
  if (loyaltyDiscount > 0) {
    costLines.push(`Знижка 5%: −${formatAmount(loyaltyDiscount)} ₴`);
  }
  costLines.push(`<b>До сплати: ${money(order.total)}</b>`);
  blocks.push(costLines.join('\n'));

  const deliveryLines = ['🚚 <b>ДОСТАВКА</b>'];
  if (order.deliveryMethod.trim()) {
    deliveryLines.push(escapeTelegramHtml(order.deliveryMethod.trim()));
  }
  const destination = [order.deliveryCity.trim(), order.deliveryDestination.trim()]
    .filter(Boolean)
    .join(', ');
  if (destination) {
    deliveryLines.push(escapeTelegramHtml(destination));
  }
  blocks.push(deliveryLines.join('\n'));

  if (order.paymentOption.trim()) {
    blocks.push(
      ['💳 <b>ОПЛАТА</b>', escapeTelegramHtml(order.paymentOption.trim())].join('\n'),
    );
  }

  if (order.contactMethod.trim()) {
    blocks.push(
      ['💬 <b>ЗВ\'ЯЗОК</b>', escapeTelegramHtml(order.contactMethod.trim())].join('\n'),
    );
  }

  const comment = order.customerComment?.trim();
  if (comment) {
    blocks.push(
      ['📝 <b>КОМЕНТАР</b>', escapeTelegramHtml(comment)].join('\n'),
    );
  }

  const orderUrl = order.orderUrl?.trim();
  if (orderUrl) {
    blocks.push(`🔗 <a href="${escapeTelegramHtml(orderUrl)}">Замовлення</a>`);
  }

  return blocks.join('\n\n');
}
