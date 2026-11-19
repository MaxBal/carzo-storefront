import { z } from 'zod';
import { CONTACT_METHOD_VALUES } from './contact-method';
import { PAYMENT_OPTION_VALUES } from './payment-option';
import { MAX_CART_ITEM_QUANTITY, MAX_CART_QUANTITY } from './quantity';

export const caseCartItemSchema = z.object({
  size: z.enum(['S', 'M', 'L', 'XL']),
  designSlug: z.string().trim().min(1).max(64),
  brandId: z.string().trim().min(1).max(64),
  fixation: z.string().trim().min(1).max(64),
  quantity: z.number().int().min(1).max(MAX_CART_ITEM_QUANTITY),
}).strict();

const optionValue = z.string().trim().min(1).max(120).refine(value => !/[\u0000-\u001f\u007f]/.test(value));
const selectionRecord = z.record(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/), optionValue)
  .refine(value => Object.keys(value).length <= 16);
export const catalogCartItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  options: selectionRecord.default({}),
  personalization: selectionRecord.default({}),
  quantity: z.number().int().min(1).max(MAX_CART_ITEM_QUANTITY),
}).strict();

export const cartItemSchema = z.union([caseCartItemSchema, catalogCartItemSchema]);

export const cartItemsSchema = z.array(cartItemSchema).min(1).max(MAX_CART_QUANTITY);

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
  expectedBaseTotal: z.number().int().nonnegative().optional(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(10).max(24),
  loyaltyPhone: z.string().trim().min(9).max(24).optional().or(z.literal('')),
  customerComment: z.string().trim().max(1000).optional().or(z.literal('')),
  contactMethod: z.enum(CONTACT_METHOD_VALUES),
  paymentOption: z.enum(PAYMENT_OPTION_VALUES).optional(),
  delivery: z.discriminatedUnion('method', [
    deliveryPointSchema('BRANCH'),
    deliveryPointSchema('POSTOMAT'),
    courierDeliverySchema,
  ]),
  checkoutAttemptId: z.string().uuid().optional(),
});
