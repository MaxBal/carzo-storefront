'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  computeCartItemsSignature,
  createCheckoutAttemptTracker,
  type CheckoutAttemptOutcomeInput,
} from '@/lib/cart/checkout-attempt-client';
import { clearGuestCart, guestCartItemKey, readGuestCart, writeGuestCart } from '@/lib/cart/guest-cart';
import type { CartInputItem, CartQuote } from '@/lib/cart/types';
import { CartContext, type CartOpenView, type OrderConfirmation } from './cart-context';

const CartDrawer = dynamic(() => import('./CartDrawer'), { ssr: false });

export default function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartInputItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [openView, setOpenView] = useState<CartOpenView>('cart');
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null);
  const attemptTrackerRef = useRef<ReturnType<typeof createCheckoutAttemptTracker> | null>(null);

  const getTracker = useCallback(() => {
    if (!attemptTrackerRef.current) {
      attemptTrackerRef.current = createCheckoutAttemptTracker();
    }
    return attemptTrackerRef.current;
  }, []);

  useEffect(() => {
    const sync = () => {
      const nextItems = readGuestCart();
      setItems(nextItems);
      getTracker().hydrate(computeCartItemsSignature(nextItems));
    };
    sync();
    setHydrated(true);
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [getTracker]);

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
    // Additive only — opening the drawer is a separate intent (openCart /
    // openCheckout) so callers pick the surface and no intermediate cart
    // screen can flash before checkout.
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

  // One logical checkout attempt = one cart contents (including item quantities).
  // If an attempt is idle, changing the cart invalidates the attempt id;
  // if a previous submit had an uncertain outcome, the attempt id is preserved
  // so the server can probe whether that attempt already created an order.
  const itemsSignature = useMemo(() => computeCartItemsSignature(items), [items]);
  const lastItemsSignatureRef = useRef(itemsSignature);
  useEffect(() => {
    if (lastItemsSignatureRef.current !== itemsSignature) {
      lastItemsSignatureRef.current = itemsSignature;
      getTracker().onCartChanged(itemsSignature);
    }
  }, [getTracker, itemsSignature]);

  const getCheckoutAttemptId = useCallback(() => {
    return getTracker().getAttemptId(itemsSignature);
  }, [getTracker, itemsSignature]);

  const beginCheckoutAttempt = useCallback(() => {
    return getTracker().beginSubmit(itemsSignature);
  }, [getTracker, itemsSignature]);

  const resolveCheckoutAttemptOutcome = useCallback((outcome: CheckoutAttemptOutcomeInput) => {
    getTracker().resolveOutcome(outcome, itemsSignature);
  }, [getTracker, itemsSignature]);

  const resetCheckoutAttemptId = useCallback(() => {
    getTracker().reset();
  }, [getTracker]);

  const completeOrder = useCallback((result: OrderConfirmation) => {
    clearGuestCart();
    setItems([]);
    setQuote(null);
    setIsOpen(false);
    setConfirmation(result);
    getTracker().reset();
  }, [getTracker]);
  const openCart = useCallback(() => {
    setOpenView('cart');
    setIsOpen(true);
  }, []);
  const openCheckout = useCallback(() => {
    setOpenView('checkout');
    setIsOpen(true);
  }, []);
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
    openView,
    hydrated,
    quote,
    quoteLoading,
    quoteError,
    confirmation,
    addItem,
    setQuantity,
    removeItem,
    openCart,
    openCheckout,
    closeCart,
    replaceQuote: setQuote,
    completeOrder,
    closeConfirmation,
    getCheckoutAttemptId,
    beginCheckoutAttempt,
    resolveCheckoutAttemptOutcome,
    resetCheckoutAttemptId,
  }), [
    items, itemsQuantity, isOpen, openView, hydrated, quote, quoteLoading, quoteError,
    confirmation, addItem, setQuantity, removeItem, completeOrder,
    openCart, openCheckout, closeCart, closeConfirmation,
    getCheckoutAttemptId, beginCheckoutAttempt, resolveCheckoutAttemptOutcome, resetCheckoutAttemptId,
  ]);

  return (
    <CartContext.Provider value={value}>
      {children}
      {(isOpen || confirmation) ? <CartDrawer /> : null}
    </CartContext.Provider>
  );
}
