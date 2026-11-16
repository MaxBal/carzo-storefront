import 'server-only';

import { cache } from 'react';
import { resolvePageStoreBackend } from '../config';
import { createDirectusPageRepository } from './directus';
import { createSupabasePageRepository } from './supabase';
import type { PageRepository } from './types';

export type { PageRepository } from './types';

let directusRepoSingleton: PageRepository | null = null;

export function createPageRepository(
  backend: ReturnType<typeof resolvePageStoreBackend>,
): PageRepository {
  switch (backend) {
    case 'directus':
      if (!directusRepoSingleton) {
        directusRepoSingleton = createDirectusPageRepository();
      }
      return directusRepoSingleton;
    case 'supabase':
      return createSupabasePageRepository();
    default: {
      const exhaustive: never = backend;
      throw new Error(`Unsupported page store backend: ${String(exhaustive)}`);
    }
  }
}

function repo(): PageRepository {
  return createPageRepository(resolvePageStoreBackend());
}

/** Stable CMS facades — deduplicated per-request via React.cache (NEW-07). */
export const getPublishedPage = cache(async (slug: string) => {
  return repo().getPublishedPage(slug);
});

export const getPublishedPageSummaries = cache(async () => {
  return repo().getPublishedPageSummaries();
});

export async function getPreviewPage(id: string) {
  return repo().getPreviewPage(id);
}
