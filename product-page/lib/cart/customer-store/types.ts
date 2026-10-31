export type CustomerStoreBackend = 'directus' | 'supabase';

export type CustomerStoreErrorCode =
  | 'INVALID_PHONE'
  | 'CONFIG'
  | 'UNAVAILABLE'
  | 'WRITE_FAILED';

export class CustomerStoreError extends Error {
  readonly code: CustomerStoreErrorCode;

  constructor(message: string, code: CustomerStoreErrorCode) {
    super(message);
    this.name = 'CustomerStoreError';
    this.code = code;
  }
}

export interface CustomerRecord {
  phone: string;
  full_name?: string | null;
  source?: string | null;
  imported?: boolean;
  legacy_orders_count?: number | null;
  legacy_products_count?: number | null;
  legacy_city?: string | null;
  legacy_delivery?: string | null;
}

export interface UpsertCustomerInput {
  phone: string;
  fullName?: string | null;
  source?: string | null;
  imported?: boolean;
}

export interface CustomerStore {
  /** Returns null only when the customer is missing. Infrastructure failures throw. */
  findCustomerByPhone(rawPhone: string): Promise<CustomerRecord | null>;
  /** Idempotent registration. Returns null only when the phone is invalid. */
  upsertCustomerByPhone(input: UpsertCustomerInput): Promise<CustomerRecord | null>;
}
