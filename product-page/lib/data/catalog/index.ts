import 'server-only';

import { resolveCatalogStoreBackend } from '../config';
import { createDirectusCatalogRepository } from './directus';
import { createSupabaseCatalogRepository } from './supabase';
import type { CatalogData, CatalogRepository } from './types';

export type {
  CatalogData,
  CatalogRepository,
  QuoteCatalogInput,
} from './types';
export { CatalogUnavailableError } from './supabase';

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
 */
export async function loadCatalogData(): Promise<CatalogData> {
  return createCatalogRepository(resolveCatalogStoreBackend()).loadCatalog();
}
