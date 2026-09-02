'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { ContactMethod } from '@/lib/cart/contact-method';
import {
  CARMAT_INTEREST_OPTIONS,
  type CarMatInterest,
  type CarMatQuoteInput,
} from '@/lib/carmat-quote/types';

interface CarMatQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PhotoChoice = 'none' | 'all' | 'carzo-2' | 'carzo-3' | 'carzo-4';
type InformationChoice = 'none' | 'care' | 'materials';

const CONTACT_METHOD_OPTIONS: ReadonlyArray<{ value: ContactMethod; label: string }> = [
  { value: 'telegram', label: 'написати в Telegram' },
  { value: 'whatsapp', label: 'написати у WhatsApp' },
  { value: 'viber', label: 'написати у Viber' },
  { value: 'phone', label: 'зателефонувати' },
];

const PHOTO_OPTIONS: ReadonlyArray<{ value: PhotoChoice; label: string }> = [
  { value: 'none', label: 'Не отримувати' },
  { value: 'all', label: 'Усі дизайни' },
  { value: 'carzo-2', label: 'Carzo 2.0 (подовжений ромб)' },
  { value: 'carzo-3', label: 'Carzo 3.0 (Сота)' },
  { value: 'carzo-4', label: 'Carzo 4.0 (Urus)' },
];

const INFORMATION_OPTIONS: ReadonlyArray<{ value: InformationChoice; label: string }> = [
  { value: 'none', label: 'Не отримувати' },
  { value: 'care', label: 'Як доглядати за килимками' },
  { value: 'materials', label: 'Детально про матеріали' },
];

const INITIAL_FORM: CarMatQuoteInput = {
  customerName: '',
  customerPhone: '',
  carModel: '',
  carYear: '',
  bodyType: '',
  interest: 'salon',
  contactMethod: 'telegram',
  comment: '',
};

function normalizeSubscriberDigits(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('380')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 9);
}

function formatSubscriberPhone(value: string) {
  const digits = normalizeSubscriberDigits(value);
  const operator = digits.slice(0, 2);
  const first = digits.slice(2, 5);
  const second = digits.slice(5, 7);
  const third = digits.slice(7, 9);

  let formatted = operator ? `(${operator}` : '';
  if (operator.length === 2) formatted += ')';
  if (first) formatted += ` ${first}`;
  if (second) formatted += `-${second}`;
  if (third) formatted += `-${third}`;
  return formatted;
}

