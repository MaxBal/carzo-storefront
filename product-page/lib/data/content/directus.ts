import 'server-only';

import { cache } from 'react';
import {
  getContentSource as getDirectusContentSource,
} from '@/lib/content/directus';
import type { ContentSource } from '@/lib/content/types';
import type { EditorialContent, ContentRepository } from './types';

function editorialFromSource(source: ContentSource): EditorialContent {
  return {
    galleryImages: source.galleryImages,
    contentSets: source.contentSets,
    contentSections: source.contentSections,
    faqItems: source.faqItems,
    logoSettings: source.logoSettings,
    richSections: source.richSections,
    richSectionImages: source.richSectionImages,
    magneticSystemMedia: source.magneticSystemMedia,
    richContentVideos: source.richContentVideos,
    fixationVideo: source.fixationVideo,
    benefitModals: source.benefitModals,
    reviews: source.reviews,
    videoReviews: source.videoReviews,
    siteSettings: source.siteSettings,
  };
}

/**
 * Directus editorial adapter — wraps existing lib/content/directus.ts load.
 * Default path behavior unchanged.
 */
export function createDirectusContentRepository(): ContentRepository {
  return {
    async loadEditorial(): Promise<EditorialContent> {
      const source = await getDirectusContentSource();
      return editorialFromSource(source);
    },
  };
}

/** Test helper: project a full ContentSource into editorial-only shape. */
export const __editorialFromSource = editorialFromSource;
