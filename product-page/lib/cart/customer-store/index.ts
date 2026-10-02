import 'server-only';

import { resolveCustomerStoreBackend } from './config';
import { createDirectusCustomerStore } from './directus';
import { createSupabaseCustomerStore } from './supabase';
import type { CustomerStore, CustomerStoreBackend } from './types';

export {
  CustomerStoreError,
  type CustomerRecord,
  type CustomerStore,
  type CustomerStoreBackend,
  type UpsertCustomerInput,
} from './types';
export { resolveCustomerStoreBackend } from './config';
export {
  buildExistingCustomerUpdate,
  buildNewCustomerRow,
  normalizeFullName,
} from './merge';

export function createCustomerStore(backend: CustomerStoreBackend): CustomerStore {
  switch (backend) {
    case 'directus':
      return createDirectusCustomerStore();
    case 'supabase':
      return createSupabaseCustomerStore();
    default: {
      const exhaustive: never = backend;
      throw new Error(`Unsupported customer store backend: ${String(exhaustive)}`);
    }
  }
}

let cached: CustomerStore | null = null;
let cachedBackend: CustomerStoreBackend | null = null;

/**
 * Central backend switch. One store per process; no cross-store write fallback.
 */
export function getCustomerStore(): CustomerStore {
  const backend = resolveCustomerStoreBackend();
  if (!cached || cachedBackend !== backend) {
    cached = createCustomerStore(backend);
    cachedBackend = backend;
  }
  return cached;
}

/** Test-only helper — resets the process-level store cache. */
export function resetCustomerStoreCache(): void {
  cached = null;
  cachedBackend = null;
}
