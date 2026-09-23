'use client';

import { useCallback, useRef } from 'react';
import {
  countDigitsBefore,
  formatSubscriberPhone,
  indexAfterNthDigit,
  normalizeSubscriberDigits,
} from '@/lib/cart/phone';

interface PhoneInputProps {
  /** Subscriber digits only (max 9), e.g. "931234567". */
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  autoComplete?: string;
  className?: string;
  inputClassName?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  pattern?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
}

/**
 * Shared Ukraine phone input with visual prefix "🇺🇦 +380" and mask "(XX) XXX-XX-XX".
 *
 * State stores subscriber digits only. Formatting characters never block
 * Backspace / Delete — they operate on the digit sequence directly.
 */
export default function PhoneInput({
  value,
  onChange,
  placeholder = '(00) 000-00-00',
  disabled,
  required,
  name,
  autoComplete,
  className = 'form-phone',
  inputClassName = '',
  onKeyDown,
  onBlur,
  ...aria
}: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const formatted = formatSubscriberPhone(value);

  const setCaret = useCallback((digitsBefore: number) => {
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      const pos = indexAfterNthDigit(formatSubscriberPhone(value), digitsBefore);
      input.setSelectionRange(pos, pos);
    });
  }, [value]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const cursorPos = event.target.selectionStart ?? raw.length;
    const digitsBefore = countDigitsBefore(raw, cursorPos);
    const newDigits = normalizeSubscriberDigits(raw);

    onChange(newDigits);

    // Caret is set after re-render; value is the new digits
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      const pos = indexAfterNthDigit(formatSubscriberPhone(newDigits), digitsBefore);
      input.setSelectionRange(pos, pos);
    });
  }, [onChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const pos = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const hasSelection = pos !== end;

    if (event.key === 'Backspace' && !hasSelection) {
      // If the char before the caret is a formatting char, skip over it
      // and remove the nearest digit before it instead.
      const charBefore = pos > 0 ? formatted[pos - 1] : '';
      if (charBefore && !/\d/.test(charBefore)) {
        event.preventDefault();
        const digitsBefore = countDigitsBefore(formatted, pos - 1);
        if (digitsBefore > 0) {
          const newDigits = value.slice(0, digitsBefore - 1) + value.slice(digitsBefore);
          onChange(newDigits);
          requestAnimationFrame(() => {
            const el = inputRef.current;
            if (!el) return;
            const newPos = indexAfterNthDigit(formatSubscriberPhone(newDigits), digitsBefore - 1);
            el.setSelectionRange(newPos, newPos);
          });
        }
      }
    } else if (event.key === 'Delete' && !hasSelection) {
      const charAt = pos < formatted.length ? formatted[pos] : '';
      if (charAt && !/\d/.test(charAt)) {
        event.preventDefault();
        const digitsBefore = countDigitsBefore(formatted, pos + 1);
        if (digitsBefore < value.length) {
          const newDigits = value.slice(0, digitsBefore) + value.slice(digitsBefore + 1);
          onChange(newDigits);
          requestAnimationFrame(() => {
            const el = inputRef.current;
            if (!el) return;
            const newPos = indexAfterNthDigit(formatSubscriberPhone(newDigits), digitsBefore);
            el.setSelectionRange(newPos, newPos);
          });
        }
      }
    }

    onKeyDown?.(event);
  }, [formatted, value, onChange, onKeyDown]);

  return (
    <div className={className}>
      <span className="form-ua-flag" aria-hidden="true" />
      <span className="form-phone-prefix" aria-hidden="true">+380</span>
      <input
        ref={inputRef}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete ?? 'tel'}
        required={required}
        disabled={disabled}
        name={name}
        maxLength={15}
        value={formatted}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        className={inputClassName}
        {...aria}
      />
    </div>
  );
}
