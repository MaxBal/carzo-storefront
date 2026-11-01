import 'server-only';
import { cache } from 'react';
import { loadAboutData } from '@/lib/data/content';
import type { AboutData } from './settings-defaults';

export type {
  AboutData,
  AboutPrincipleItem,
  AboutProcessBlock,
} from './settings-defaults';
export { DEFAULT_ABOUT } from './settings-defaults';

/**
 * Backend-neutral about editorial loader. Honours CONTENT_STORE: with
 * `supabase` this never reads Directus (Stage 7.x D-2).
 */
export const getAboutData = cache(async (): Promise<AboutData> => {
  return loadAboutData();
});
