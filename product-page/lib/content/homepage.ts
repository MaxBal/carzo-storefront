import 'server-only';
import { cache } from 'react';
import { loadHomepageData } from '@/lib/data/content';
import type { HomepageData } from './settings-defaults';

export type {
  HomepageData,
  HomepageFeature,
  HomepageProduct,
  HomepageStat,
} from './settings-defaults';
export { DEFAULT_HOMEPAGE } from './settings-defaults';

/**
 * Backend-neutral homepage editorial loader. Honours CONTENT_STORE: with
 * `supabase` this never reads Directus (Stage 7.x D-2).
 */
export const getHomepageData = cache(async (): Promise<HomepageData> => {
  return loadHomepageData();
});
