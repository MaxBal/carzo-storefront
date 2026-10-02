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
  });
}

let cached: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (!cached) {
    cached = createSupabaseAdminClient();
  }
  return cached;
}
