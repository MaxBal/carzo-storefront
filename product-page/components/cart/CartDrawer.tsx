'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, ChevronDown, Info, Loader2, ShoppingCart, X } from 'lucide-react';
import PhoneInput from '@/components/PhoneInput';
import { createOrder } from '@/app/actions/checkout';
import { CONTACT_METHOD_OPTIONS, type ContactMethod } from '@/lib/cart/contact-method';
import { calculateLoyaltyDiscount, checkLoyaltyDiscount } from '@/lib/cart/loyalty';
import { buildFullPhone } from '@/lib/cart/phone';
import type { CheckoutDelivery, CheckoutResult } from '@/lib/cart/types';
import { DEFAULT_PAYMENT_OPTION, PAYMENT_OPTION_LABELS, PAYMENT_OPTION_VALUES, type PaymentOption } from '@/lib/cart/payment-option';
import { checkPostomatPackage } from '@/lib/cart/shipping';
import CartLineItems, { itemsCountLabel, money } from './CartLineItems';
import NovaPoshtaSelector from './NovaPoshtaSelector';
import NovaPoshtaTrustRow from './NovaPoshtaTrustRow';
import { useCart } from './cart-context';
import { useCartViewport } from './useCartViewport';

const MOBILE_MEDIA_QUERY = '(max-width: 639px)';
const MOBILE_SURFACE_FADE_MS = 150;

function deliveryIsComplete(delivery: CheckoutDelivery) {
  if (!delivery.cityRef) return false;
  if (delivery.method === 'COURIER') {
    return Boolean(delivery.streetRef && delivery.streetName.trim() && delivery.house.trim());
  }
  return Boolean(delivery.pointRef);
}

