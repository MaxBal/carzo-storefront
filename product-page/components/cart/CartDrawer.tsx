'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronDown, Info, Loader2, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { createOrder } from '@/app/actions/checkout';
import { CONTACT_METHOD_OPTIONS, type ContactMethod } from '@/lib/cart/contact-method';
import { formatUkrainePhoneInput, UKRAINE_PHONE_MASK_PREFIX, UKRAINE_PHONE_PATTERN } from '@/lib/cart/phone';
import type { CheckoutResult } from '@/lib/cart/types';
import NovaPoshtaSelector from './NovaPoshtaSelector';
import { useCart } from './cart-context';
import { useCartViewport } from './useCartViewport';

const MOBILE_MEDIA_QUERY = '(max-width: 639px)';
const MOBILE_SURFACE_FADE_MS = 150;

function money(value: number) {
  return new Intl.NumberFormat('uk-UA').format(value);
}

export default function CartDrawer() {
  const cart = useCart();
  const { isOpen, closeCart } = cart;
  const [checkout, setCheckout] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState(UKRAINE_PHONE_MASK_PREFIX);
  const [customerComment, setCustomerComment] = useState('');
  const [contactMethod, setContactMethod] = useState<ContactMethod>('phone');
  const [cityRef, setCityRef] = useState('');
  const [pointRef, setPointRef] = useState('');
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const { viewportRef, scrollRef } = useCartViewport(isOpen);

  const closeSurface = useCallback(() => {
    if (!window.matchMedia(MOBILE_MEDIA_QUERY).matches) {
      closeCart();
      return;
    }
    if (closeTimerRef.current !== null) return;

    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      closeCart();
      setClosing(false);
    }, MOBILE_SURFACE_FADE_MS);
  }, [closeCart]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setClosing(false);
      setCheckout(false);
      setSubmitError(null);
      return;
    }
    const body = document.body;
    const root = document.documentElement;
    const scrollY = window.scrollY;
    const previousBodyStyles = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    const previousOverscrollBehavior = root.style.overscrollBehavior;
    Object.assign(body.style, {
      overflow: 'hidden',
      position: 'fixed',
      top: `-${scrollY}px`,
      left: '0',
      right: '0',
      width: '100%',
    });
    root.style.overscrollBehavior = 'none';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSurface();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      Object.assign(body.style, previousBodyStyles);
      root.style.overscrollBehavior = previousOverscrollBehavior;
      window.scrollTo(0, scrollY);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, closeSurface]);

  if (!cart.isOpen && !cart.confirmation) return null;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cart.quote || !cityRef || !pointRef) {
      setSubmitError('Заповніть контактні дані та оберіть точку доставки.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    let result: CheckoutResult;
    try {
      result = await createOrder({
        items: cart.items,
        expectedTotal: cart.quote.total,
        customerName,
        customerPhone,
        customerComment,
        contactMethod,
        deliveryCityRef: cityRef,
        deliveryPointRef: pointRef,
      });
    } catch {
      result = { ok: false, code: 'FAILED', message: 'Не вдалося оформити замовлення. Кошик збережено.' };
    }
    setSubmitting(false);
    if (result.ok) {
      cart.completeOrder({ orderNumber: result.orderNumber, total: result.total });
      return;
    }
    if (result.code === 'PRICE_CHANGED') cart.replaceQuote(result.quote);
    setSubmitError(result.message);
  };

  return (
    <>
      {cart.isOpen && (
        <div data-cart-screen-cover data-closing={closing ? 'true' : 'false'} className="fixed inset-0 z-[300] bg-white sm:bg-transparent" role="presentation">
          <div ref={viewportRef} data-cart-interactive-viewport className="absolute inset-x-0 top-0 h-[100dvh] sm:inset-0 sm:h-auto">
            <button type="button" aria-label="Закрити кошик" className="absolute inset-0 hidden bg-black/55 backdrop-blur-[1px] sm:block" onClick={closeSurface} />
            <aside role="dialog" aria-modal="true" aria-labelledby="cart-title" className="absolute inset-y-0 right-0 flex h-full w-full max-w-none flex-col overflow-hidden bg-white sm:max-w-[520px] sm:shadow-2xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 px-4 sm:px-6">
              <div className="flex items-center gap-2.5">
                <ShoppingBag size={20} />
                <h2 id="cart-title" className="text-lg font-bold">{checkout ? 'Оформлення замовлення' : 'Кошик'}</h2>
                {!checkout && cart.itemsQuantity > 0 && <span className="rounded-full bg-black px-2 py-0.5 text-xs font-semibold text-white">{cart.itemsQuantity}</span>}
              </div>
              <button type="button" onClick={closeSurface} className="rounded-full p-2 hover:bg-gray-100" aria-label="Закрити">
                <X size={21} />
              </button>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 py-5 [scrollbar-gutter:stable] sm:px-6">
              {cart.items.length === 0 ? (
                <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100"><ShoppingBag size={28} /></div>
                  <h3 className="text-xl font-bold">Кошик порожній</h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-gray-500">Оберіть автокейс, налаштуйте його та натисніть «Купити».</p>
                  <button type="button" onClick={closeSurface} className="mt-6 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white">Продовжити покупки</button>
                </div>
              ) : checkout ? (
                <form id="checkout-form" onSubmit={submit} className="space-y-5">
                  <div>
                    <h3 className="text-base font-bold">Контактні дані</h3>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <label className="sm:col-span-2">
                        <span className="mb-1.5 block text-sm font-medium">Імʼя та прізвище *</span>
                        <input required minLength={2} maxLength={120} value={customerName} onChange={event => setCustomerName(event.target.value)} autoComplete="name" className="h-12 w-full rounded-xl border border-gray-200 px-3 text-base outline-none focus:border-gray-500 sm:text-sm" />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="mb-1.5 block text-sm font-medium">Телефон *</span>
                        <input required type="tel" inputMode="tel" autoComplete="tel" maxLength={19} pattern={UKRAINE_PHONE_PATTERN} value={customerPhone} onChange={event => setCustomerPhone(formatUkrainePhoneInput(event.target.value))} className="h-12 w-full rounded-xl border border-gray-200 px-3 text-base outline-none focus:border-gray-500 sm:text-sm" />
                      </label>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-5">
                    <h3 className="mb-3 text-base font-bold">Доставка Новою поштою</h3>
                    <NovaPoshtaSelector
                      allowPostomat={Boolean(cart.quote?.allowPostomat)}
                      cityRef={cityRef}
                      pointRef={pointRef}
                      onCityChange={setCityRef}
                      onPointChange={setPointRef}
                    />
                  </div>

                  <label className="block border-t border-gray-100 pt-5">
                    <span className="mb-1.5 block text-sm font-medium">Коментар до замовлення</span>
                    <textarea value={customerComment} onChange={event => setCustomerComment(event.target.value)} maxLength={1000} rows={3} className="w-full resize-none rounded-xl border border-gray-200 px-3 py-3 text-base outline-none focus:border-gray-500 sm:text-sm" />
                  </label>

                  <label className="relative block border-t border-gray-100 pt-5">
                    <span className="mb-1.5 block text-sm font-medium">Спосіб зв’язку *</span>
                    <select required value={contactMethod} onChange={event => setContactMethod(event.target.value as ContactMethod)} className="h-12 w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 pr-10 text-base outline-none focus:border-gray-500 sm:text-sm">
                      {CONTACT_METHOD_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <ChevronDown aria-hidden="true" className="pointer-events-none absolute bottom-3.5 right-3 text-gray-400" size={18} />
                  </label>

                  {cart.quote?.checkoutPaymentDetails && (
                    <div className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700">
                      <Info aria-hidden="true" className="mt-0.5 shrink-0 text-gray-500" size={18} />
                      <p className="whitespace-pre-line">{cart.quote?.checkoutPaymentDetails}</p>
                    </div>
                  )}
                  {submitError && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{submitError}</div>}
                </form>
              ) : (
                <div className="space-y-4">
                  {(cart.quote?.lines ?? []).map(line => (
                    <article key={line.itemKey} className="rounded-2xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link href={line.productUrl} onClick={closeSurface} className="font-semibold leading-5 hover:underline">{line.title}</Link>
                          <p className="mt-1 text-xs leading-5 text-gray-500">{line.sizeLabel} · {line.brandName}<br />{line.fixationLabel}</p>
                        </div>
                        <button type="button" onClick={() => cart.removeItem(line.itemKey)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600" aria-label={`Видалити ${line.title}`}><Trash2 size={17} /></button>
                      </div>
                      {!line.inStock && <p className="mt-3 text-sm font-medium text-red-600">Тимчасово немає в наявності</p>}
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center rounded-full border border-gray-200">
                          <button type="button" onClick={() => cart.setQuantity(line.itemKey, line.quantity - 1)} disabled={line.quantity <= 1} className="p-2.5 disabled:opacity-30" aria-label="Зменшити кількість"><Minus size={15} /></button>
                          <span className="min-w-8 text-center text-sm font-semibold">{line.quantity}</span>
                          <button type="button" onClick={() => cart.setQuantity(line.itemKey, line.quantity + 1)} disabled={line.quantity >= 20} className="p-2.5 disabled:opacity-30" aria-label="Збільшити кількість"><Plus size={15} /></button>
                        </div>
                        <div className="text-right">
                          {line.quantity > 1 && <p className="text-xs text-gray-500">{money(line.unitPrice)} ₴ / шт.</p>}
                          <p className="font-bold">{money(line.lineTotal)} ₴</p>
                        </div>
                      </div>
                    </article>
                  ))}
                  {cart.quoteLoading && !cart.quote && <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500"><Loader2 className="animate-spin" size={18} /> Перераховуємо кошик…</div>}
                  {cart.quoteError && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{cart.quoteError}</div>}
                </div>
              )}
            </div>

            {cart.items.length > 0 && cart.quote && checkout && (
              <div data-checkout-submit-footer className="shrink-0 border-t border-gray-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-4">
                <button form="checkout-form" type="submit" disabled={submitting || !cart.quote.canCheckout} className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  {submitting && <Loader2 className="animate-spin" size={17} />}
                  <span>Підтвердити</span>
                </button>
              </div>
            )}

            {cart.items.length > 0 && cart.quote && !checkout && (
              <div className="shrink-0 border-t border-gray-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600"><span>Товари ({cart.quote.itemsQuantity})</span><span>{money(cart.quote.subtotal)} ₴</span></div>
                  {cart.quote.quantityDiscount > 0 && <div className="flex justify-between font-medium text-[#159e85]"><span>Разом дешевше</span><span>−{money(cart.quote.quantityDiscount)} ₴</span></div>}
                  <div className="flex justify-between border-t border-gray-100 pt-3 text-lg font-bold"><span>Разом</span><span>{money(cart.quote.total)} ₴</span></div>
                </div>
                <button type="button" onClick={() => setCheckout(true)} disabled={cart.quoteLoading || !cart.quote.canCheckout} className="mt-4 w-full rounded-xl bg-black px-4 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Оформити замовлення</button>
              </div>
            )}
            </aside>
          </div>
        </div>
      )}

      {cart.confirmation && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true" aria-labelledby="order-confirmed-title">
          <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl sm:p-9">
            <CheckCircle2 className="mx-auto text-[#159e85]" size={52} strokeWidth={1.7} />
            <h2 id="order-confirmed-title" className="mt-5 text-2xl font-bold">Замовлення оформлено</h2>
            <p className="mt-3 text-gray-600">Ваше замовлення</p>
            <p className="mt-1 text-xl font-bold">№ {cart.confirmation.orderNumber}</p>
            <p className="mt-3 text-sm leading-6 text-gray-500">Менеджер звʼяжеться з вами для підтвердження. Сума замовлення: {money(cart.confirmation.total)} ₴.</p>
            <button type="button" onClick={cart.closeConfirmation} className="mt-6 w-full rounded-xl bg-black px-5 py-3.5 text-sm font-semibold text-white">Готово</button>
          </div>
        </div>
      )}
    </>
  );
}
