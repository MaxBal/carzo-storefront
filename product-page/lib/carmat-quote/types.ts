import type { ContactMethod } from '@/lib/cart/contact-method';

export const CARMAT_INTEREST_VALUES = ['salon', 'trunk', 'salon-and-trunk'] as const;

export type CarMatInterest = (typeof CARMAT_INTEREST_VALUES)[number];

export const CARMAT_INTEREST_OPTIONS: ReadonlyArray<{ value: CarMatInterest; label: string }> = [
  { value: 'salon', label: 'Килимки в салон' },
  { value: 'trunk', label: 'Килимок у багажник' },
  { value: 'salon-and-trunk', label: 'Килимки в салон + багажник' },
];

export const CARMAT_PHOTO_VALUES = ['none', 'all', 'carzo-2', 'carzo-3', 'carzo-4'] as const;

export type CarMatPhotoChoice = (typeof CARMAT_PHOTO_VALUES)[number];

export const CARMAT_PHOTO_OPTIONS: ReadonlyArray<{ value: CarMatPhotoChoice; label: string }> = [
  { value: 'none', label: 'Не отримувати' },
  { value: 'all', label: 'Усі дизайни' },
  { value: 'carzo-2', label: 'Carzo 2.0 (подовжений ромб)' },
  { value: 'carzo-3', label: 'Carzo 3.0 (Сота)' },
  { value: 'carzo-4', label: 'Carzo 4.0 (Urus)' },
];

export const CARMAT_INFORMATION_VALUES = ['none', 'care', 'materials'] as const;

export type CarMatInformationChoice = (typeof CARMAT_INFORMATION_VALUES)[number];

export const CARMAT_INFORMATION_OPTIONS: ReadonlyArray<{ value: CarMatInformationChoice; label: string }> = [
  { value: 'none', label: 'Не отримувати' },
  { value: 'care', label: 'Як доглядати за килимками' },
  { value: 'materials', label: 'Детально про матеріали' },
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
  photoChoices?: CarMatPhotoChoice[];
  informationChoices?: CarMatInformationChoice[];
}

export type CarMatQuoteResult =
  | { ok: true }
  | { ok: false; message: string };
