'use server';

import { contactMethodLabel } from '@/lib/cart/contact-method';
import { CARMAT_INTEREST_OPTIONS } from '@/lib/carmat-quote/types';
import { carMatQuoteSchema } from '@/lib/carmat-quote/validation';
import { notifyNewCarMatQuote } from '@/lib/order-notifications';
import type { CarMatQuoteInput, CarMatQuoteResult } from '@/lib/carmat-quote/types';

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `+38${digits}`;
  if (digits.length === 12 && digits.startsWith('380')) return `+${digits}`;
  return null;
}

export async function submitCarMatQuote(input: CarMatQuoteInput): Promise<CarMatQuoteResult> {
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
    const delivered = await notifyNewCarMatQuote({
      customerName: parsed.data.customerName.trim(),
      customerPhone: phone,
      carModel: parsed.data.carModel.trim(),
      carYear: parsed.data.carYear,
      bodyType: parsed.data.bodyType.trim(),
      interest: interest?.label ?? parsed.data.interest,
      contactMethod: contactMethodLabel(parsed.data.contactMethod),
      comment: parsed.data.comment?.trim() || '',
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
