import { resolveOrderStoreBackend } from '../config';
import { createDirectusOrderRepository } from './directus';
import { createSupabaseOrderRepository } from './supabase';
import type { OrderRepository, OrderWritePayload } from './types';

export type { OrderRepository, OrderWritePayload } from './types';
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
export async function createOrderRecord(body: OrderWritePayload): Promise<void> {
  return createOrderRepository(resolveOrderStoreBackend()).createOrder(body);
}
