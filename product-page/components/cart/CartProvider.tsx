'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { clearGuestCart, guestCartItemKey, readGuestCart, writeGuestCart } from '@/lib/cart/guest-cart';
import type { CartInputItem, CartQuote } from '@/lib/cart/types';
import { CartContext, type OrderConfirmation } from './cart-context';

const CartDrawer = dynamic(() => import('./CartDrawer'), { ssr: false });

export default function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartInputItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null);
  const checkoutAttemptIdRef = useRef<string | null>(null);

  useEffect(() => {
    const sync = () => setItems(readGuestCart());
    sync();
    setHydrated(true);
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => {
    if (!hydrated || !isOpen) return;
    if (items.length === 0) {
      setQuote(null);
      setQuoteError(null);
      setQuoteLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const response = await fetch('/api/cart/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
          signal: controller.signal,
        });
        const payload = await response.json() as CartQuote | { error?: string };
        if (!response.ok) throw new Error('error' in payload ? payload.error : undefined);
        setQuote(payload as CartQuote);
      } catch (error) {
        if (controller.signal.aborted) return;
        setQuote(null);
        setQuoteError(error instanceof Error && error.message
          ? error.message
          : 'Не вдалося перерахувати кошик.');
      } finally {
        if (!controller.signal.aborted) setQuoteLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [hydrated, isOpen, items]);

  const updateItems = useCallback((updater: (current: CartInputItem[]) => CartInputItem[]) => {
    setItems(current => {
      const next = updater(current);
      writeGuestCart(next);
      return next;
    });
  }, []);

  const addItem = useCallback((item: Omit<CartInputItem, 'quantity'>) => {
    updateItems(current => {
      const key = guestCartItemKey(item);
      const existing = current.find(candidate => guestCartItemKey(candidate) === key);
      if (existing) {
        return current.map(candidate => (
          guestCartItemKey(candidate) === key
            ? { ...candidate, quantity: Math.min(20, candidate.quantity + 1) }
            : candidate
        ));
      }
      return [...current, { ...item, quantity: 1 }];
    });
    setIsOpen(true);
  }, [updateItems]);

  const setQuantity = useCallback((key: string, quantity: number) => {
    updateItems(current => current
      .map(item => guestCartItemKey(item) === key
        ? { ...item, quantity: Math.max(1, Math.min(20, Math.trunc(quantity))) }
        : item));
  }, [updateItems]);

  const removeItem = useCallback((key: string) => {
    updateItems(current => current.filter(item => guestCartItemKey(item) !== key));
  }, [updateItems]);

  // One logical checkout attempt = one cart contents. A new purchase intent
  // (cart changed) or a confirmed order invalidates the attempt id; contact
  // and delivery corrections keep it stable so retries cannot double-order.
  const itemsSignature = items
    .map(item => guestCartItemKey(item))
    .sort()
    .join('|');
  const lastItemsSignatureRef = useRef(itemsSignature);
  useEffect(() => {
    if (lastItemsSignatureRef.current !== itemsSignature) {
      lastItemsSignatureRef.current = itemsSignature;
      checkoutAttemptIdRef.current = null;
    }
  }, [itemsSignature]);

  const getCheckoutAttemptId = useCallback(() => {
    if (!checkoutAttemptIdRef.current) {
      checkoutAttemptIdRef.current = crypto.randomUUID();
    }
    return checkoutAttemptIdRef.current;
  }, []);
  const resetCheckoutAttemptId = useCallback(() => {
    checkoutAttemptIdRef.current = null;
  }, []);

  const completeOrder = useCallback((result: OrderConfirmation) => {
    clearGuestCart();
    setItems([]);
    setQuote(null);
    setIsOpen(false);
    setConfirmation(result);
    checkoutAttemptIdRef.current = null;
  }, []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const closeConfirmation = useCallback(() => setConfirmation(null), []);

  const itemsQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const value = useMemo(() => ({
    items,
    itemsQuantity,
    isOpen,
    hydrated,
    quote,
    quoteLoading,
    quoteError,
    confirmation,
    addItem,
    setQuantity,
    removeItem,
    openCart,
    closeCart,
    replaceQuote: setQuote,
    completeOrder,
    closeConfirmation,
    getCheckoutAttemptId,
    resetCheckoutAttemptId,
  }), [
    items, itemsQuantity, isOpen, hydrated, quote, quoteLoading, quoteError,
    confirmation, addItem, setQuantity, removeItem, completeOrder,
    openCart, closeCart, closeConfirmation,
    getCheckoutAttemptId, resetCheckoutAttemptId,
  ]);

  return (
    <CartContext.Provider value={value}>
      {children}
      {(isOpen || confirmation) ? <CartDrawer /> : null}
    </CartContext.Provider>
  );
}
