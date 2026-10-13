export type OrderStoreBackend = 'directus' | 'supabase';

export class OrderStoreError extends Error {
  readonly code: 'CONFIG' | 'WRITE_FAILED' | 'NOT_READY';

  constructor(message: string, code: 'CONFIG' | 'WRITE_FAILED' | 'NOT_READY') {
    super(message);
    this.name = 'OrderStoreError';
    this.code = code;
  }
}

/** Payload accepted by the order repository (Directus field contract unchanged). */
export type OrderWritePayload = Record<string, unknown>;

export interface OrderRepository {
  /**
   * Persist one order document. Stage 4: Directus only.
   * Supabase path fails closed until Stage 6 atomic RPC.
   */
  createOrder(body: OrderWritePayload): Promise<void>;
}
