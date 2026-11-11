import { z } from 'zod';
import { CONTACT_METHOD_VALUES } from '@/lib/cart/contact-method';
import {
  CARMAT_INFORMATION_VALUES,
  CARMAT_INTEREST_VALUES,
  CARMAT_PHOTO_VALUES,
} from './types';

const currentYear = new Date().getUTCFullYear();

export const carMatQuoteSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  // PhoneInput stores subscriber digits only (max 9), e.g. "931234567";
  // full "+380..." / "0..." forms are also accepted and normalized later.
  customerPhone: z.string().trim().min(9).max(24),
  carModel: z.string().trim().min(1).max(120),
  carYear: z.string()
    .trim()
    .regex(/^\d{4}$/)
    .refine(value => {
      const year = Number(value);
      return year >= 1950 && year <= currentYear + 1;
    }),
  bodyType: z.string().trim().min(1).max(120),
  interest: z.enum(CARMAT_INTEREST_VALUES),
  contactMethod: z.enum(CONTACT_METHOD_VALUES),
  comment: z.string().trim().max(1000).optional().or(z.literal('')),
  photoChoices: z.array(z.enum(CARMAT_PHOTO_VALUES)).max(CARMAT_PHOTO_VALUES.length).optional(),
  informationChoices: z.array(z.enum(CARMAT_INFORMATION_VALUES)).max(CARMAT_INFORMATION_VALUES.length).optional(),
}).strict();
