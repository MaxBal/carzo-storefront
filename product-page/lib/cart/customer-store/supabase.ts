import type { SupabaseClient } from '@supabase/supabase-js';

import { maskPhone, normalizeCustomerPhone } from '../customer-phone';
import {
  buildExistingCustomerUpdate,
  buildNewCustomerRow,
  normalizeFullName,
} from './merge';
import {
  CustomerStoreError,
  type CustomerStore,
  type UpsertCustomerInput,
} from './types';

function isUniqueViolation(message: string | undefined): boolean {
  return Boolean(message && (message.includes('23505') || message.includes('duplicate key')));
}

export type SupabaseClientFactory = () => SupabaseClient;

/**
 * Supabase adapter over public.customers.
 *
 * Lookup: existence by canonical phone (minimal projection for eligibility).
 * Registration: race-safe insert-or-merge. UNIQUE(phone) is authoritative.
 * Merge policy (PHASE 3): never destroy source / imported / legacy_* / created_at.
 * No silent write fallback to Directus.
 *
 * Production passes `getSupabaseAdminClient` via `createCustomerStore`.
 * Tests inject a mock client factory — never live writes.
 */
export function createSupabaseCustomerStore(
  getClient: SupabaseClientFactory,
): CustomerStore {
  return {
    async findCustomerByPhone(rawPhone) {
      const phone = normalizeCustomerPhone(rawPhone);
      if (!phone) return null;

      const client = getClient();
      // Minimal projection: eligibility only needs existence.
      const { data, error } = await client
        .from('customers')
        .select('phone')
        .eq('phone', phone)
        .maybeSingle();

      if (error) {
        console.error('Supabase customer lookup failed', maskPhone(phone), error.message);
        throw new CustomerStoreError('Customer lookup failed', 'UNAVAILABLE');
      }
      if (!data) return null;
      return { phone: (data as { phone: string }).phone };
    },

    async upsertCustomerByPhone(input: UpsertCustomerInput) {
      const phone = normalizeCustomerPhone(input.phone);
      if (!phone) return null;

      const client = getClient();
      const insertRow = buildNewCustomerRow(phone, input);

      // Race-safe: INSERT ON CONFLICT (phone) DO NOTHING.
      // A conflict means the customer already existed — never overwrite provenance.
      const { data: inserted, error: insertError } = await client
        .from('customers')
        .upsert(insertRow, { onConflict: 'phone', ignoreDuplicates: true })
        .select('phone');

      if (insertError) {
        if (!isUniqueViolation(insertError.message)) {
          console.error('Supabase customer insert failed', maskPhone(phone), insertError.message);
          throw new CustomerStoreError('Customer registration failed', 'WRITE_FAILED');
        }
      } else if (inserted && inserted.length > 0) {
        return {
          phone,
          full_name: normalizeFullName(input.fullName),
          source: insertRow.source,
          imported: insertRow.imported,
        };
      }

      // Existing customer: merge only meaningful fields.
      const update = buildExistingCustomerUpdate(input, new Date().toISOString());
      if (!update) {
        return { phone };
      }

      const { error: updateError } = await client
        .from('customers')
        .update(update)
        .eq('phone', phone);

      if (updateError) {
        console.error('Supabase customer update failed', maskPhone(phone), updateError.message);
        throw new CustomerStoreError('Customer registration failed', 'WRITE_FAILED');
      }

      return {
        phone,
        full_name: update.full_name,
      };
    },
  };
}
