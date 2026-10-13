import 'server-only';

import { calculateCartTotals } from './pricing';
import type { CartInputItem, CartQuote, CartQuoteLine } from './types';
import type { DiscountTier, FixationInfo, SizeId } from '@/lib/content/types';
import { loadCatalogData, CatalogUnavailableError } from '@/lib/data/catalog';

const POSTOMAT_MAX_WEIGHT_KG = 20;
const POSTOMAT_MAX_DIMENSIONS_CM = [30, 40, 60] as const;

export class CartQuoteError extends Error {
  constructor(message: string, public readonly code: 'INVALID' | 'UNAVAILABLE' = 'INVALID') {
    super(message);
  }
}

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function fixationExtraForSize(fixation: FixationInfo, size: string) {
  const bySize = fixation.extraBySize;
  if (bySize && typeof bySize === 'object') {
    const map = bySize as Record<string, unknown>;
    const key = String(size).toLowerCase();
    const value = map[key] ?? map[String(size)];
    if (value !== undefined && value !== null) return number(value);
  }
  return number(fixation.extra);
}

function fitsPostomatDimensions(values: unknown[]) {
  const dimensions = values.map(Number).sort((left, right) => left - right);
  return dimensions.length === POSTOMAT_MAX_DIMENSIONS_CM.length
    && dimensions.every((dimension, index) => (
      Number.isFinite(dimension)
      && dimension > 0
      && dimension <= POSTOMAT_MAX_DIMENSIONS_CM[index]
    ));
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

/**
 * Backend-neutral cart quote. Catalog dataset comes from CATALOG_STORE;
 * shared pricing math is calculateCartTotals. Fail-closed on catalog errors.
 */
export async function quoteCartItems(rawItems: CartInputItem[]): Promise<CartQuote> {
  const items = consolidateItems(rawItems);
  const totalRequestedQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  if (items.length === 0 || totalRequestedQuantity > 30) {
    throw new CartQuoteError('Кошик порожній або містить забагато товарів.');
  }

  let catalog;
  try {
    catalog = await loadCatalogData();
  } catch (error) {
    // Commerce fail-closed — never fall back to Directus/default prices.
    if (error instanceof CatalogUnavailableError || error instanceof Error) {
      throw new CartQuoteError('Не вдалося перевірити актуальні ціни. Спробуйте ще раз.', 'UNAVAILABLE');
    }
    throw new CartQuoteError('Не вдалося перевірити актуальні ціни. Спробуйте ще раз.', 'UNAVAILABLE');
  }

  const designBySlug = new Map(catalog.designs.map(item => [item.slug, item]));
  const sizeByCode = new Map(catalog.sizes.map(item => [item.id, item]));
  const brandBySlug = new Map(catalog.brands.map(item => [item.id, item]));
  const fixationByKey = new Map(catalog.fixations.map(item => [item.value, item]));
  const variantByKey = new Map(
    catalog.variants.map(item => [`${item.designSlug}:${item.size}`, item]),
  );
  const tiers: DiscountTier[] = catalog.discountTiers;

  const lines: CartQuoteLine[] = items.map(item => {
    const design = designBySlug.get(item.designSlug);
    const size = sizeByCode.get(item.size as SizeId);
    const brand = brandBySlug.get(item.brandId);
    const fixation = fixationByKey.get(item.fixation);
    const variant = variantByKey.get(`${item.designSlug}:${item.size}`);
    if (!design || !size || !brand || !fixation || !variant) {
      throw new CartQuoteError('Один із товарів більше недоступний. Видаліть його з кошика та оберіть знову.');
    }

    const brandName = item.brandId === 'none' ? 'Без логотипа' : text(brand.name);
    const fixationExtra = fixationExtraForSize(fixation, item.size);
    const unitPrice = number(variant.price) + number(brand.price) + fixationExtra;
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
      inStock: variant.inStock === true,
      quantityDiscountEligible: variant.quantityDiscountEligible === true,
    };
  });

  const totals = calculateCartTotals(lines.map(line => ({
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    quantityDiscountEligible: line.quantityDiscountEligible,
  })), tiers);
  const onlyLine = lines.length === 1 ? lines[0] : null;
  const size = onlyLine ? sizeByCode.get(onlyLine.item.size as SizeId) : null;
  const postomatDimensions = size
    ? [size.shippingProfile?.lengthCm ?? size.widthCm, size.shippingProfile?.widthCm ?? size.heightCm, size.shippingProfile?.heightCm ?? size.depthCm]
    : [];
  const shippingWeight = size?.shippingProfile?.weightKg;
  const postomatWeightAllowed = !size?.shippingProfile
    || (Number(shippingWeight) > 0 && Number(shippingWeight) <= POSTOMAT_MAX_WEIGHT_KG);
  const postomatParcelAllowed = fitsPostomatDimensions(postomatDimensions) && postomatWeightAllowed;

  return {
    lines,
    subtotal: totals.subtotal,
    quantityDiscount: totals.quantityDiscount,
    total: totals.total,
    itemsQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    appliedTier: totals.appliedTier
      ? { key: totals.appliedTier.key, minQuantity: totals.appliedTier.minQuantity, amount: totals.appliedTier.amount }
      : null,
    allowPostomat: Boolean(
      onlyLine
      && onlyLine.quantity === 1
      && postomatParcelAllowed,
    ),
    canCheckout: lines.every(line => line.inStock),
    checkoutPaymentDetails: text(catalog.checkoutPaymentDetails).trim(),
    verifiedAt: new Date().toISOString(),
  };
}
