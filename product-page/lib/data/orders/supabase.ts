import { getSupabaseAdminClient } from '@/lib/supabase/server';
import type {
  CreateOrderResult,
  ExistingOrderRef,
  OrderRepository,
  OrderSnapshot,
} from './types';
import { OrderStoreError } from './types';

/**
 * Stage 6 Supabase order writer — atomic RPC only.
 * Never insert into orders/order_items directly from this adapter.
 */

interface RpcResult {
  id: string;
  order_number: string;
  total: number;
  created: boolean;
}

function rpcParams(snapshot: OrderSnapshot) {
  return {
    p_checkout_attempt_id: snapshot.checkoutAttemptId,
    p_request_fingerprint: snapshot.requestFingerprint,
    p_customer_name: snapshot.customerName,
    p_customer_phone: snapshot.customerPhone,
    p_customer_comment: snapshot.customerComment,
    p_contact_method: snapshot.contactMethod,
    p_payment_option: snapshot.paymentOption,
    p_delivery_method: snapshot.deliveryMethod,
    p_delivery_city_ref: snapshot.deliveryCityRef,
    p_delivery_city_name: snapshot.deliveryCityName,
    p_delivery_point_ref: snapshot.deliveryPointRef,
    p_delivery_point_number: snapshot.deliveryPointNumber,
    p_delivery_point_name: snapshot.deliveryPointName,
    p_delivery_point_address: snapshot.deliveryPointAddress,
    p_delivery_point_type: snapshot.deliveryPointType,
    p_delivery_street_ref: snapshot.deliveryStreetRef,
    p_delivery_street_name: snapshot.deliveryStreetName,
    p_delivery_street_type: snapshot.deliveryStreetType,
    p_delivery_house: snapshot.deliveryHouse,
    p_delivery_apartment: snapshot.deliveryApartment,
    p_items_quantity: snapshot.itemsQuantity,
    p_subtotal: snapshot.subtotal,
    p_quantity_discount: snapshot.quantityDiscount,
    p_loyalty_phone: snapshot.loyalty.loyaltyPhone,
    p_loyalty_eligible: snapshot.loyalty.eligible,
    p_loyalty_discount_percent: snapshot.loyalty.discountPercent,
    p_loyalty_discount_amount: snapshot.loyalty.discountAmount,
    p_loyalty_phone_mismatch: snapshot.loyalty.phoneMismatch,
    p_total: snapshot.total,
    p_discount_tier_key: snapshot.discountTierKey,
    p_manager_note: snapshot.managerNote,
    p_items: snapshot.items.map(item => ({
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

function parseRpcResult(data: unknown): CreateOrderResult {
  const row = data as RpcResult | null;
  if (!row || typeof row.id !== 'string' || typeof row.order_number !== 'string') {
    throw new OrderStoreError('Supabase order RPC returned an unexpected payload', 'WRITE_FAILED');
  }
  return {
    id: row.id,
    orderNumber: row.order_number,
    total: typeof row.total === 'number' ? row.total : 0,
    created: row.created !== false,
  };
}

export function createSupabaseOrderRepository(): OrderRepository {
  return {
    async createOrder(snapshot: OrderSnapshot): Promise<CreateOrderResult> {
      if (!snapshot.checkoutAttemptId) {
        throw new OrderStoreError(
          'Supabase order write requires a checkout attempt id',
          'WRITE_FAILED',
        );
      }
      const { data, error } = await getSupabaseAdminClient()
        .rpc('create_order_with_items', rpcParams(snapshot));
      if (error) {
        if (error.message?.includes('ATTEMPT_FINGERPRINT_MISMATCH')) {
          throw new OrderStoreError(
            'Checkout attempt was already used for a different order',
            'REPLAY_MISMATCH',
          );
        }
        // Message only — RPC errors never echo customer fields (PII).
        throw new OrderStoreError(
          `Supabase order create failed: ${error.message}`,
          'WRITE_FAILED',
        );
      }
      return parseRpcResult(data);
    },

    async findOrderByAttemptId(attemptId: string): Promise<ExistingOrderRef | null> {
      const { data, error } = await getSupabaseAdminClient()
        .from('orders')
        .select('id, order_number, total, request_fingerprint')
        .eq('checkout_attempt_id', attemptId)
        .maybeSingle();
      if (error) {
        throw new OrderStoreError(
          `Supabase order lookup failed: ${error.message}`,
          'WRITE_FAILED',
        );
      }
      if (!data) return null;
      return {
        id: data.id,
        orderNumber: data.order_number,
        total: data.total,
        requestFingerprint: data.request_fingerprint ?? null,
      };
    },
  };
}
