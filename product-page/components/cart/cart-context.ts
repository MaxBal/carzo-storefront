'use client';

import { createContext, useContext } from 'react';
import type { CartInputItem, CartQuote } from '@/lib/cart/types';

export interface OrderConfirmation {
  orderNumber: string;
  total: number;
}

/** Which drawer surface opens: ordinary cart or one-step checkout. */
export type CartOpenView = 'cart' | 'checkout';

export interface CartContextValue {
  items: CartInputItem[];
  itemsQuantity: number;
  isOpen: boolean;
  hydrated: boolean;
  quote: CartQuote | null;
  quoteLoading: boolean;
  quoteError: string | null;
  confirmation: OrderConfirmation | null;
  /** View requested by the last openCart/openCheckout call; read on drawer mount. */
  openView: CartOpenView;
  addItem: (item: Omit<CartInputItem, 'quantity'>) => void;
  setQuantity: (itemKey: string, quantity: number) => void;
  removeItem: (itemKey: string) => void;
  /** Opens the drawer on the ordinary «Кошик» screen. */
  openCart: () => void;
  /** Opens the drawer directly on «Оформлення замовлення». */
  openCheckout: () => void;
  closeCart: () => void;
  replaceQuote: (quote: CartQuote) => void;
  completeOrder: (confirmation: OrderConfirmation) => void;
  closeConfirmation: () => void;
  /** Stable checkout attempt id for the current purchase intent (client-generated UUID). */
  getCheckoutAttemptId: () => string;
  /** Invalidate the current attempt id (new purchase intent / replay mismatch). */
  resetCheckoutAttemptId: () => void;
}

export const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
