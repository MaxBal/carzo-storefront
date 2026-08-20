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

const deliveryPointSchema = (method: 'BRANCH' | 'POSTOMAT') => z.object({
  method: z.literal(method),
  cityRef: z.string().uuid(),
  pointRef: z.string().uuid(),
}).strict();

const courierDeliverySchema = z.object({
  method: z.literal('COURIER'),
  cityRef: z.string().uuid(),
  streetRef: z.string().uuid(),
  streetName: z.string().trim().min(1).max(255),
  house: z.string().trim().min(1).max(64),
  apartment: z.string().trim().max(64).optional().or(z.literal('')),
}).strict();

export const checkoutSchema = z.object({
  items: cartItemsSchema,
  expectedTotal: z.number().int().nonnegative(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(10).max(24),
  customerComment: z.string().trim().max(1000).optional().or(z.literal('')),
  contactMethod: z.enum(CONTACT_METHOD_VALUES),
  delivery: z.discriminatedUnion('method', [
    deliveryPointSchema('BRANCH'),
    deliveryPointSchema('POSTOMAT'),
    courierDeliverySchema,
  ]),
});
