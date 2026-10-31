import type { OrderRepository, OrderWritePayload } from './types';
import { OrderStoreError } from './types';

/**
 * Stage 4 placeholder — fail closed. Atomic Supabase order writes
 * (create_order_with_items RPC) belong exclusively to Stage 6.
 *
 * Never insert into orders/order_items directly from this adapter.
 */
export function createSupabaseOrderRepository(): OrderRepository {
  return {
    async createOrder(_body: OrderWritePayload): Promise<void> {
      throw new OrderStoreError(
        'Supabase order writer is not ready until Stage 6 (atomic RPC). Fail-closed.',
        'NOT_READY',
      );
    },
  };
}
