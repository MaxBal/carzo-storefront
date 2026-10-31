import type { ContactMethod } from '@/lib/cart/contact-method';

export const CARMAT_INTEREST_VALUES = ['salon', 'trunk', 'salon-and-trunk'] as const;

export type CarMatInterest = (typeof CARMAT_INTEREST_VALUES)[number];

export const CARMAT_INTEREST_OPTIONS: ReadonlyArray<{ value: CarMatInterest; label: string }> = [
  { value: 'salon', label: 'Килимки в салон' },
  { value: 'trunk', label: 'Килимок у багажник' },
  { value: 'salon-and-trunk', label: 'Килимки в салон + багажник' },
];

export interface CarMatQuoteInput {
  customerName: string;
  customerPhone: string;
  carModel: string;
  carYear: string;
  bodyType: string;
  interest: CarMatInterest;
  contactMethod: ContactMethod;
  comment?: string;
}

export type CarMatQuoteResult =
  | { ok: true }
  | { ok: false; message: string };
