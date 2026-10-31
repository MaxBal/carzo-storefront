import { resolveOrderStoreBackend } from '../config';
import { createDirectusOrderRepository } from './directus';
import { createSupabaseOrderRepository } from './supabase';
import type {
  CreateOrderResult,
  ExistingOrderRef,
  OrderRepository,
  OrderSnapshot,
} from './types';

export type {
  CreateOrderResult,
  ExistingOrderRef,
  OrderItemSnapshot,
  OrderLoyaltySnapshot,
  OrderRepository,
  OrderSnapshot,
  OrderStoreBackend,
} from './types';
export { OrderStoreError } from './types';

export function createOrderRepository(
  backend: ReturnType<typeof resolveOrderStoreBackend>,
): OrderRepository {
  switch (backend) {
    case 'directus':
      return createDirectusOrderRepository();
    case 'supabase':
      return createSupabaseOrderRepository();
    default: {
      const exhaustive: never = backend;
      throw new Error(`Unsupported order store backend: ${String(exhaustive)}`);
    }
  }
}

/** Stable order persistence facade for checkout. */
export async function createOrderRecord(
  body: OrderSnapshot,
): Promise<CreateOrderResult> {
  return createOrderRepository(resolveOrderStoreBackend()).createOrder(body);
}

/**
 * Pre-pricing replay probe. Returns null when the backend has no order for
 * this attempt id (or the backend has no attempt-id support).
 */
export async function findOrderByAttemptId(
  attemptId: string,
): Promise<ExistingOrderRef | null> {
  return createOrderRepository(resolveOrderStoreBackend()).findOrderByAttemptId(attemptId);
}