export default function CartDrawer() {
  const cart = useCart();
  const { isOpen, closeCart } = cart;
  // One-step checkout: «Купити» opens the drawer directly on the checkout
  // view (openView is set before mount, so no cart screen can flash).
  const [checkout, setCheckout] = useState(() => cart.openView === 'checkout');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentOption, setPaymentOption] = useState<PaymentOption>(DEFAULT_PAYMENT_OPTION);
  const [contactMethod, setContactMethod] = useState<ContactMethod>('phone');
  const [delivery, setDelivery] = useState<CheckoutDelivery>({ method: 'BRANCH', cityRef: '', pointRef: '' });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loyaltyOpen, setLoyaltyOpen] = useState(false);
  const [loyaltyPhone, setLoyaltyPhone] = useState('');
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);
  const [loyaltyPercent, setLoyaltyPercent] = useState<number | null>(null);
  const [loyaltyChecking, setLoyaltyChecking] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const { viewportRef, scrollRef } = useCartViewport(isOpen, checkout || loyaltyOpen);

  // «Деталі замовлення» always start collapsed on each entry into checkout.
  useEffect(() => {
    if (checkout) setDetailsOpen(false);
  }, [checkout]);

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
      setSubmitAttempted(false);
      setDelivery({ method: 'BRANCH', cityRef: '', pointRef: '' });
      setDetailsOpen(false);
      setLoyaltyOpen(false);
      setLoyaltyPhone('');
      setLoyaltyError(null);
      setLoyaltyPercent(null);
      setLoyaltyChecking(false);
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

  // Contact phone and loyalty phone are independent: editing the contact
  // number must never cancel an already-confirmed loyalty discount.
  const loyaltyPreview = cart.quote && loyaltyPercent !== null
    ? calculateLoyaltyDiscount({
      subtotal: cart.quote.subtotal,
      quantityDiscount: cart.quote.quantityDiscount,
      discountPercent: loyaltyPercent,
    })
    : null;
  const displayedTotal = cart.quote
    ? (loyaltyPreview ? loyaltyPreview.discountedTotal : cart.quote.total)
    : 0;

  const applyLoyalty = async () => {
    if (!cart.quote) return;
    setLoyaltyChecking(true);
    setLoyaltyError(null);
    try {
      const result = await checkLoyaltyDiscount(buildFullPhone(loyaltyPhone));
      if (result.eligible) {
        setLoyaltyPercent(result.discountPercent);
        // Confirmed loyalty number is copied into the contact phone field
        // (PhoneInput format); the buyer may keep or change it later.
        setCustomerPhone(loyaltyPhone);
      } else {
        setLoyaltyPercent(null);
        setLoyaltyError('Не знайшли цей номер серед попередніх замовлень.');
      }
    } finally {
      setLoyaltyChecking(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);
    if (!cart.quote || !deliveryIsComplete(delivery)) {
      setSubmitError('Заповніть контактні дані та адресу доставки.');
      return;
    }
    const shippingPackage = cart.quote.shippingPackage;
    if (delivery.method === 'POSTOMAT' && shippingPackage
      && checkPostomatPackage(shippingPackage).status !== 'fits') {
      setSubmitError('Для цього замовлення недоступна доставка у поштомати. Оберіть інший спосіб або місце доставки.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const loyaltyPhoneDigits = loyaltyPhone.replace(/\D/g, '');
    // Loyalty phone reaches the server only after the buyer explicitly
    // confirmed it with the apply button — never from a bare typed value.
    const confirmedLoyaltyPhone = loyaltyPercent !== null && loyaltyPhoneDigits
      ? buildFullPhone(loyaltyPhone)
      : undefined;
    const checkoutAttemptId = cart.getCheckoutAttemptId();
    let result: CheckoutResult;
    try {
      result = await createOrder({
        items: cart.items,
        expectedTotal: displayedTotal,
        expectedBaseTotal: cart.quote.total,
        customerName,
        customerPhone: buildFullPhone(customerPhone),
        loyaltyPhone: confirmedLoyaltyPhone,
        contactMethod,
        paymentOption,
        delivery,
        checkoutAttemptId,
      });
    } catch {
      result = { ok: false, code: 'FAILED', message: 'Не вдалося оформити замовлення. Кошик збережено.' };
    }
    setSubmitting(false);
    if (result.ok) {
      cart.completeOrder({ orderNumber: result.orderNumber, total: result.total });
      return;
    }
    if (result.code === 'ATTEMPT_REUSED') {
      // The attempt id is bound to a different already-placed order.
      // Start a fresh attempt so the next submit can succeed.
      cart.resetCheckoutAttemptId();
    }
    if (result.code === 'PRICE_CHANGED' || result.code === 'LOYALTY_CHANGED') {
      cart.replaceQuote(result.quote);
      setLoyaltyPercent(result.loyalty.discountPercent > 0 ? result.loyalty.discountPercent : null);
    }
    setSubmitError(result.message);
  };

  return (
    <>
      {cart.isOpen && (
        <div data-cart-screen-cover data-closing={closing ? 'true' : 'false'} className="fixed inset-0 z-[300] bg-white sm:bg-transparent" role="presentation">
          <div ref={viewportRef} data-cart-interactive-viewport className="absolute inset-x-0 top-0 h-[100dvh] sm:inset-0 sm:h-auto">
            <button type="button" aria-label="Закрити кошик" className="absolute inset-0 hidden bg-black/55 backdrop-blur-[1px] sm:block" onClick={closeSurface} />
            <aside role="dialog" aria-modal="true" aria-labelledby="cart-title" className="absolute inset-y-0 right-0 flex h-full w-full max-w-none flex-col overflow-hidden bg-white sm:max-w-[520px] sm:shadow-2xl">
            <div data-checkout-header>
              <div data-checkout-header-inner className="flex h-[52px] sm:h-16 shrink-0 items-center justify-between border-b border-gray-200 px-4 sm:px-6">
                <div className="flex items-center gap-2.5">
                  <ShoppingCart size={20} strokeWidth={1.6} />
                  <h2 id="cart-title" className="text-base font-semibold leading-5">{checkout ? 'Оформлення замовлення' : 'Кошик'}</h2>
                  {!checkout && cart.itemsQuantity > 0 && <span className="rounded-full bg-black px-2 py-0.5 text-xs font-semibold text-white">{cart.itemsQuantity}</span>}
                </div>
                <button type="button" onClick={closeSurface} className="form-close-btn" aria-label="Закрити">
                  <X size={22} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 py-5 [scrollbar-gutter:stable] sm:px-6">
              {cart.items.length === 0 ? (
                <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100"><ShoppingCart size={28} strokeWidth={1.6} /></div>
                  <h3 className="text-xl font-bold">Кошик порожній</h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-gray-500">Оберіть автокейс, налаштуйте його та натисніть «Купити».</p>
                  <button type="button" onClick={closeSurface} className="mt-6 form-cta" style={{ maxWidth: 280 }}>Продовжити покупки</button>
                </div>
              ) : checkout ? (
                <form id="checkout-form" onSubmit={submit} className="space-y-4">
                  <div className="rounded-2xl border border-gray-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setDetailsOpen(value => !value)}
                      aria-expanded={detailsOpen}
                      aria-label="Деталі замовлення"
                      className="flex w-full flex-col gap-1.5 px-4 py-3 text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold leading-5 text-gray-900">Деталі замовлення</p>
                        <ChevronDown size={18} className={`shrink-0 text-gray-400 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
                      </div>
                      {!detailsOpen && (
                        <div>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-[13px] leading-[1.4] text-gray-600">
                              {itemsCountLabel(cart.quote?.itemsQuantity ?? cart.itemsQuantity)}
                            </span>
                            <span className="text-[15px] font-bold leading-[1.3]">
                              {cart.quote ? `${money(displayedTotal)} ₴` : '…'}
                            </span>
                          </div>
                          {cart.quote && cart.quote.quantityDiscount > 0 && (
                            <p className="mt-0.5 text-[13px] font-medium leading-[1.4] text-[#00a382]">
                              Разом дешевше −{money(cart.quote.quantityDiscount)} ₴
                            </p>
                          )}
                        </div>
                      )}
                    </button>

                    {detailsOpen && (
                      <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                        {cart.quoteLoading && !cart.quote && (
                          <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
                            <Loader2 className="animate-spin" size={18} /> Перераховуємо кошик…
                          </div>
                        )}
                        {cart.quoteError && <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{cart.quoteError}</div>}
                        {cart.quote && (
                          <>
                            <CartLineItems
                              lines={cart.quote.lines}
                              onQuantityChange={cart.setQuantity}
                              onRemove={cart.removeItem}
                              onNavigate={closeSurface}
                            />

                            <div className="mt-3 border-t border-gray-100 pt-3">
                              <button
                                type="button"
                                onClick={() => setLoyaltyOpen(value => !value)}
                                aria-expanded={loyaltyOpen}
                                className="flex w-full items-center justify-between gap-2 text-left"
                                aria-label="Знижка постійного клієнта"
                              >
                                <div className="min-w-0">
                                  <p className="text-[14px] font-semibold leading-[1.3] text-gray-900">Знижка постійного клієнта</p>
                                  <p className="mt-0.5 text-[12px] leading-[1.35] text-gray-500">
                                    {loyaltyOpen ? 'Введіть номер телефону, щоб застосувати знижку.' : 'Вже замовляли у Carzo? Отримайте −5%'}
                                  </p>
                                </div>
                                <ChevronDown size={17} className={`shrink-0 text-gray-400 transition-transform ${loyaltyOpen ? 'rotate-180' : ''}`} />
                              </button>
                              {loyaltyOpen && (
                                <div className="mt-2.5">
                                  <div className="flex items-center gap-2.5">
                                    <div className="min-w-0 flex-1">
                                      <PhoneInput
                                        value={loyaltyPhone}
                                        onChange={value => { setLoyaltyPhone(value); setLoyaltyError(null); setLoyaltyPercent(null); }}
                                        placeholder="(00) 000-00-00"
                                        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyLoyalty(); } }}
                                      />
                                    </div>
                                    <button type="button" onClick={applyLoyalty} disabled={loyaltyChecking} aria-label="Застосувати знижку" className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[11px] bg-black text-white disabled:opacity-50">
                                      {loyaltyChecking ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} strokeWidth={2.5} />}
                                    </button>
                                  </div>
                                  {loyaltyError && <p className="mt-2 text-xs text-[#ca423d]">{loyaltyError}</p>}
                                  {loyaltyPercent !== null && !loyaltyError && (
                                    <p className="mt-2 text-xs font-medium text-[#00a382]">Знижку {loyaltyPercent}% застосовано</p>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 text-sm">
                              <div className="flex justify-between text-gray-600"><span>Товари ({cart.quote.itemsQuantity})</span><span>{money(cart.quote.subtotal)} ₴</span></div>
                              {cart.quote.quantityDiscount > 0 && <div className="flex justify-between font-medium text-[#00a382]"><span>Разом дешевше</span><span>−{money(cart.quote.quantityDiscount)} ₴</span></div>}
                              {loyaltyPreview && (
                                <div className="flex justify-between font-medium text-[#ca423d]">
                                  <span className="flex items-center gap-1.5"><Check size={14} strokeWidth={2.5} className="rounded-full" /> Знижку {loyaltyPercent}% застосовано</span>
                                  <span>−{money(loyaltyPreview.amount)} ₴</span>
                                </div>
                              )}
                              <div className="flex justify-between border-t border-gray-100 pt-2.5 text-lg font-bold"><span>Разом</span><span>{money(displayedTotal)} ₴</span></div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3">
                    <label className="form-field">
                      <span className="sr-only">Імʼя та прізвище</span>
                      <input required minLength={2} maxLength={120} value={customerName} onChange={event => setCustomerName(event.target.value)} autoComplete="name" placeholder="Ім’я та прізвище" />
                    </label>
                    <label className="form-field">
                      <span className="sr-only">Телефон</span>
                      <PhoneInput
                        required
                        name="customerPhone"
                        value={customerPhone}
                        onChange={setCustomerPhone}
                        placeholder="(00) 000-00-00"
                      />
                    </label>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <h3 className="form-section-label">Адреса доставки</h3>
                    <div className="mt-3">
                      <NovaPoshtaSelector
                        shippingPackage={cart.quote?.shippingPackage ?? null}
                        value={delivery}
                        showErrors={submitAttempted}
                        onChange={setDelivery}
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex gap-4" role="radiogroup" aria-label="Варіант оплати">
                      {PAYMENT_OPTION_VALUES.map(option => (
                        <label key={option} className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-[13px] leading-5 text-gray-900 sm:text-sm">
                          <input
                            type="radio"
                            name="payment-option"
                            value={option}
                            checked={paymentOption === option}
                            onChange={() => setPaymentOption(option)}
                            className="h-4 w-4 shrink-0 accent-black"
                          />
                          {PAYMENT_OPTION_LABELS[option]}
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-gray-500">Оплата на рахунок (IBAN) ФОП після підтвердження замовлення.</p>
                  </div>

                  <label className="form-field relative block border-t border-gray-100 pt-4">
                    <span className="form-section-label">Спосіб зв’язку *</span>
                    <div className="relative mt-3">
                      <select required value={contactMethod} onChange={event => setContactMethod(event.target.value as ContactMethod)}>
                        {CONTACT_METHOD_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    </div>
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
                  {cart.quoteLoading && !cart.quote && <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500"><Loader2 className="animate-spin" size={18} /> Перераховуємо кошик…</div>}
                  {cart.quoteError && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{cart.quoteError}</div>}
                  {cart.quote && (
                    <CartLineItems
                      lines={cart.quote.lines}
                      onQuantityChange={cart.setQuantity}
                      onRemove={cart.removeItem}
                      onNavigate={closeSurface}
                    />
                  )}
                </div>
              )}
            </div>

            {cart.items.length > 0 && cart.quote && checkout && (
              <div data-checkout-submit-footer className="shrink-0 border-t border-gray-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-4">
                <button form="checkout-form" type="submit" disabled={submitting || !cart.quote.canCheckout} className="form-cta">
                  {submitting && <Loader2 className="animate-spin" size={17} />}
                  <span>Підтвердити</span>
                </button>
                <NovaPoshtaTrustRow />
              </div>
            )}

            {cart.items.length > 0 && cart.quote && !checkout && (
              <div className="shrink-0 border-t border-gray-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600"><span>Товари ({cart.quote.itemsQuantity})</span><span>{money(cart.quote.subtotal)} ₴</span></div>
                  {cart.quote.quantityDiscount > 0 && <div className="flex justify-between font-medium text-[#00a382]"><span>Разом дешевше</span><span>−{money(cart.quote.quantityDiscount)} ₴</span></div>}
                  <div className="flex justify-between border-t border-gray-100 pt-3 text-lg font-bold"><span>Разом</span><span>{money(cart.quote.total)} ₴</span></div>
                </div>
                <button type="button" onClick={() => setCheckout(true)} disabled={cart.quoteLoading || !cart.quote.canCheckout} className="form-cta mt-4">Оформити замовлення</button>
                <NovaPoshtaTrustRow />
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
            <button type="button" onClick={cart.closeConfirmation} className="form-cta mt-6">Готово</button>
          </div>
        </div>
      )}
    </>
  );
}
