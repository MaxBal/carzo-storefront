export type DataStoreBackend = 'directus' | 'supabase';

export class DataStoreConfigError extends Error {
  readonly code = 'CONFIG' as const;

  constructor(message: string) {
    super(message);
    this.name = 'DataStoreConfigError';
  }
}

function resolveStoreFlag(
  envName: string,
  env: NodeJS.ProcessEnv = process.env,
): DataStoreBackend {
  const raw = env[envName]?.trim().toLowerCase();
  if (!raw) return 'directus';
  if (raw === 'directus' || raw === 'supabase') return raw;
  throw new DataStoreConfigError(
    `Invalid ${envName} value; expected "directus" or "supabase"`,
  );
}

/** Catalog/commerce: designs, sizes, brands, variants, fixations, discounts, shipping, checkout payment details. */
export function resolveCatalogStoreBackend(
  env: NodeJS.ProcessEnv = process.env,
): DataStoreBackend {
  return resolveStoreFlag('CATALOG_STORE', env);
}

/** Editorial/product content: gallery, modals, homepage, about, reviews, product_media, site settings. */
export function resolveContentStoreBackend(
  env: NodeJS.ProcessEnv = process.env,
): DataStoreBackend {
  return resolveStoreFlag('CONTENT_STORE', env);
}

/** CMS pages: pages, page_blocks, summaries, preview, sitemap CMS data. */
export function resolvePageStoreBackend(
  env: NodeJS.ProcessEnv = process.env,
): DataStoreBackend {
  return resolveStoreFlag('PAGE_STORE', env);
}

/** Order persistence. Stage 4: Directus writer only; Supabase path fails closed until Stage 6. */
export function resolveOrderStoreBackend(
  env: NodeJS.ProcessEnv = process.env,
): DataStoreBackend {
  return resolveStoreFlag('ORDER_STORE', env);
}

export interface DataStoreFlags {
  catalog: DataStoreBackend;
  content: DataStoreBackend;
  pages: DataStoreBackend;
  orders: DataStoreBackend;
}

export function resolveDataStoreFlags(
  env: NodeJS.ProcessEnv = process.env,
): DataStoreFlags {
  return {
    catalog: resolveCatalogStoreBackend(env),
    content: resolveContentStoreBackend(env),
    pages: resolvePageStoreBackend(env),
    orders: resolveOrderStoreBackend(env),
  };
}

/**
 * Preview secret: new name preferred, legacy Directus name kept for rollback.
 * Never expose the value to the client.
 */
export function getPreviewSecret(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  return (
    env.PREVIEW_SECRET?.trim()
    || env.DIRECTUS_PREVIEW_SECRET?.trim()
    || null
  );
}

export const CACHE_TAGS = {
  catalog: 'catalog',
  content: 'content',
  pages: 'pages',
  settings: 'settings',
} as const;

export const CACHE_REVALIDATE_SECONDS = 60;
