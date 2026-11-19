import type { CatalogCartItem } from '@/lib/commerce/types';
import type { CartInputItem, NewCartItem } from './types';

/** Hash helpers deliberately accept the original broad string shape (including pre-normalized values). */
export type IdentityItem = { size: string; designSlug: string; brandId: string; fixation: string; quantity: number } | CatalogCartItem;

export function isCatalogCartItem(item: NewCartItem | IdentityItem): item is CatalogCartItem {
  return 'productId' in item;
}

function entries(values: Record<string, string>) {
  return Object.entries(values).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
}

/** Delimiter-safe for arbitrary option/text values; legacy case keys remain byte-for-byte unchanged. */
export function cartItemKey(item: NewCartItem | CartInputItem): string {
  if (!('productId' in item)) return [item.size, item.designSlug, item.brandId, item.fixation].join(':');
  return `catalog:${JSON.stringify([item.productId, item.variantId, entries(item.options), entries(item.personalization)])}`;
}

export function fingerprintItemLine(item: IdentityItem, separator: ':' | '|'): string {
  if (isCatalogCartItem(item)) return `${cartItemKey(item)}:${Math.trunc(item.quantity)}`;
  const legacy = item;
  return [legacy.size.trim(), legacy.designSlug.trim(), legacy.brandId.trim(), legacy.fixation.trim(), String(Math.trunc(legacy.quantity))].join(separator);
}
