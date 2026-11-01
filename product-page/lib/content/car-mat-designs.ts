import 'server-only';
import { cache } from 'react';
import {
  loadCarMatDesigns,
  loadCarMatMediaPlaceholder,
  loadCarMatPromoMedia,
} from '@/lib/data/content';
import type { CarMatDesign, CarMatPromoMedia } from './settings-defaults';

export type { CarMatDesign, CarMatPromoMedia } from './settings-defaults';
export {
  DEFAULT_CAR_MAT_DESIGNS,
  DEFAULT_CAR_MAT_PLACEHOLDER,
  DEFAULT_CAR_MAT_PROMO_MEDIA,
} from './settings-defaults';

/**
 * Backend-neutral car-mat loaders. Honour CONTENT_STORE: with `supabase`
 * these never read Directus (Stage 7.x D-2). The placeholder resolves from
 * `car_mat_settings.placeholder_image_url` (Supabase-owned, R2 URL).
 */
export const getCarMatDesigns = cache(async (): Promise<CarMatDesign[]> => {
  return loadCarMatDesigns();
});

export const getCarMatPromoMedia = cache(async (): Promise<CarMatPromoMedia> => {
  return loadCarMatPromoMedia();
});

export const getCarMatMediaPlaceholder = cache(async (): Promise<string> => {
  return loadCarMatMediaPlaceholder();
});
