import type { CartInputItem, NewCartItem } from './types';
import { cartItemKey } from './item-identity';

export const MAX_CART_ITEM_QUANTITY = 20;
export const MAX_CART_QUANTITY = 30;

/** Capacity for an exact, additive purchase; never silently trim the buyer's selection. */
export function availableCartQuantity(items: CartInputItem[], input: NewCartItem): number {
  const key = cartItemKey(input);
  let sameItemQuantity = 0;
  let totalQuantity = 0;
  for (const item of items) {
    totalQuantity += item.quantity;
    if (cartItemKey(item) === key) sameItemQuantity += item.quantity;
  }
  return Math.max(0, Math.min(MAX_CART_ITEM_QUANTITY - sameItemQuantity, MAX_CART_QUANTITY - totalQuantity));
}

/** Atomic immutable addition used by CartProvider, including same-SKU consolidation. */
export function addCartQuantity(items: CartInputItem[], item: CartInputItem): CartInputItem[] {
  if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > availableCartQuantity(items, item)) return items;
  const key = cartItemKey(item);
  if (!items.some(candidate => cartItemKey(candidate) === key)) return [...items, { ...item }];
  let added = false;
  return items.map(candidate => {
    if (added || cartItemKey(candidate) !== key) return candidate;
    added = true;
    return { ...candidate, quantity: candidate.quantity + item.quantity };
  });
}
