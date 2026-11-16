import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export class SupabaseConfigError extends Error {
  readonly code = 'CONFIG' as const;

  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new SupabaseConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Server-only admin client (elevated secret key).
 * Never import from client components — the secret must not reach the browser bundle.
 *
 * Enforces `cache: 'no-store'` on all requests so orders, checkout attempt probes,
 * customer PII, loyalty checks, notification settings, and live checkout price quotes
 * are never stored in the Next.js Data Cache (NEW-02).
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const url = requireEnv('SUPABASE_URL');
  const secretKey = requireEnv('SUPABASE_SECRET_KEY');

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}

let cached: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (!cached) {
    cached = createSupabaseAdminClient();
  }
  return cached;
}

/** Test helper to reset the cached admin client singleton when mocking fetch/env. */
export function resetSupabaseAdminClientForTests(): void {
  cached = null;
}
