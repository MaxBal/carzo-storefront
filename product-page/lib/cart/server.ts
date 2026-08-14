import 'server-only';

import { calculateCartTotals } from './pricing';
import type { CartInputItem, CartQuote, CartQuoteLine } from './types';
import type { DiscountTier } from '@/lib/content/types';

type DirectusRecord = Record<string, unknown>;

export class CartQuoteError extends Error {
  constructor(message: string, public readonly code: 'INVALID' | 'UNAVAILABLE' = 'INVALID') {
    super(message);
  }
}

function directusConfig() {
  const url = process.env.DIRECTUS_URL?.replace(/\/$/, '');
  const token = process.env.DIRECTUS_READ_TOKEN?.trim();
  if (!url || !token) throw new CartQuoteError('Не вдалося перевірити актуальні ціни. Спробуйте ще раз.', 'UNAVAILABLE');
  return { url, token };
}

async function readPublished(collection: string, fields: string) {
  const { url, token } = directusConfig();
  const query = new URLSearchParams({
    limit: '-1',
    fields,
    'filter[status][_eq]': 'published',
  });
  const response = await fetch(`${url}/items/${collection}?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new CartQuoteError('Не вдалося перевірити актуальні ціни. Спробуйте ще раз.', 'UNAVAILABLE');
  }
  const payload = await response.json() as { data?: DirectusRecord | DirectusRecord[] };
  if (Array.isArray(payload.data)) return payload.data;
  return payload.data ? [payload.data] : [];
}

function relation(value: unknown, field: string) {
  if (value && typeof value === 'object') {
    const nested = (value as DirectusRecord)[field];
    return typeof nested === 'string' ? nested : '';
  }
  return typeof value === 'string' ? value : '';
}

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function bool(value: unknown) {
  return value === true;
}

function itemKey(item: Omit<CartInputItem, 'quantity'>) {
  return [item.size, item.designSlug, item.brandId, item.fixation].join(':');
}

function consolidateItems(items: CartInputItem[]) {
  const consolidated = new Map<string, CartInputItem>();
  for (const item of items) {
    const key = itemKey(item);
    const existing = consolidated.get(key);
    if (existing) existing.quantity += item.quantity;
    else consolidated.set(key, { ...item });
  }
  return Array.from(consolidated.values());
}

export async function quoteCartItems(rawItems: CartInputItem[]): Promise<CartQuote> {
  const items = consolidateItems(rawItems);
  const totalRequestedQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  if (items.length === 0 || totalRequestedQuantity > 30) {
    throw new CartQuoteError('Кошик порожній або містить забагато товарів.');
  }

  const [designs, sizes, brands, brandPricing, fixations, variants, discountTiers, shipping, siteSettings] = await Promise.all([
    readPublished('carzo_designs', 'slug,version,label'),
    readPublished('carzo_sizes', 'code,slug,label'),
    readPublished('carzo_brands', 'slug,name'),
    readPublished('carzo_brand_pricing', 'brand.slug,logo_extra'),
    readPublished('carzo_fixations', 'key,label,extra'),
    readPublished('carzo_variants', 'key,design.slug,size.code,price,in_stock,quantity_discount_eligible'),
    readPublished('carzo_discount_tiers', 'key,min_quantity,amount,sort'),
    readPublished('carzo_size_shipping', 'size.code,length_cm,width_cm,height_cm,weight_kg'),
    readPublished('carzo_site_settings', 'checkout_payment_details'),
  ]);

  const designBySlug = new Map(designs.map(item => [text(item.slug), item]));
  const sizeByCode = new Map(sizes.map(item => [text(item.code), item]));
  const brandBySlug = new Map(brands.map(item => [text(item.slug), item]));
  const brandPriceBySlug = new Map(brandPricing.map(item => [relation(item.brand, 'slug'), number(item.logo_extra)]));
  const fixationByKey = new Map(fixations.map(item => [text(item.key), item]));
  const variantByKey = new Map(variants.map(item => [`${relation(item.design, 'slug')}:${relation(item.size, 'code')}`, item]));
  const shippingBySize = new Map(shipping.map(item => [relation(item.size, 'code'), item]));
  const tiers: DiscountTier[] = discountTiers.map(item => ({
    key: text(item.key),
    minQuantity: number(item.min_quantity),
    amount: number(item.amount),
    sort: number(item.sort),
  }));

  const lines: CartQuoteLine[] = items.map(item => {
    const design = designBySlug.get(item.designSlug);
    const size = sizeByCode.get(item.size);
    const brand = brandBySlug.get(item.brandId);
    const fixation = fixationByKey.get(item.fixation);
    const variant = variantByKey.get(`${item.designSlug}:${item.size}`);
    if (!design || !size || !brand || !fixation || !variant) {
      throw new CartQuoteError('Один із товарів більше недоступний. Видаліть його з кошика та оберіть знову.');
    }

    const brandName = item.brandId === 'none' ? 'Без логотипа' : text(brand.name);
    const unitPrice = number(variant.price) + (brandPriceBySlug.get(item.brandId) ?? 0) + number(fixation.extra);
    const version = text(design.version) || item.designSlug;
    const title = brandName === 'Без логотипа'
      ? `Автокейс ${item.size} Carzo ${version}`
      : `Автокейс ${item.size} Carzo ${version} для ${brandName}`;
    const sizeSlug = text(size.slug) || item.size.toLowerCase();
    const brandPath = item.brandId === 'none' ? '' : `/${item.brandId}`;

    return {
      itemKey: itemKey(item),
      item,
      title,
      productUrl: `/case/design/${sizeSlug}/${item.designSlug}${brandPath}`,
      designLabel: text(design.label),
      sizeLabel: text(size.label),
      brandName,
      fixationLabel: text(fixation.label),
      unitPrice,
      quantity: item.quantity,
      lineTotal: unitPrice * item.quantity,
      inStock: bool(variant.in_stock),
      quantityDiscountEligible: bool(variant.quantity_discount_eligible),
    };
  });

  const totals = calculateCartTotals(lines.map(line => ({
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    quantityDiscountEligible: line.quantityDiscountEligible,
  })), tiers);
  const onlyLine = lines.length === 1 ? lines[0] : null;
  const profile = onlyLine ? shippingBySize.get(onlyLine.item.size) : null;
  const hasShippingProfile = Boolean(profile)
    && ['length_cm', 'width_cm', 'height_cm', 'weight_kg'].every(field => Number(profile?.[field]) > 0);

  return {
    lines,
    subtotal: totals.subtotal,
    quantityDiscount: totals.quantityDiscount,
    total: totals.total,
    itemsQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    appliedTier: totals.appliedTier
      ? { key: totals.appliedTier.key, minQuantity: totals.appliedTier.minQuantity, amount: totals.appliedTier.amount }
      : null,
    allowPostomat: Boolean(onlyLine && onlyLine.quantity === 1 && hasShippingProfile),
    canCheckout: lines.every(line => line.inStock),
    checkoutPaymentDetails: text(siteSettings[0]?.checkout_payment_details).trim(),
    verifiedAt: new Date().toISOString(),
  };
}
