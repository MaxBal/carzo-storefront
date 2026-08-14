import { z } from 'zod';
import { CONTACT_METHOD_VALUES } from './contact-method';

export const cartItemSchema = z.object({
  size: z.enum(['S', 'M', 'L', 'XL']),
  designSlug: z.string().trim().min(1).max(64),
  brandId: z.string().trim().min(1).max(64),
  fixation: z.string().trim().min(1).max(64),
  quantity: z.number().int().min(1).max(20),
});

export const cartItemsSchema = z.array(cartItemSchema).min(1).max(30);

export const checkoutSchema = z.object({
  items: cartItemsSchema,
  expectedTotal: z.number().int().nonnegative(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(10).max(24),
  customerComment: z.string().trim().max(1000).optional().or(z.literal('')),
  contactMethod: z.enum(CONTACT_METHOD_VALUES),
  deliveryCityRef: z.string().uuid(),
  deliveryPointRef: z.string().uuid(),
});
