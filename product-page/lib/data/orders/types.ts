import type { ContactMethod } from '@/lib/cart/contact-method';

export type OrderStoreBackend = 'directus' | 'supabase';

export class OrderStoreError extends Error {
  readonly code: 'CONFIG' | 'WRITE_FAILED' | 'NOT_READY' | 'REPLAY_MISMATCH';

  constructor(
    message: string,
    code: 'CONFIG' | 'WRITE_FAILED' | 'NOT_READY' | 'REPLAY_MISMATCH',
  ) {
    super(message);
    this.name = 'OrderStoreError';
    this.code = code;
  }
}

export type OrderDeliveryMethod = 'BRANCH' | 'POSTOMAT' | 'COURIER';

/** One line of the authoritative order snapshot (server-priced). */
export interface OrderItemSnapshot {
  sort: number;
  itemKey: string;
  title: string;
  designSlug: string;
  designLabel: string;
  sizeCode: string;
  sizeLabel: string;
  brandSlug: string;
  brandName: string;
  fixationKey: string;
  fixationLabel: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  quantityDiscountEligible: boolean;
}

export interface OrderLoyaltySnapshot {
  loyaltyPhone: string | null;
  eligible: boolean;
  discountPercent: number;
  discountAmount: number;
  phoneMismatch: boolean;
}

/**
 * Server-assembled authoritative order snapshot. Persistence concerns
 * (ids, order number, created_at) are owned by the repository/DB.
 */
export interface OrderSnapshot {
  /** UUID for the logical checkout attempt. Required on the Supabase path. */
  checkoutAttemptId: string | null;
  /** Canonical hash of material checkout intent (prices excluded). */
  requestFingerprint: string | null;
  customerName: string;
  customerPhone: string;
  customerComment: string | null;
  contactMethod: ContactMethod;
  deliveryMethod: OrderDeliveryMethod;
  deliveryCityRef: string | null;
  deliveryCityName: string | null;
  deliveryPointRef: string | null;
  deliveryPointNumber: string | null;
  deliveryPointName: string | null;
  deliveryPointAddress: string | null;
  deliveryPointType: string | null;
  deliveryStreetRef: string | null;
  deliveryStreetName: string | null;
  deliveryStreetType: string | null;
  deliveryHouse: string | null;
  deliveryApartment: string | null;
  itemsQuantity: number;
  subtotal: number;
  quantityDiscount: number;
  loyalty: OrderLoyaltySnapshot;
  total: number;
  discountTierKey: string | null;
  /** Human freeform note only. Never loyalty JSON on the Supabase path. */
  managerNote: string | null;
  items: OrderItemSnapshot[];
}

/** Persisted result of an order write (create or idempotent replay). */
export interface CreateOrderResult {
  id: string;
  orderNumber: string;
  total: number;
  /** false = idempotent replay of an existing order (no new rows). */
  created: boolean;
}

/** Read-only replay probe used before the pricing gate. */
export interface ExistingOrderRef {
  id: string;
  orderNumber: string;
  total: number;
  requestFingerprint: string | null;
}

export interface OrderRepository {
  /**
   * Persist one order + its items. Supabase: atomic RPC only.
   * Directus: legacy single POST (rollback / production path).
   */
  createOrder(body: OrderSnapshot): Promise<CreateOrderResult>;
  /** Supabase only; returns null on the Directus path. */
  findOrderByAttemptId(attemptId: string): Promise<ExistingOrderRef | null>;
}
