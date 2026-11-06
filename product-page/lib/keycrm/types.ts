/** keyCRM order-create payload shapes (openapi.keycrm.app/v1, `createNewOrder`). */

export interface KeyCrmBuyer {
  full_name: string | null;
  phone: string | null;
  email?: string | null;
}

export interface KeyCrmShipping {
  shipping_service: string;
  delivery_service_id?: number | null;
  warehouse_ref?: string | null;
  shipping_address_city?: string | null;
  shipping_secondary_line?: string | null;
  shipping_receive_point?: string | null;
  recipient_full_name?: string | null;
  recipient_phone?: string | null;
}

export interface KeyCrmProductLine {
  sku: string;
  price: number;
  quantity: number;
  name?: string;
  comment?: string;
}

export interface KeyCrmCustomField {
  uuid: string;
  /** select fields take an array of option strings; number fields take a number. */
  value: string[] | number;
}

export interface KeyCrmOrderPayload {
  source_id: number;
  source_uuid: string;
  buyer: KeyCrmBuyer;
  buyer_comment?: string;
  manager_comment?: string;
  discount_amount?: number;
  shipping: KeyCrmShipping;
  products: KeyCrmProductLine[];
  custom_fields?: KeyCrmCustomField[];
}

/** One cart line with the price split needed to avoid double-charging add-ons. */
export interface KeyCrmSourceLine {
  sizeCode: string;
  designSlug: string;
  brandSlug: string;
  brandName: string;
  fixationKey: string;
  fixationLabel: string;
  quantity: number;
  /** All-in per-unit price already stored on the order (= base + logo + paid fixation). */
  unitPrice: number;
  basePrice: number;
  logoExtra: number;
  fixationExtra: number;
}

export interface KeyCrmOrderInput {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerComment?: string | null;
  /** Real manager note, if any. Never auto-generated discount text. */
  managerNote?: string | null;
  contactMethod: string;
  deliveryMethod: 'BRANCH' | 'POSTOMAT' | 'COURIER';
  deliveryCityName?: string | null;
  deliveryPointRef?: string | null;
  deliveryPointNumber?: string | null;
  deliveryPointName?: string | null;
  deliveryPointAddress?: string | null;
  deliveryStreetName?: string | null;
  deliveryStreetType?: string | null;
  deliveryHouse?: string | null;
  deliveryApartment?: string | null;
  subtotal: number;
  quantityDiscount: number;
  discountTierKey?: string | null;
  loyaltyDiscountAmount: number;
  total: number;
  lines: KeyCrmSourceLine[];
}

export interface KeyCrmOrderConfig {
  sourceId: number;
  deliveryServiceId: number;
  contactMethodFieldUuid?: string | null;
}
