'use server';

import { contactMethodLabel } from '@/lib/cart/contact-method';
import {
  CARMAT_INFORMATION_OPTIONS,
  CARMAT_INTEREST_OPTIONS,
  CARMAT_PHOTO_OPTIONS,
  type CarMatInformationChoice,
  type CarMatPhotoChoice,
} from '@/lib/carmat-quote/types';
import { carMatQuoteSchema } from '@/lib/carmat-quote/validation';
import { QUOTE_MAINTENANCE_MESSAGE, isCheckoutMaintenance } from '@/lib/checkout-maintenance';
import { sendCarMatQuoteTelegram } from '@/lib/carmat-quote/notifications';
import type { CarMatQuoteInput, CarMatQuoteResult } from '@/lib/carmat-quote/types';

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `+38${digits}`;
  if (digits.length === 12 && digits.startsWith('380')) return `+${digits}`;
  return null;
}

function labelsFor<T extends string>(
  values: readonly T[] | undefined,
  options: ReadonlyArray<{ value: T; label: string }>,
): string[] {
  if (!values?.length) return [];
  return values
    .map(value => options.find(option => option.value === value)?.label)
    .filter((label): label is string => Boolean(label));
}

function photoLabels(values: CarMatPhotoChoice[] | undefined): string[] {
  const active = values?.filter(value => value !== 'none') ?? [];
  return labelsFor(active, CARMAT_PHOTO_OPTIONS);
}

function informationLabels(values: CarMatInformationChoice[] | undefined): string[] {
  const active = values?.filter(value => value !== 'none') ?? [];
  return labelsFor(active, CARMAT_INFORMATION_OPTIONS);
}

export async function submitCarMatQuote(input: CarMatQuoteInput): Promise<CarMatQuoteResult> {
  // Same maintenance window as checkout (Stage 8B freeze pauses quote intake).
  if (isCheckoutMaintenance()) {
    return { ok: false, message: QUOTE_MAINTENANCE_MESSAGE };
  }

  const parsed = carMatQuoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'Перевірте, чи правильно заповнені всі обовʼязкові поля.' };
  }

  const phone = normalizePhone(parsed.data.customerPhone);
  if (!phone) {
    return { ok: false, message: 'Вкажіть коректний український номер телефону.' };
  }

  const interest = CARMAT_INTEREST_OPTIONS.find(option => option.value === parsed.data.interest);

  try {
    const delivered = await sendCarMatQuoteTelegram({
      customerName: parsed.data.customerName.trim(),
      customerPhone: phone,
      carModel: parsed.data.carModel.trim(),
      carYear: parsed.data.carYear,
      bodyType: parsed.data.bodyType.trim(),
      interest: interest?.label ?? parsed.data.interest,
      contactMethod: contactMethodLabel(parsed.data.contactMethod),
      comment: parsed.data.comment?.trim() || '',
      photoLabels: photoLabels(parsed.data.photoChoices),
      informationLabels: informationLabels(parsed.data.informationChoices),
      requestedAt: new Date(),
    });

    if (!delivered) {
      return {
        ok: false,
        message: 'Не вдалося надіслати заявку. Спробуйте ще раз або напишіть нам у месенджер.',
      };
    }

    return { ok: true };
  } catch (error) {
    console.error('Car mat quote request failed', error instanceof Error ? error.message : 'Unknown error');
    return {
      ok: false,
      message: 'Не вдалося надіслати заявку. Спробуйте ще раз або напишіть нам у месенджер.',
    };
  }
}
