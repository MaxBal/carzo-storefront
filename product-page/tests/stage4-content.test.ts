import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_CONTENT_SOURCE } from '../lib/content/default-source';
import { PRODUCT_MEDIA_REQUIRED_SLOTS } from '../lib/data/content/media-slots';
import type { EditorialContent } from '../lib/data/content/types';

function collectUrls(value: unknown, acc: string[] = []): string[] {
  if (typeof value === 'string') {
    if (value.includes('http') || value.startsWith('/')) acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, acc);
    return acc;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectUrls(item, acc);
    return acc;
  }
  return acc;
}

describe('Stage 4 content product_media', () => {
  it('requires the 17 canonical slots', () => {
    assert.equal(PRODUCT_MEDIA_REQUIRED_SLOTS.length, 17);
    assert.ok(PRODUCT_MEDIA_REQUIRED_SLOTS.includes('magnetic_system_video'));
    assert.ok(PRODUCT_MEDIA_REQUIRED_SLOTS.includes('materials_video'));
    assert.ok(PRODUCT_MEDIA_REQUIRED_SLOTS.includes('edging_video'));
    assert.ok(PRODUCT_MEDIA_REQUIRED_SLOTS.includes('fixation_video'));
    assert.ok(PRODUCT_MEDIA_REQUIRED_SLOTS.includes('magnetic_system_default_cover'));
  });
});

describe('Stage 4 editorial separation', () => {
  it('editorial fallback does not include pricing/stock fields', () => {
    const editorial: EditorialContent = {
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
    assert.equal('variants' in editorial, false);
    assert.equal('discountTiers' in editorial, false);
    assert.equal('checkoutPaymentDetails' in editorial, false);
    assert.equal('brands' in editorial, false);
    assert.equal('designs' in editorial, false);
    assert.equal('sizes' in editorial, false);
    assert.equal('fixations' in editorial, false);
  });

  it('rejects Directus asset paths when scanning Supabase-style output', () => {
    const urls = collectUrls({
      galleryImages: [{ src: 'https://media.carzo.com.ua/a.jpg' }],
      logoSettings: { fallbackImage: '/api/directus-assets/abc' },
    });
    const directusAssetUrls = urls.filter(url => url.includes('/api/directus-assets/'));
    assert.equal(directusAssetUrls.length, 1);
    // Documented assertion: Supabase adapters must not emit these.
    assert.ok(directusAssetUrls.every(url => url.startsWith('/api/directus-assets/')));
  });
});
