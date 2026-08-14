import type { ProductParams } from '@/lib/content/types';
import type { ContactMethod } from './contact-method';

export interface CartInputItem extends ProductParams {
  fixation: string;
  quantity: number;
}

export interface CartQuoteLine {
  itemKey: string;
  item: CartInputItem;
  title: string;
  productUrl: string;
  designLabel: string;
  sizeLabel: string;
  brandName: string;
  fixationLabel: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  inStock: boolean;
  quantityDiscountEligible: boolean;
}

export interface CartQuote {
  lines: CartQuoteLine[];
  subtotal: number;
  quantityDiscount: number;
  total: number;
  itemsQuantity: number;
  appliedTier: { key: string; minQuantity: number; amount: number } | null;
  allowPostomat: boolean;
  canCheckout: boolean;
  checkoutPaymentDetails: string;
  verifiedAt: string;
}

export interface NovaPoshtaCity {
  ref: string;
  name: string;
  area: string;
  type: string;
}

export interface NovaPoshtaPoint {
  ref: string;
  name: string;
  address: string;
  type: 'branch' | 'postomat';
}

export interface CheckoutInput {
  items: CartInputItem[];
  expectedTotal: number;
  customerName: string;
  customerPhone: string;
  customerComment?: string;
  contactMethod: ContactMethod;
  deliveryCityRef: string;
  deliveryPointRef: string;
}

export type CheckoutResult =
  | { ok: true; orderNumber: string; total: number }
  | { ok: false; code: 'PRICE_CHANGED'; message: string; quote: CartQuote }
  | { ok: false; code: 'INVALID' | 'UNAVAILABLE' | 'FAILED'; message: string };
