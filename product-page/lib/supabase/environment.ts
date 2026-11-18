import { isVercelProduction } from '@/lib/production-integrations';

// Public project identifier, not a credential. Shared Preview access is opt-in.
const PRODUCTION_PROJECT_REF = 'kmhegysmtsjqtwwaacht';

/** Temporary prelaunch mode; never grants access to development/custom targets. */
export function isSharedSupabasePreview(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.VERCEL_ENV === 'preview' && env.SUPABASE_ALLOW_SHARED_PREVIEW === 'true';
}

/** One policy for every Supabase client, including SELECT-only content clients. */
export function assertSafeSupabaseTarget(
  rawUrl: string,
  env: Record<string, string | undefined> = process.env,
): void {
  if (isVercelProduction(env)) return;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Supabase target is disabled outside Vercel Production');
  }
  const plainOrigin = !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
  // Local CLI/Docker and synthetic test servers; never enable loopback on Vercel.
  const local = !env.VERCEL && !env.VERCEL_ENV &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    ['http:', 'https:'].includes(url.protocol);
  const previewRef = env.SUPABASE_PREVIEW_PROJECT_REF?.trim();
  const isolatedProject = previewRef && /^[a-z0-9]+$/.test(previewRef) &&
    previewRef !== PRODUCTION_PROJECT_REF && url.origin === `https://${previewRef}.supabase.co`;
  const sharedProject = isSharedSupabasePreview(env) && previewRef === PRODUCTION_PROJECT_REF &&
    url.origin === `https://${PRODUCTION_PROJECT_REF}.supabase.co`;
  if (!plainOrigin || (!local && !isolatedProject && !sharedProject)) {
    throw new Error('Supabase target is disabled outside Vercel Production');
  }
}
