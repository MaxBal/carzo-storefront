import 'server-only';

import { getCustomerStore } from './customer-store';
import type { CustomerRecord, UpsertCustomerInput } from './customer-store/types';

export { maskPhone, normalizeCustomerPhone } from './customer-phone';
export type { CustomerRecord, UpsertCustomerInput } from './customer-store/types';

/**
 * Loyalty/customer existence lookup via the configured customer store.
 * Returns null only when the customer is missing — infrastructure failures throw.
 */
export async function findCustomerByPhone(rawPhone: string): Promise<CustomerRecord | null> {
  return getCustomerStore().findCustomerByPhone(rawPhone);
}

/**
 * Idempotent customer registration after successful checkout.
 * Safe for concurrent callers; merge policy preserves imported provenance.
 */
export async function upsertCustomerByPhone(
  input: UpsertCustomerInput,
): Promise<CustomerRecord | null> {
  return getCustomerStore().upsertCustomerByPhone(input);
}

export async function isCustomerEligible(rawPhone: string): Promise<boolean> {
  return Boolean(await findCustomerByPhone(rawPhone));
}
