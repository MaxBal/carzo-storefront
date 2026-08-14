'use client';

import { createContext, useContext } from 'react';
import type { CartInputItem, CartQuote } from '@/lib/cart/types';

export interface OrderConfirmation {
  orderNumber: string;
  total: number;
}

export interface CartContextValue {
  items: CartInputItem[];
  itemsQuantity: number;
  isOpen: boolean;
  hydrated: boolean;
  quote: CartQuote | null;
  quoteLoading: boolean;
  quoteError: string | null;
  confirmation: OrderConfirmation | null;
  addItem: (item: Omit<CartInputItem, 'quantity'>) => void;
  setQuantity: (itemKey: string, quantity: number) => void;
  removeItem: (itemKey: string) => void;
  openCart: () => void;
  closeCart: () => void;
  replaceQuote: (quote: CartQuote) => void;
  completeOrder: (confirmation: OrderConfirmation) => void;
  closeConfirmation: () => void;
}

export const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
