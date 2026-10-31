import 'server-only';

import { cache } from 'react';
import { DEFAULT_CONTENT_SOURCE } from '@/lib/content/default-source';
import type {
  ContentSource,
  ProductCatalog,
  ProductVariant,
  DiscountTier,
} from '@/lib/content/types';
import { resolveCatalogStoreBackend, resolveContentStoreBackend } from '../config';
import { loadCatalogData } from '../catalog';
import { createDirectusContentRepository } from './directus';
import { createSupabaseContentRepository } from './supabase';
import type { ContentRepository, EditorialContent } from './types';

export type { ContentRepository, EditorialContent } from './types';
export { EditorialUnavailableError } from './supabase';

function createContentRepository(
  backend: ReturnType<typeof resolveContentStoreBackend>,
): ContentRepository {
  switch (backend) {
    case 'directus':
      return createDirectusContentRepository();
    case 'supabase':
      return createSupabaseContentRepository();
    default: {
      const exhaustive: never = backend;
      throw new Error(`Unsupported content store backend: ${String(exhaustive)}`);
    }
  }
}

function editorialFallback(): EditorialContent {
  return {
    galleryImages: DEFAULT_CONTENT_SOURCE.galleryImages,
    contentSets: DEFAULT_CONTENT_SOURCE.contentSets,
    contentSections: DEFAULT_CONTENT_SOURCE.contentSections,
    faqItems: DEFAULT_CONTENT_SOURCE.faqItems,
    logoSettings: DEFAULT_CONTENT_SOURCE.logoSettings,
    richSections: DEFAULT_CONTENT_SOURCE.richSections,
    richSectionImages: DEFAULT_CONTENT_SOURCE.richSectionImages,
    magneticSystemMedia: DEFAULT_CONTENT_SOURCE.magneticSystemMedia,
    richContentVideos: DEFAULT_CONTENT_SOURCE.richContentVideos,
    fixationVideo: DEFAULT_CONTENT_SOURCE.fixationVideo,
    benefitModals: DEFAULT_CONTENT_SOURCE.benefitModals,
    reviews: DEFAULT_CONTENT_SOURCE.reviews,
    videoReviews: DEFAULT_CONTENT_SOURCE.videoReviews,
    siteSettings: DEFAULT_CONTENT_SOURCE.siteSettings,
  };
}

/**
 * Compose ContentSource from independent catalog + editorial backends.
 * Editorial failure may fall back to DEFAULT_CONTENT_SOURCE editorial only;
 * commerce data is never replaced by editorial fallback.
 */
export const getContentSource = cache(async (): Promise<ContentSource> => {
  const catalogBackend = resolveCatalogStoreBackend();
  const contentBackend = resolveContentStoreBackend();

  let catalog: ProductCatalog & {
    variants: ProductVariant[];
    discountTiers: DiscountTier[];
    checkoutPaymentDetails: string;
  };
  try {
    const data = await loadCatalogData();
    catalog = {
      designs: data.designs,
      sizes: data.sizes,
      brands: data.brands,
      fixations: data.fixations,
      variants: data.variants,
      discountTiers: data.discountTiers,
      checkoutPaymentDetails: data.checkoutPaymentDetails,
    };
  } catch (error) {
    // Commerce fail-closed: do not substitute DEFAULT prices/stock.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[carzo-content] catalog backend failed; ContentSource catalog left empty.', error);
    }
    throw error;
  }

  let editorial: EditorialContent;
  try {
    editorial = await createContentRepository(contentBackend).loadEditorial();
  } catch (error) {
    // Editorial-only fallback is allowed; never overwrites catalog.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[carzo-content] editorial backend failed; using local editorial fallback.', error);
    }
    editorial = editorialFallback();
  }

  const origin: ContentSource['origin'] = contentBackend === 'directus' && catalogBackend === 'directus'
    ? 'directus'
    : contentBackend === 'directus' || catalogBackend === 'directus'
      ? 'directus'
      : 'fallback';

  return {
    origin,
    designs: catalog.designs,
    sizes: catalog.sizes,
    brands: catalog.brands,
    fixations: catalog.fixations,
    variants: catalog.variants,
    discountTiers: catalog.discountTiers,
    galleryImages: editorial.galleryImages,
    contentSets: editorial.contentSets,
    contentSections: editorial.contentSections,
    faqItems: editorial.faqItems,
    logoSettings: editorial.logoSettings,
    logoPlacements: DEFAULT_CONTENT_SOURCE.logoPlacements,
    richSections: editorial.richSections,
    richSectionImages: editorial.richSectionImages,
    magneticSystemMedia: editorial.magneticSystemMedia,
    richContentVideos: editorial.richContentVideos,
    fixationVideo: editorial.fixationVideo,
    benefitModals: editorial.benefitModals,
    reviews: editorial.reviews,
    videoReviews: editorial.videoReviews,
    siteSettings: editorial.siteSettings,
  };
});

/** Test helper: compose without cache. */
export async function composeContentSource(): Promise<ContentSource> {
  return getContentSource();
}
