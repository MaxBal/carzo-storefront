import type { CartInputItem, NewCartItem } from './types';
import { cartItemSchema } from './validation';
import { cartItemKey } from './item-identity';

export type GuestCartItem = CartInputItem;

const STORAGE_KEY = 'carzo:guest-cart:v1';

function isCartItem(value: unknown): value is GuestCartItem {
  return cartItemSchema.safeParse(value).success;
}

export const guestCartItemKey = cartItemKey;

export function readGuestCart(): GuestCartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isCartItem).map(item => cartItemSchema.parse(item)) : [];
  } catch {
    return [];
  }
}

export function writeGuestCart(items: GuestCartItem[]) {
  if (typeof window === 'undefined') return;
  const safeItems = items.filter(isCartItem).map(item => cartItemSchema.parse(item));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safeItems));
}

export function addGuestCartItem(item: NewCartItem, quantity = 1) {
  const items = readGuestCart();
  const safeQuantity = Number.isFinite(quantity) ? Math.max(1, Math.min(20, Math.trunc(quantity))) : 1;
  const normalized = cartItemSchema.parse({ ...item, quantity: safeQuantity });
  const key = guestCartItemKey(normalized);
  const existing = items.find(candidate => guestCartItemKey(candidate) === key);

  if (existing) existing.quantity = Math.min(20, existing.quantity + safeQuantity);
  else items.push(normalized);

  writeGuestCart(items);
  return items;
}

export function clearGuestCart() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