export default function CarMatQuoteModal({ isOpen, onClose }: CarMatQuoteModalProps) {
  const [form, setForm] = useState<CarMatQuoteInput>(INITIAL_FORM);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [informationOpen, setInformationOpen] = useState(false);
  const [photoChoices, setPhotoChoices] = useState<Set<PhotoChoice>>(
    () => new Set<PhotoChoice>(['none']),
  );
  const [informationChoices, setInformationChoices] = useState<Set<InformationChoice>>(
    () => new Set<InformationChoice>(['none']),
  );
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  const updateField = useCallback(<Key extends keyof CarMatQuoteInput>(
    key: Key,
    value: CarMatQuoteInput[Key],
  ) => {
    setForm(current => ({ ...current, [key]: value }));
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    setForm(INITIAL_FORM);
    setPhotosOpen(false);
    setInformationOpen(false);
    setPhotoChoices(new Set<PhotoChoice>(['none']));
    setInformationChoices(new Set<InformationChoice>(['none']));

    const body = document.body;
    const previousOverflow = body.style.overflow;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    body.style.overflow = 'hidden';
    contentRef.current?.scrollTo({ top: 0, left: 0 });

    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled])',
        ),
      ).filter(element => element.offsetParent !== null);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  const togglePhotoChoice = (choice: PhotoChoice) => {
    setPhotoChoices(current => {
      if (choice === 'none') {
        return current.has('none') ? new Set<PhotoChoice>() : new Set<PhotoChoice>(['none']);
      }
      if (choice === 'all') {
        return current.has('all') ? new Set<PhotoChoice>() : new Set<PhotoChoice>(['all']);
      }

      const next = new Set(current);
      next.delete('none');
      next.delete('all');
      if (next.has(choice)) next.delete(choice);
      else next.add(choice);
      return next;
    });
  };

  const toggleInformationChoice = (choice: InformationChoice) => {
    setInformationChoices(current => {
      if (choice === 'none') {
        return current.has('none')
          ? new Set<InformationChoice>()
          : new Set<InformationChoice>(['none']);
      }

      const next = new Set(current);
      next.delete('none');
      if (next.has(choice)) next.delete(choice);
      else next.add(choice);
      return next;
    });
  };

  const keepFocusedControlVisible = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLElement)) return;
    window.requestAnimationFrame(() => {
      event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  };

  return (
    <div
      ref={overlayRef}
      className={`cm-quote-overlay${isOpen ? ' cm-quote-overlay--open' : ''}`}
      aria-hidden={!isOpen}
      onClick={event => {
        if (event.target === overlayRef.current && isOpen) onClose();
      }}
    >
      <section
        ref={panelRef}
        className="cm-quote-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cm-quote-title"
        aria-describedby="cm-quote-intro"
      >
        <header className="cm-quote-header">
          <h2 id="cm-quote-title">Розрахунок вартості</h2>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Закрити форму">
            <X aria-hidden="true" size={22} />
          </button>
        </header>

        <form className="cm-quote-form" onSubmit={event => event.preventDefault()}>
          <div ref={contentRef} className="cm-quote-content" onFocusCapture={keepFocusedControlVisible}>
            <div className="cm-quote-intro">
              <p id="cm-quote-intro">Отримайте ціну максимально швидко та у зручний для вас спосіб</p>
              <p>Без нав’язливих дзвінків і повідомлень після розрахунку.</p>
            </div>

            <div className="cm-quote-fields">
              <label className="cm-quote-field cm-quote-field--placeholder">
                <span className="sr-only">Ім’я та прізвище</span>
                <input
                  required
                  name="customerName"
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  placeholder="Ім’я та прізвище"
                  value={form.customerName}
                  onChange={event => updateField('customerName', event.target.value)}
                />
              </label>

              <label className="cm-quote-field cm-quote-field--placeholder">
                <span className="sr-only">Телефон</span>
                <div className="cm-quote-phone">
                  <span className="cm-quote-ua-flag" aria-hidden="true" />
                  <span className="cm-quote-phone-prefix" aria-hidden="true">+380</span>
                  <input
                    required
                    name="customerPhone"
                    type="tel"
                    inputMode="tel"
                    maxLength={15}
                    autoComplete="tel"
                    aria-label="Телефон"
                    pattern="\([0-9]{2}\) [0-9]{3}-[0-9]{2}-[0-9]{2}"
                    placeholder="(00) 000-00-00"
                    value={formatSubscriberPhone(form.customerPhone)}
                    onChange={event => updateField('customerPhone', normalizeSubscriberDigits(event.target.value))}
                  />
                </div>
              </label>

              <label className="cm-quote-field cm-quote-field--placeholder">
                <span className="sr-only">Модель авто</span>
                <input
                  required
                  name="carModel"
                  maxLength={120}
                  placeholder="Модель авто"
                  value={form.carModel}
                  onChange={event => updateField('carModel', event.target.value)}
                />
              </label>

              <label className="cm-quote-field cm-quote-field--placeholder">
                <span className="sr-only">Рік випуску</span>
                <input
                  required
                  name="carYear"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  placeholder="Рік випуску"
                  value={form.carYear}
                  onChange={event => updateField('carYear', event.target.value.replace(/\D/g, '').slice(0, 4))}
                />
              </label>

              <label className="cm-quote-field cm-quote-field--placeholder">
                <span className="sr-only">Тип кузова</span>
                <input
                  required
                  name="bodyType"
                  maxLength={120}
                  placeholder="Тип кузова"
                  value={form.bodyType}
                  onChange={event => updateField('bodyType', event.target.value)}
                />
              </label>

              <label className="cm-quote-field cm-quote-field--select">
                <span>Що саме вас цікавить?</span>
                <select
                  name="interest"
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
                <span>Як ви бажаєте отримати інформацію?</span>
                <select
                  name="contactMethod"
                  value={form.contactMethod}
                  onChange={event => updateField('contactMethod', event.target.value as ContactMethod)}
                >
                  {CONTACT_METHOD_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" size={18} />
              </label>

              <label className="cm-quote-field cm-quote-field--placeholder">
                <span className="sr-only">Коментар (не обов’язково)</span>
                <textarea
                  name="comment"
                  rows={3}
                  maxLength={1000}
                  placeholder="коментар (не обов’язково)"
                  value={form.comment}
                  onChange={event => updateField('comment', event.target.value)}
                />
              </label>
            </div>

            <div className="cm-quote-accordions">
              <div className={`cm-quote-accordion${photosOpen ? ' cm-quote-accordion--open' : ''}`}>
                <button
                  id="cm-quote-photos-trigger"
                  type="button"
                  className="cm-quote-accordion-trigger"
                  aria-expanded={photosOpen}
                  aria-controls="cm-quote-photos-content"
                  onClick={() => setPhotosOpen(current => !current)}
                >
                  <span className="cm-quote-accordion-copy">
                    <strong>Отримати разом із розрахунком</strong>
                    <span>Фото виконаних робіт</span>
                  </span>
                  <span className="cm-quote-disclosure" aria-hidden="true">
                    <ChevronDown size={19} />
                  </span>
                </button>
                <div
                  id="cm-quote-photos-content"
                  className="cm-quote-accordion-content"
                  role="region"
                  aria-labelledby="cm-quote-photos-trigger"
                  aria-hidden={!photosOpen}
                >
                  <div className="cm-quote-accordion-content-inner" role="group" aria-label="Фото виконаних робіт">
                    {PHOTO_OPTIONS.map((option, index) => (
                      <label
                        key={option.value}
                        className={`cm-quote-check${index === 2 ? ' cm-quote-check--section' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={photoChoices.has(option.value)}
                          tabIndex={photosOpen ? 0 : -1}
                          onChange={() => togglePhotoChoice(option.value)}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`cm-quote-accordion${informationOpen ? ' cm-quote-accordion--open' : ''}`}>
                <button
                  id="cm-quote-information-trigger"
                  type="button"
                  className="cm-quote-accordion-trigger"
                  aria-expanded={informationOpen}
                  aria-controls="cm-quote-information-content"
                  onClick={() => setInformationOpen(current => !current)}
                >
                  <span className="cm-quote-accordion-copy">
                    <strong>Отримати разом із розрахунком</strong>
                    <span>Детально про догляд та матеріали</span>
                  </span>
                  <span className="cm-quote-disclosure" aria-hidden="true">
                    <ChevronDown size={19} />
                  </span>
                </button>
                <div
                  id="cm-quote-information-content"
                  className="cm-quote-accordion-content"
                  role="region"
                  aria-labelledby="cm-quote-information-trigger"
                  aria-hidden={!informationOpen}
                >
                  <div
                    className="cm-quote-accordion-content-inner"
                    role="group"
                    aria-label="Детально про догляд та матеріали"
                  >
                    {INFORMATION_OPTIONS.map((option, index) => (
                      <label
                        key={option.value}
                        className={`cm-quote-check${index === 1 ? ' cm-quote-check--section' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={informationChoices.has(option.value)}
                          tabIndex={informationOpen ? 0 : -1}
                          onChange={() => toggleInformationChoice(option.value)}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <footer className="cm-quote-submit">
            <button type="submit">Відправити дані</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
