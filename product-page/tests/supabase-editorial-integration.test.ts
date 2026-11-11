/**
 * Read-only Supabase editorial integration tests: real PostgREST SELECTs through
 * the server admin client and the real content adapter (Stage 7.x repair).
 * No INSERT/UPDATE/DELETE. Detects schema drift, FK mapping, settings sourcing,
 * silent fallback and switched-domain Directus reads.
 *
 * Run: pnpm run test:supabase-editorial
 * Requires .env.local with SUPABASE_URL / SUPABASE_SECRET_KEY.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { PRODUCT_MEDIA_REQUIRED_SLOTS } from '../lib/data/content/media-slots';
import type { EditorialContent } from '../lib/data/content/types';
import {
  getContentSource,
  loadAboutData,
  loadCarMatDesigns,
  loadCarMatPromoMedia,
  loadHomepageData,
  loadSupabaseAboutSettings,
  loadSupabaseCarMatSettings,
  loadSupabaseHomepageSettings,
} from '../lib/data/content';
import { createSupabaseContentRepository } from '../lib/data/content/supabase';
import { getSupabaseAdminClient } from '../lib/supabase/server';
import type { SizeId } from '../lib/content/types';

const SIZE_IDS: SizeId[] = ['S', 'M', 'L', 'XL'];
const DIRECTUS_SENTINEL = 'https://directus-sentinel.invalid';

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

describe('Supabase editorial integration (read-only, Stage 7.x)', () => {
  let editorial: EditorialContent;
  const fetchLog: string[] = [];
  let realFetch: typeof globalThis.fetch;

  before(async () => {
    assert.ok(
      process.env.SUPABASE_URL?.trim(),
      'SUPABASE_URL must be set (use --env-file=.env.local)',
    );
    assert.ok(
      process.env.SUPABASE_SECRET_KEY?.trim(),
      'SUPABASE_SECRET_KEY must be set (use --env-file=.env.local)',
    );
    process.env.CONTENT_STORE = 'supabase';
    process.env.CATALOG_STORE = 'supabase';
    process.env.DIRECTUS_URL = DIRECTUS_SENTINEL;

    realFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      fetchLog.push(url);
      return realFetch(input, init);
    }) as typeof globalThis.fetch;

    editorial = await createSupabaseContentRepository().loadEditorial();
  });

  after(() => {
    globalThis.fetch = realFetch;
  });

  it('every content projection completes against live PostgREST', () => {
    assert.ok(editorial.galleryImages.length >= 1, 'gallery_images rows mapped');
    assert.ok(editorial.contentSets.length >= 1, 'content_sets rows mapped');
    assert.ok(editorial.contentSections.length >= 1, 'content_sections rows mapped');
    assert.ok(editorial.faqItems.length >= 1, 'faq_items rows mapped');
    assert.ok(editorial.richSections.length >= 1, 'rich_sections rows mapped');
    assert.ok(editorial.richSectionImages.length >= 1, 'rich_section_images rows mapped');
    assert.ok(editorial.benefitModals.length >= 1, 'benefit_modals rows mapped');
    assert.ok(editorial.reviews.items.length >= 1, 'reviews_items mapped');
    assert.ok(editorial.logoSettings.title.length >= 1, 'logo_settings mapped');
    assert.ok(editorial.siteSettings.designInfoText.length >= 1, 'site_settings mapped');
    assert.ok(editorial.homepage?.hero.title.length ?? 0 >= 1, 'homepage_settings mapped');
    assert.ok(editorial.about?.hero.title.length ?? 0 >= 1, 'about_settings mapped');
    assert.ok((editorial.carMat?.designs.length ?? 0) >= 1, 'car_mat_settings mapped');
  });

  it('schema drift guard: adapter column lists exist, bogus columns are rejected', async () => {
    const client = getSupabaseAdminClient();
    // Singleton settings tables expose their real columns on the row object.
    const probes: Array<[string, string]> = [
      ['homepage_settings', 'homepage_hero_title'],
      ['about_settings', 'about_hero_title'],
      ['review_settings', 'reviews_title'],
      ['video_review_settings', 'video_reviews'],
      ['site_settings', 'media_placeholder_url'],
      ['logo_settings', 'placement_image_url'],
    ];
    for (const [table, column] of probes) {
      const { data, error } = await client.from(table).select(column).limit(1);
      assert.equal(error, null, `${table}.${column} must be selectable`);
      const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
      if (rows.length > 0) {
        assert.ok(column in rows[0], `${table}.${column} present on row`);
      }
    }
    // PostgREST rejects unknown columns, so successful adapter selects prove existence.
    const { error: bogusError } = await client
      .from('site_settings')
      .select('definitely_missing_column_stage7x')
      .limit(1);
    assert.ok(bogusError, 'unknown column must fail the projection');
  });

  it('17/17 canonical product_media slots resolve', () => {
    assert.equal(PRODUCT_MEDIA_REQUIRED_SLOTS.length, 17);
    assert.ok(editorial.magneticSystemMedia.video.includes('media.carzo.com.ua'), 'magnetic video is R2');
    assert.ok(editorial.magneticSystemMedia.defaultPoster.includes('media.carzo.com.ua'), 'default cover is R2');
    assert.equal(Object.keys(editorial.magneticSystemMedia.posters).length, 12, '12 design:size posters');
    assert.ok(editorial.richContentVideos['rich-materials'].includes('media.carzo.com.ua'), 'materials video is R2');
    assert.ok(editorial.richContentVideos['rich-edging'].includes('media.carzo.com.ua'), 'edging video is R2');
    assert.ok(editorial.fixationVideo.includes('media.carzo.com.ua'), 'fixation video is R2');
  });

  it('maps FK columns to natural identifiers (design slug, size code, set/section keys)', async () => {
    const client = getSupabaseAdminClient();
    const { data: galleryRows, error } = await client
      .from('gallery_images')
      .select('key,design_id,size_id,media_url,designs:design_id(slug),sizes:size_id(code)')
      .eq('status', 'published');
    assert.equal(error, null, 'gallery_images embed select must succeed');

    const adapterByKey = new Map(editorial.galleryImages.map(item => [item.key, item]));
    let mappedWithDesign = 0;
    for (const raw of galleryRows ?? []) {
      const row = raw as unknown as {
        key: string;
        designs: { slug?: string } | null;
        sizes: { code?: string } | null;
      };
      const item = adapterByKey.get(String(row.key));
      assert.ok(item, `gallery row ${row.key} mapped into adapter output`);
      if (row.designs?.slug) {
        assert.equal(item?.designSlug, row.designs.slug, 'designSlug comes from designs.slug');
        mappedWithDesign += 1;
      }
      if (row.sizes?.code) {
        assert.equal(item?.size, row.sizes.code, 'size comes from sizes.code');
        assert.ok(SIZE_IDS.includes(item?.size as SizeId), 'size is a valid SizeId');
      }
    }
    assert.ok(mappedWithDesign >= 1, 'at least one gallery image resolved through the design FK');

    const setKeys = new Set(editorial.contentSets.map(item => item.key));
    for (const section of editorial.contentSections) {
      assert.ok(section.contentSetKey, 'content section carries a resolved content_set key');
      assert.ok(setKeys.has(section.contentSetKey), `contentSetKey ${section.contentSetKey} resolves`);
    }
    const sectionKeys = new Set(editorial.richSections.map(item => item.key));
    for (const image of editorial.richSectionImages) {
      assert.ok(sectionKeys.has(image.sectionKey), `sectionKey ${image.sectionKey} resolves`);
      assert.ok(image.designSlug, 'rich image carries a resolved design slug');
    }
  });

  it('homepage/about/car-mat/review data is sourced from Supabase rows, not defaults', async () => {
    const client = getSupabaseAdminClient();
    const [{ data: homeRows }, { data: aboutRows }, { data: carMatRows }, { data: reviewRows }, { data: videoRows }] =
      await Promise.all([
        client.from('homepage_settings').select('*'),
        client.from('about_settings').select('*'),
        client.from('car_mat_settings').select('*'),
        client.from('review_settings').select('reviews_title'),
        client.from('video_review_settings').select('video_reviews_social_handle'),
      ]);
    const homeRow = (homeRows ?? [])[0] as Record<string, unknown> | undefined;
    const aboutRow = (aboutRows ?? [])[0] as Record<string, unknown> | undefined;
    const carMatRow = (carMatRows ?? [])[0] as Record<string, unknown> | undefined;
    const reviewRow = (reviewRows ?? [])[0] as Record<string, unknown> | undefined;
    const videoRow = (videoRows ?? [])[0] as Record<string, unknown> | undefined;
    assert.ok(homeRow && aboutRow && carMatRow && reviewRow && videoRow, 'all settings singletons have rows');

    const homepage = await loadSupabaseHomepageSettings();
    const about = await loadSupabaseAboutSettings();
    const carMat = await loadSupabaseCarMatSettings();

    assert.equal(homepage.hero.title, String(homeRow.homepage_hero_title));
    assert.equal(homepage.hero.eyebrow, String(homeRow.homepage_hero_eyebrow));
    assert.equal(homepage.hero.logoVideoUrl, String(homeRow.homepage_logo_video_url));
    assert.equal(about.hero.title, String(aboutRow.about_hero_title));
    assert.equal(about.statement.text, String(aboutRow.about_statement_text));
    assert.equal(carMat.promoMedia.videoUrl, String(carMatRow.car_mat_promo_video_url));
    assert.equal(carMat.promoMedia.coverUrl, String(carMatRow.car_mat_promo_cover_url));

    // Discriminators: DB values that differ from DEFAULT_* prove live sourcing.
    assert.equal(
      homepage.hero.logoVideoUrl,
      'https://media.carzo.com.ua/content/pages/home/logo-video.mp4',
      'homepage logo video is the live R2 URL (DEFAULT is empty)',
    );
    assert.equal(
      carMat.promoMedia.videoUrl,
      'https://media.carzo.com.ua/content/products/car-mats/promo-video.mp4',
      'car-mat promo video is the live R2 URL (DEFAULT is a local path)',
    );
    assert.equal(editorial.reviews.settings.title, String(reviewRow.reviews_title));
    assert.equal(editorial.videoReviews.socialHandle, String(videoRow.video_reviews_social_handle));
    assert.ok(editorial.logoSettings.placementImage.includes('media.carzo.com.ua'), 'logo placement image is R2');

    // loadEditorial carries the same typed settings data (no read-and-discard).
    assert.deepEqual(editorial.homepage, homepage);
    assert.deepEqual(editorial.about, about);
    assert.deepEqual(editorial.carMat, carMat);
  });

  it('CONTENT_STORE=supabase makes zero Directus reads for switched domains', async () => {
    fetchLog.length = 0;
    const homepage = await loadHomepageData();
    const about = await loadAboutData();
    const designs = await loadCarMatDesigns();
    const promo = await loadCarMatPromoMedia();
    await createSupabaseContentRepository().loadEditorial();

    assert.ok(homepage.hero.title.length >= 1);
    assert.ok(about.hero.title.length >= 1);
    assert.ok(designs.length >= 1);
    assert.ok(promo.videoUrl.length >= 1);

    const directusCalls = fetchLog.filter(url => (
      url.includes('directus-sentinel.invalid') || url.includes('/items/carzo_')
    ));
    assert.deepEqual(
      directusCalls,
      [],
      `switched domains must not fetch Directus; got: ${directusCalls.join(', ')}`,
    );
    assert.ok(fetchLog.length >= 1, 'Supabase reads actually ran (spy recorded traffic)');
  });

  it('no silent editorial fallback and no Directus asset URLs in Supabase output', async () => {
    const source = await getContentSource();
    assert.equal(source.editorialFallbackUsed, false, 'live editorial load must not fall back');
    assert.ok(source.galleryImages.length >= 1, 'content source carries live gallery');
    assert.ok(source.siteSettings.designInfoText.length >= 1, 'content source carries live site settings');

    const homepage = await loadHomepageData();
    const carMat = await loadCarMatPromoMedia();
    const urls = collectUrls(editorial);
    collectUrls(homepage, urls);
    collectUrls(carMat, urls);

    const directusAssets = urls.filter(url => url.includes('/api/directus-assets/'));
    assert.deepEqual(directusAssets, [], 'published Supabase content must not reference the Directus proxy');
    const directusHosts = urls.filter(url => url.includes('directus'));
    assert.deepEqual(directusHosts, [], 'no Directus hosts in editorial media');

    // Car-mat runtime must carry no placeholder at all (Stage 7.x D-1 owner
    // decision). siteSettings.mediaPlaceholder (PDP gallery/rich fallback) is
    // intentionally out of this scope and kept.
    const carMatUrls = collectUrls(editorial.carMat ?? {});
    collectUrls(homepage, carMatUrls);
    collectUrls(carMat, carMatUrls);
    const landscapeRefs = carMatUrls.filter(url => url.includes('landscape-placeholder'));
    assert.deepEqual(landscapeRefs, [], 'no car-mat placeholder references in car-mat runtime');
  });
});
