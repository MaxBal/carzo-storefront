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

export const DELIVERY_METHOD_VALUES = ['BRANCH', 'POSTOMAT', 'COURIER'] as const;

export type DeliveryMethod = typeof DELIVERY_METHOD_VALUES[number];

export interface NovaPoshtaPoint {
  ref: string;
  number: string;
  name: string;
  address: string;
  type: 'branch' | 'postomat';
}

export interface NovaPoshtaStreet {
  ref: string;
  name: string;
  type: string;
}

export type CheckoutDelivery =
  | {
    method: 'BRANCH';
    cityRef: string;
    pointRef: string;
  }
  | {
    method: 'POSTOMAT';
    cityRef: string;
    pointRef: string;
  }
  | {
    method: 'COURIER';
    cityRef: string;
    streetRef: string;
    streetName: string;
    house: string;
    apartment?: string;
  };

export interface CheckoutInput {
  items: CartInputItem[];
  /** Final total shown to the user (includes loyalty discount when applied). */
  expectedTotal: number;
  /** Quote total before loyalty (cart.quote.total). Used to classify PRICE vs LOYALTY changes. */
  expectedBaseTotal?: number;
  customerName: string;
  customerPhone: string;
  /** Canonical/raw phone the user used for loyalty lookup, if any. Server re-validates. */
  loyaltyPhone?: string;
  customerComment?: string;
  contactMethod: ContactMethod;
  delivery: CheckoutDelivery;
}

export interface CheckoutLoyaltyState {
  applied: boolean;
  eligible: boolean;
  discountPercent: number;
  discountAmount: number;
  phoneMismatch: boolean;
}

export type CheckoutChangedResult = {
  ok: false;
  code: 'PRICE_CHANGED' | 'LOYALTY_CHANGED';
  message: string;
  quote: CartQuote;
  loyalty: CheckoutLoyaltyState;
  /** Authoritative server total after the change (what the UI must show next). */
  total: number;
};

export type CheckoutResult =
  | { ok: true; orderNumber: string; total: number }
  | CheckoutChangedResult
  | {
    ok: false;
    code: 'INVALID' | 'UNAVAILABLE' | 'FAILED' | 'LOYALTY_UNAVAILABLE';
    message: string;
  };
