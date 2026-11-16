import 'server-only';

import { resolveCatalogStoreBackend } from '../config';
import { createDirectusCatalogRepository } from './directus';
import { createSupabaseCatalogRepository } from './supabase';
import type {
  CatalogCacheMode,
  CatalogData,
  CatalogRepository,
  LoadCatalogOptions,
} from './types';

export type {
  CatalogCacheMode,
  CatalogData,
  CatalogRepository,
  LoadCatalogOptions,
  QuoteCatalogInput,
} from './types';
export { CatalogUnavailableError, __CATALOG_CACHE } from './supabase';

export function createCatalogRepository(
  backend: ReturnType<typeof resolveCatalogStoreBackend>,
): CatalogRepository {
  switch (backend) {
    case 'directus':
      return createDirectusCatalogRepository();
    case 'supabase':
      return createSupabaseCatalogRepository();
    default: {
      const exhaustive: never = backend;
      throw new Error(`Unsupported catalog store backend: ${String(exhaustive)}`);
    }
  }
}

/**
 * Stable facade for commerce reads. One repository per backend selection;
 * no silent cross-backend fallback.
 *
 * Defaults to `{ cache: 'no-store' }` so checkout and cart quoting always
 * verify live prices and stock. Public pages pass `{ cache: 'revalidate' }`.
 */
export async function loadCatalogData(options?: LoadCatalogOptions): Promise<CatalogData> {
  return createCatalogRepository(resolveCatalogStoreBackend()).loadCatalog(options);
}
