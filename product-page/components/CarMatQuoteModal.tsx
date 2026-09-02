'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Loader2, X } from 'lucide-react';
import { submitCarMatQuote } from '@/app/actions/carmat-quote';
import { CONTACT_METHOD_OPTIONS, type ContactMethod } from '@/lib/cart/contact-method';
import { formatUkrainePhoneInput, UKRAINE_PHONE_MASK_PREFIX, UKRAINE_PHONE_PATTERN } from '@/lib/cart/phone';
import {
  CARMAT_INTEREST_OPTIONS,
  type CarMatInterest,
  type CarMatQuoteInput,
  type CarMatQuoteResult,
} from '@/lib/carmat-quote/types';

interface CarMatQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const INITIAL_FORM: CarMatQuoteInput = {
  customerName: '',
  customerPhone: UKRAINE_PHONE_MASK_PREFIX,
  carModel: '',
  carYear: '',
  bodyType: '',
  interest: 'salon',
  contactMethod: 'phone',
  comment: '',
};

export default function CarMatQuoteModal({ isOpen, onClose }: CarMatQuoteModalProps) {
  const [form, setForm] = useState<CarMatQuoteInput>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const updateField = useCallback(<Key extends keyof CarMatQuoteInput>(
    key: Key,
    value: CarMatQuoteInput[Key],
  ) => {
    setForm(current => ({ ...current, [key]: value }));
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) return;
    setForm(INITIAL_FORM);
    setSubmitting(false);
    setSubmitError(null);
    setSubmitted(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    let result: CarMatQuoteResult;
    try {
      result = await submitCarMatQuote(form);
    } catch {
      result = {
        ok: false,
        message: 'Не вдалося надіслати заявку. Спробуйте ще раз або напишіть нам у месенджер.',
      };
    }

    setSubmitting(false);
    if (result.ok) {
      setSubmitted(true);
      return;
    }
    setSubmitError(result.message);
  };

  return (
    <div
      ref={backdropRef}
      className="cm-quote-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cm-quote-title"
      onClick={event => {
        if (event.target === backdropRef.current && !submitting) onClose();
      }}
    >
      <section className="cm-quote-panel">
        <header className="cm-quote-header">
          <div>
            <h2 id="cm-quote-title">Замовте прорахунок килимків для вашого авто</h2>
            <p>Отримайте ціну максимально швидко та у зручний для вас спосіб</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Закрити форму">
            <X size={20} />
          </button>
        </header>

        {submitted ? (
          <div className="cm-quote-success" role="status">
            <CheckCircle2 size={52} strokeWidth={1.7} />
            <h3>Заявку надіслано</h3>
            <p>Дякуємо! Менеджер звʼяжеться з вами обраним способом і повідомить вартість.</p>
            <button type="button" onClick={onClose}>Готово</button>
          </div>
        ) : (
          <form className="cm-quote-form" onSubmit={submit}>
            <div className="cm-quote-fields">
              <label className="cm-quote-field cm-quote-field--wide">
                <span>Імʼя та прізвище *</span>
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  value={form.customerName}
                  onChange={event => updateField('customerName', event.target.value)}
                />
              </label>

              <label className="cm-quote-field cm-quote-field--wide">
                <span>Телефон *</span>
                <input
                  required
                  type="tel"
                  inputMode="tel"
                  maxLength={19}
                  autoComplete="tel"
                  pattern={UKRAINE_PHONE_PATTERN}
                  value={form.customerPhone}
                  onChange={event => updateField('customerPhone', formatUkrainePhoneInput(event.target.value))}
                />
              </label>

              <label className="cm-quote-field cm-quote-field--wide">
                <span>Модель авто *</span>
                <input
                  required
                  maxLength={120}
                  placeholder="Наприклад, Volkswagen Passat"
                  value={form.carModel}
                  onChange={event => updateField('carModel', event.target.value)}
                />
              </label>

              <label className="cm-quote-field">
                <span>Рік випуску *</span>
                <input
                  required
                  type="number"
                  inputMode="numeric"
                  min="1950"
                  max={new Date().getFullYear() + 1}
                  placeholder="2020"
                  value={form.carYear}
                  onChange={event => updateField('carYear', event.target.value.slice(0, 4))}
                />
              </label>

              <label className="cm-quote-field">
                <span>Тип кузова *</span>
                <input
                  required
                  maxLength={120}
                  placeholder="Седан, універсал…"
                  value={form.bodyType}
                  onChange={event => updateField('bodyType', event.target.value)}
                />
              </label>

              <label className="cm-quote-field cm-quote-field--select">
                <span>Що саме вас цікавить?</span>
                <select
                  value={form.interest}
                  onChange={event => updateField('interest', event.target.value as CarMatInterest)}
                >
                  {CARMAT_INTEREST_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" size={18} />
              </label>

              <label className="cm-quote-field cm-quote-field--select">
                <span>Як вам зручно отримати інформацію?</span>
                <select
                  value={form.contactMethod}
                  onChange={event => updateField('contactMethod', event.target.value as ContactMethod)}
                >
                  {CONTACT_METHOD_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" size={18} />
              </label>

              <label className="cm-quote-field cm-quote-field--wide">
                <span>Коментар</span>
                <textarea
                  rows={3}
                  maxLength={1000}
                  placeholder="Необовʼязково"
                  value={form.comment}
                  onChange={event => updateField('comment', event.target.value)}
                />
              </label>
            </div>

            {submitError ? <p className="cm-quote-error" role="alert">{submitError}</p> : null}

            <div className="cm-quote-submit">
              <button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
                <span>{submitting ? 'Надсилаємо…' : 'Відправити дані'}</span>
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
