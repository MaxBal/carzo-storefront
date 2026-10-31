import 'server-only';

import { resolvePageStoreBackend } from '../config';
import { createDirectusPageRepository } from './directus';
import { createSupabasePageRepository } from './supabase';
import type { PageRepository } from './types';

export type { PageRepository } from './types';

export function createPageRepository(
  backend: ReturnType<typeof resolvePageStoreBackend>,
): PageRepository {
  switch (backend) {
    case 'directus':
      return createDirectusPageRepository();
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

/** Stable CMS facades — UI/server callers never touch backend modules. */
export async function getPublishedPage(slug: string) {
  return repo().getPublishedPage(slug);
}

export async function getPublishedPageSummaries() {
  return repo().getPublishedPageSummaries();
}

export async function getPreviewPage(id: string) {
  return repo().getPreviewPage(id);
}
