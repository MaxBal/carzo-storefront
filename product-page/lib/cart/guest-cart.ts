import type { CartInputItem } from './types';

export type GuestCartItem = CartInputItem;

const STORAGE_KEY = 'carzo:guest-cart:v1';

function isCartItem(value: unknown): value is GuestCartItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    ['S', 'M', 'L', 'XL'].includes(String(item.size))
    && typeof item.designSlug === 'string'
    && typeof item.brandId === 'string'
    && typeof item.fixation === 'string'
    && Number.isInteger(item.quantity)
    && Number(item.quantity) > 0
  );
}

export function guestCartItemKey(item: Omit<GuestCartItem, 'quantity'>) {
  return [item.size, item.designSlug, item.brandId, item.fixation].join(':');
}

export function readGuestCart(): GuestCartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
  } catch {
    return [];
  }
}

export function writeGuestCart(items: GuestCartItem[]) {
  if (typeof window === 'undefined') return;
  const safeItems = items.filter(isCartItem).map(item => ({ ...item, quantity: Math.trunc(item.quantity) }));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safeItems));
}

export function addGuestCartItem(item: Omit<GuestCartItem, 'quantity'>, quantity = 1) {
  const items = readGuestCart();
  const key = guestCartItemKey(item);
  const safeQuantity = Math.max(1, Math.trunc(quantity));
  const existing = items.find(candidate => guestCartItemKey(candidate) === key);

  if (existing) existing.quantity += safeQuantity;
  else items.push({ ...item, quantity: safeQuantity });

  writeGuestCart(items);
  return items;
}

export function clearGuestCart() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
