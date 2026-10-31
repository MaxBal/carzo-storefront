import { randomUUID } from 'node:crypto';
import { buildLoyaltyAuditNote } from '@/lib/cart/order-audit';
import type {
  CreateOrderResult,
  ExistingOrderRef,
  OrderRepository,
  OrderSnapshot,
} from './types';
import { OrderStoreError } from './types';

/**
 * Directus order writer — preserves the legacy POST semantics of checkout.ts
 * (rollback / production path). Loyalty audit stays JSON-in-manager_note here;
 * the Supabase path writes structured loyalty_* columns instead.
 */

function orderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `CZ-${date}-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
}

function toDirectusBody(snapshot: OrderSnapshot) {
  return {
    id: randomUUID(),
    status: 'new',
    order_number: orderNumber(),
    created_at: new Date().toISOString(),
    customer_name: snapshot.customerName,
    customer_phone: snapshot.customerPhone,
    customer_comment: snapshot.customerComment,
    manager_note: buildLoyaltyAuditNote({
      loyaltyPhone: snapshot.loyalty.loyaltyPhone,
      eligible: snapshot.loyalty.eligible,
      discountPercent: snapshot.loyalty.discountPercent,
      discountAmount: snapshot.loyalty.discountAmount,
      phoneMismatch: snapshot.loyalty.phoneMismatch,
    }),
    contact_method: snapshot.contactMethod,
    delivery_method: snapshot.deliveryMethod,
    delivery_city_ref: snapshot.deliveryCityRef,
    delivery_city_name: snapshot.deliveryCityName,
    delivery_point_ref: snapshot.deliveryPointRef,
    delivery_point_number: snapshot.deliveryPointNumber,
    delivery_point_name: snapshot.deliveryPointName,
    delivery_point_address: snapshot.deliveryPointAddress,
    delivery_point_type: snapshot.deliveryPointType,
    delivery_street_ref: snapshot.deliveryStreetRef,
    delivery_street_name: snapshot.deliveryStreetName,
    delivery_street_type: snapshot.deliveryStreetType,
    delivery_house: snapshot.deliveryHouse,
    delivery_apartment: snapshot.deliveryApartment,
    items_quantity: snapshot.itemsQuantity,
    subtotal: snapshot.subtotal,
    quantity_discount: snapshot.quantityDiscount,
    total: snapshot.total,
    discount_tier_key: snapshot.discountTierKey,
    items: snapshot.items.map(item => ({
      id: randomUUID(),
      sort: item.sort,
      item_key: item.itemKey,
      title: item.title,
      design_slug: item.designSlug,
      design_label: item.designLabel,
      size_code: item.sizeCode,
      size_label: item.sizeLabel,
      brand_slug: item.brandSlug,
      brand_name: item.brandName,
      fixation_key: item.fixationKey,
      fixation_label: item.fixationLabel,
      unit_price: item.unitPrice,
      quantity: item.quantity,
      line_total: item.lineTotal,
      quantity_discount_eligible: item.quantityDiscountEligible,
    })),
  };
}

export function createDirectusOrderRepository(): OrderRepository {
  return {
    async createOrder(snapshot: OrderSnapshot): Promise<CreateOrderResult> {
      const url = process.env.DIRECTUS_URL?.replace(/\/$/, '');
      const token = process.env.DIRECTUS_READ_TOKEN?.trim();
      if (!url || !token) {
        throw new OrderStoreError('Directus order writer is not configured', 'WRITE_FAILED');
      }
      const body = toDirectusBody(snapshot);
      const response = await fetch(`${url}/items/carzo_orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      });
      if (!response.ok) {
        // Status only — response body may echo customer fields (PII).
        throw new OrderStoreError(`Directus order create failed: HTTP ${response.status}`, 'WRITE_FAILED');
      }
      return {
        id: body.id,
        orderNumber: body.order_number,
        total: body.total,
        created: true,
      };
    },

    async findOrderByAttemptId(_attemptId: string): Promise<ExistingOrderRef | null> {
      // Directus path has no attempt-id idempotency (Stage 6 scope is Supabase).
      return null;
    },
  };
}
