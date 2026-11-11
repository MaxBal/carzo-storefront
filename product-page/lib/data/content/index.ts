import 'server-only';

import { cache } from 'react';
import { DEFAULT_CONTENT_SOURCE } from '@/lib/content/default-source';
import {
  DEFAULT_ABOUT,
  DEFAULT_CAR_MAT_DESIGNS,
  DEFAULT_CAR_MAT_PROMO_MEDIA,
  DEFAULT_HOMEPAGE,
  type AboutData,
  type CarMatDesign,
  type CarMatContent,
  type CarMatPromoMedia,
  type HomepageData,
} from '@/lib/content/settings-defaults';
import type {
  ContentSource,
  ProductCatalog,
  ProductVariant,
  DiscountTier,
} from '@/lib/content/types';
import { resolveCatalogStoreBackend, resolveContentStoreBackend } from '../config';
import { loadCatalogData } from '../catalog';
import { createDirectusContentRepository } from './directus';
import {
  loadDirectusAboutSettings,
  loadDirectusCarMatDesigns,
  loadDirectusCarMatPromoMedia,
  loadDirectusHomepageSettings,
} from './directus-settings';
import {
  createSupabaseContentRepository,
  loadSupabaseAboutSettings,
  loadSupabaseCarMatSettings,
  loadSupabaseHomepageSettings,
} from './supabase';
import type { ContentRepository, EditorialContent } from './types';

export type { ContentRepository, EditorialContent } from './types';
export { EditorialUnavailableError } from './supabase';
export {
  loadSupabaseHomepageSettings,
  loadSupabaseAboutSettings,
  loadSupabaseCarMatSettings,
} from './supabase';

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
    homepage: DEFAULT_HOMEPAGE,
    about: DEFAULT_ABOUT,
    carMat: {
      designs: DEFAULT_CAR_MAT_DESIGNS,
      promoMedia: DEFAULT_CAR_MAT_PROMO_MEDIA,
      modalTitle: '',
      modalDescription: '',
    },
  };
}

function reportEditorialFallback(scope: string, error: unknown): void {
  // Always-on marker so staging audits can detect fallback use; a failed DB
  // query must never be scored PASS because DEFAULT_CONTENT_SOURCE loaded.
  console.error(
    `[carzo-content] EDITORIAL_FALLBACK_ACTIVE scope=${scope}:`,
    error instanceof Error ? error.message : error,
  );
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
  let editorialFallbackUsed = false;
  try {
    editorial = await createContentRepository(contentBackend).loadEditorial();
  } catch (error) {
    // Editorial-only fallback is allowed; never overwrites catalog.
    reportEditorialFallback('content-source', error);
    editorial = editorialFallback();
    editorialFallbackUsed = true;
  }

  const origin: ContentSource['origin'] = contentBackend === 'directus' && catalogBackend === 'directus'
    ? 'directus'
    : contentBackend === 'directus' || catalogBackend === 'directus'
      ? 'directus'
      : 'fallback';

  return {
    origin,
    editorialFallbackUsed,
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

async function loadHomepageDataUncached(): Promise<HomepageData> {
  const backend = resolveContentStoreBackend();
  try {
    return backend === 'supabase'
      ? await loadSupabaseHomepageSettings()
      : await loadDirectusHomepageSettings();
  } catch (error) {
    reportEditorialFallback('homepage', error);
    return DEFAULT_HOMEPAGE;
  }
}

async function loadAboutDataUncached(): Promise<AboutData> {
  const backend = resolveContentStoreBackend();
  try {
    return backend === 'supabase'
      ? await loadSupabaseAboutSettings()
      : await loadDirectusAboutSettings();
  } catch (error) {
    reportEditorialFallback('about', error);
    return DEFAULT_ABOUT;
  }
}

const loadCarMatContent = cache(async (): Promise<CarMatContent> => {
  const backend = resolveContentStoreBackend();
  if (backend === 'supabase') {
    try {
      return await loadSupabaseCarMatSettings();
    } catch (error) {
      reportEditorialFallback('car-mat', error);
      return {
        designs: DEFAULT_CAR_MAT_DESIGNS,
        promoMedia: DEFAULT_CAR_MAT_PROMO_MEDIA,
        modalTitle: '',
        modalDescription: '',
      };
    }
  }
  try {
    const [designs, promoMedia] = await Promise.all([
      loadDirectusCarMatDesigns(),
      loadDirectusCarMatPromoMedia(),
    ]);
    return { designs, promoMedia, modalTitle: '', modalDescription: '' };
  } catch (error) {
    reportEditorialFallback('car-mat', error);
    return {
      designs: DEFAULT_CAR_MAT_DESIGNS,
      promoMedia: DEFAULT_CAR_MAT_PROMO_MEDIA,
      modalTitle: '',
      modalDescription: '',
    };
  }
});

/** Backend-neutral homepage editorial loader (CONTENT_STORE-aware). */
export const loadHomepageData = cache(loadHomepageDataUncached);

/** Backend-neutral about editorial loader (CONTENT_STORE-aware). */
export const loadAboutData = cache(loadAboutDataUncached);

export async function loadCarMatDesigns(): Promise<CarMatDesign[]> {
  return (await loadCarMatContent()).designs;
}

export async function loadCarMatPromoMedia(): Promise<CarMatPromoMedia> {
  return (await loadCarMatContent()).promoMedia;
}
