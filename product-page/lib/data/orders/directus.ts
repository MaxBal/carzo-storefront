import type { OrderRepository, OrderWritePayload } from './types';
import { OrderStoreError } from './types';

/**
 * Directus order writer — preserves existing POST semantics from checkout.ts.
 * No payload or error-message changes.
 */
export function createDirectusOrderRepository(): OrderRepository {
  return {
    async createOrder(body: OrderWritePayload): Promise<void> {
      const url = process.env.DIRECTUS_URL?.replace(/\/$/, '');
      const token = process.env.DIRECTUS_READ_TOKEN?.trim();
      if (!url || !token) throw new OrderStoreError('Directus order writer is not configured', 'WRITE_FAILED');
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
    },
  };
}
