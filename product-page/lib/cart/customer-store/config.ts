import { CustomerStoreError, type CustomerStoreBackend } from './types';

/**
 * Resolve the customer backend from env.
 *
 * - missing / empty → `directus` (documented production default; no silent switch)
 * - `directus` | `supabase` → that backend only
 * - anything else → config error (never guess)
 */
export function resolveCustomerStoreBackend(
  env: NodeJS.ProcessEnv = process.env,
): CustomerStoreBackend {
  const raw = env.CUSTOMER_STORE?.trim().toLowerCase();
  if (!raw) return 'directus';
  if (raw === 'directus' || raw === 'supabase') return raw;
  throw new CustomerStoreError(
    'Invalid CUSTOMER_STORE value; expected "directus" or "supabase"',
    'CONFIG',
  );
}
