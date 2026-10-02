import type { UpsertCustomerInput } from './types';

/** Trimmed non-empty name, or null (null must never wipe an existing name). */
export function normalizeFullName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Insert payload for a brand-new storefront customer.
 * Provenance defaults to site registration; imported stays false.
 */
export function buildNewCustomerRow(phone: string, input: UpsertCustomerInput) {
  const source = typeof input.source === 'string' && input.source.trim()
    ? input.source.trim()
    : 'site';
  return {
    phone,
    full_name: normalizeFullName(input.fullName),
    source,
    imported: input.imported ?? false,
  };
}

/**
 * Merge update for an existing customer (PHASE 3 policy).
 * Only a non-empty full_name and updated_at are touched.
 * Returns null when there is no meaningful update.
 *
 * Never included (must not be destroyed by site upsert):
 * phone, source, imported, legacy_*, created_at.
 */
export function buildExistingCustomerUpdate(
  input: UpsertCustomerInput,
  nowIso: string,
): { full_name: string; updated_at: string } | null {
  const fullName = normalizeFullName(input.fullName);
  if (!fullName) return null;
  return { full_name: fullName, updated_at: nowIso };
}
