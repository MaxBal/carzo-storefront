import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { DEFAULT_CONTENT_SOURCE } from '@/lib/content/default-source';
import {
  DEFAULT_ABOUT,
  DEFAULT_CAR_MAT_DESIGNS,
  DEFAULT_CAR_MAT_PROMO_MEDIA,
  DEFAULT_HOMEPAGE,
  parseAboutSettings,
  parseCarMatDesigns,
  parseCarMatPromoMedia,
  parseHomepageSettings,
  type AboutData,
  type CarMatContent,
  type HomepageData,
} from '@/lib/content/settings-defaults';
import type {
  BenefitModalData,
  ContentSet,
  ContentSection,
  FaqItem,
  GalleryImage,
  LogoSettings,
  MagneticSystemMedia,
  ReviewsData,
  RichContentSection,
  RichContentSectionImage,
  SiteSettings,
  SizeContentGroup,
  SizeId,
  VideoReviewItem,
  VideoReviewsData,
} from '@/lib/content/types';
import type { EditorialContent, ContentRepository } from './types';
import { MAGNETIC_POSTER_SLOTS, PRODUCT_MEDIA_REQUIRED_SLOTS } from './media-slots';

export { PRODUCT_MEDIA_REQUIRED_SLOTS, MAGNETIC_POSTER_SLOTS };

type SupabaseRow = Record<string, unknown>;

export class EditorialUnavailableError extends Error {
  readonly code = 'UNAVAILABLE' as const;

  constructor(message: string) {
    super(message);
    this.name = 'EditorialUnavailableError';
  }
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

/** R2-only URL. Rejects Directus UUIDs/asset paths. */
function r2Url(value: unknown): string {
  const raw = text(value).trim();
  if (!raw) return '';
  if (/^https:\/\/[^\s]+$/i.test(raw)) return raw;
  if (raw.startsWith('/') && !raw.startsWith('/api/directus-assets/')) return raw;
  return '';
}

/** Supabase media resolver: external/R2 URL only; legacy file refs are never present. */
function supabaseMediaUrl(external: unknown, _file: unknown, fallback: string): string {
  return r2Url(external) || fallback;
}

async function selectRows(
  table: string,
  columns: string,
  options?: { publishedOnly?: boolean },
): Promise<SupabaseRow[]> {
  let query = getSupabaseAdminClient().from(table).select(columns);
  if (options?.publishedOnly) {
    query = query.eq('status', 'published');
  }
  const { data, error } = await query;
  if (error) {
    throw new EditorialUnavailableError(`Supabase ${table} read failed: ${error.message}`);
  }
  return (data ?? []) as unknown as SupabaseRow[];
}

function parseReviewItems(raw: unknown): ReviewsData['items'] {
  if (!Array.isArray(raw)) return DEFAULT_CONTENT_SOURCE.reviews.items;
  const items = raw.map((item, index) => ({
    key: text(item.key) || `review-${index}`,
    reviewText: text(item.review_text || item.reviewText),
    customerName: text(item.customer_name || item.customerName),
    reviewDate: text(item.review_date || item.reviewDate),
    rating: number(item.rating, 5),
    sort: number(item.sort, index + 1),
  })).filter(item => item.reviewText);
  return items.length > 0 ? items : DEFAULT_CONTENT_SOURCE.reviews.items;
}

function parseReviewScreenshots(raw: unknown): ReviewsData['screenshots'] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => ({
    key: text(item.key) || `screenshot-${index}`,
    image: r2Url(item.image_url ?? item.image),
    altText: text(item.alt_text || item.altText),
    sort: number(item.sort, index + 1),
  })).filter(item => item.image);
}

function mapHomepageRow(row: SupabaseRow): HomepageData {
  return parseHomepageSettings(row, supabaseMediaUrl);
}

function mapAboutRow(row: SupabaseRow): AboutData {
  return parseAboutSettings(row, supabaseMediaUrl);
}

function mapCarMatRow(row: SupabaseRow): CarMatContent {
  return {
    designs: parseCarMatDesigns(row.car_mat_designs),
    promoMedia: parseCarMatPromoMedia(row, supabaseMediaUrl),
    modalTitle: text(row.car_mat_modal_title),
    modalDescription: text(row.car_mat_modal_description),
  };
}

const HOMEPAGE_SETTINGS_COLUMNS = [
  'homepage_hero_eyebrow', 'homepage_hero_title', 'homepage_hero_lead', 'homepage_hero_material_tag',
  'homepage_hero_products', 'homepage_logo_video_url',
  'homepage_badges_eyebrow', 'homepage_badges_title', 'homepage_badges_description',
  'homepage_badges_video_url', 'homepage_badges_size_label', 'homepage_badges_features',
  'homepage_quality_eyebrow', 'homepage_quality_title', 'homepage_quality_stats',
].join(',');

const ABOUT_SETTINGS_COLUMNS = [
  'about_hero_eyebrow', 'about_hero_title', 'about_hero_paragraph_1', 'about_hero_paragraph_2',
  'about_process_blocks', 'about_process_image_1_url', 'about_process_image_2_url', 'about_process_image_3_url',
  'about_principles_eyebrow', 'about_principles_title', 'about_principles_items',
  'about_development_title', 'about_development_text', 'about_statement_text',
].join(',');

const CAR_MAT_SETTINGS_COLUMNS = [
  'car_mat_designs', 'car_mat_modal_title', 'car_mat_modal_description',
  'car_mat_promo_video_url', 'car_mat_promo_cover_url',
].join(',');

const REVIEW_SETTINGS_COLUMNS = [
  'reviews_enabled', 'reviews_title', 'reviews_description_line_1', 'reviews_description_line_2',
  'reviews_cta_label', 'reviews_instagram_handle', 'reviews_items', 'reviews_screenshots',
  'reviews_modal_title', 'reviews_modal_description',
].join(',');

const VIDEO_REVIEW_SETTINGS_COLUMNS = [
  'video_reviews_enabled', 'video_reviews_title', 'video_reviews',
  'video_reviews_social_badge_url', 'video_reviews_social_handle', 'video_reviews_social_text',
  'video_reviews_social_verified',
  'video_reviews_stat_1_value', 'video_reviews_stat_1_text',
  'video_reviews_stat_2_value', 'video_reviews_stat_2_text',
  'video_reviews_stat_3_value', 'video_reviews_stat_3_text',
].join(',');

const SITE_SETTINGS_COLUMNS = [
  'design_info_text', 'feature_magnetic_text', 'feature_material_flag', 'feature_material_text',
  'rich_signoff', 'media_placeholder_url', 'site_flag_url', 'checkout_payment_details',
].join(',');

const GALLERY_COLUMNS =
  'key,design_id,size_id,media_url,alt,sort,designs:design_id(slug),sizes:size_id(code)';
const CONTENT_SET_COLUMNS =
  'key,kind,design_id,size_id,size_group,title,content_tab_label,faq_tab_label,info_box,designs:design_id(slug),sizes:size_id(code)';
const CONTENT_SECTION_COLUMNS =
  'key,content_set_id,title,text,media_url,image_placeholder,sort,content_sets:content_set_id(key)';
const RICH_SECTION_IMAGE_COLUMNS =
  'key,section_id,design_id,media_url,alt,designs:design_id(slug),rich_sections:section_id(key)';
const LOGO_SETTINGS_COLUMNS = 'title,info_text,fallback_image_url,placement_image_url,specs';
const PRODUCT_MEDIA_COLUMNS = 'slot,media_url';

/**
 * Narrow editorial settings loaders (Supabase). Throw on query failure so the
 * staging audit can distinguish live data from the local fallback.
 */
export async function loadSupabaseHomepageSettings(): Promise<HomepageData> {
  const rows = await selectRows('homepage_settings', HOMEPAGE_SETTINGS_COLUMNS, { publishedOnly: true });
  return rows[0] ? mapHomepageRow(rows[0]) : DEFAULT_HOMEPAGE;
}

export async function loadSupabaseAboutSettings(): Promise<AboutData> {
  const rows = await selectRows('about_settings', ABOUT_SETTINGS_COLUMNS, { publishedOnly: true });
  return rows[0] ? mapAboutRow(rows[0]) : DEFAULT_ABOUT;
}

export async function loadSupabaseCarMatSettings(): Promise<CarMatContent> {
  const rows = await selectRows('car_mat_settings', CAR_MAT_SETTINGS_COLUMNS, { publishedOnly: true });
  return rows[0]
    ? mapCarMatRow(rows[0])
    : {
        designs: DEFAULT_CAR_MAT_DESIGNS,
        promoMedia: DEFAULT_CAR_MAT_PROMO_MEDIA,
        modalTitle: '',
        modalDescription: '',
      };
}

/**
 * Supabase editorial adapter — SELECT-only, R2 URLs only, 17/17 product_media required.
 * Never queries Directus and never supplies commerce/pricing data.
 */
export function createSupabaseContentRepository(): ContentRepository {
  return {
    async loadEditorial(): Promise<EditorialContent> {
      try {
        const [
          galleryImages,
          contentSets,
          contentSections,
          faqItems,
          richSections,
          richSectionImages,
          benefitModals,
          logoSettingsRows,
          productMediaRows,
          siteSettingsRows,
          homepageSettingsRows,
          aboutSettingsRows,
          reviewSettingsRows,
          videoReviewSettingsRows,
          carMatSettingsRows,
        ] = await Promise.all([
          selectRows('gallery_images', GALLERY_COLUMNS, { publishedOnly: true }),
          selectRows('content_sets', CONTENT_SET_COLUMNS, { publishedOnly: true }),
          selectRows('content_sections', CONTENT_SECTION_COLUMNS, { publishedOnly: true }),
          selectRows('faq_items', 'key,faq_group,question,answer,sort', { publishedOnly: true }),
          selectRows(
            'rich_sections',
            'key,title,subtitle,description,additional_title,additional_text,additional_list,sort',
            { publishedOnly: true },
          ),
          selectRows('rich_section_images', RICH_SECTION_IMAGE_COLUMNS, { publishedOnly: true }),
          selectRows('benefit_modals', 'key,card_label,title,subtitle,sort,content', { publishedOnly: true }),
          selectRows('logo_settings', LOGO_SETTINGS_COLUMNS, { publishedOnly: true }),
          selectRows('product_media', PRODUCT_MEDIA_COLUMNS),
          selectRows('site_settings', SITE_SETTINGS_COLUMNS, { publishedOnly: true }),
          selectRows('homepage_settings', HOMEPAGE_SETTINGS_COLUMNS, { publishedOnly: true }),
          selectRows('about_settings', ABOUT_SETTINGS_COLUMNS, { publishedOnly: true }),
          selectRows('review_settings', REVIEW_SETTINGS_COLUMNS, { publishedOnly: true }),
          selectRows('video_review_settings', VIDEO_REVIEW_SETTINGS_COLUMNS, { publishedOnly: true }),
          selectRows('car_mat_settings', CAR_MAT_SETTINGS_COLUMNS, { publishedOnly: true }),
        ]);

        const mediaBySlot = new Map<string, string>();
        for (const row of productMediaRows) {
          const slot = text(row.slot);
          const url = r2Url(row.media_url);
          if (slot && url) mediaBySlot.set(slot, url);
        }
        for (const slot of PRODUCT_MEDIA_REQUIRED_SLOTS) {
          // Stage 2A verified 17/17; empty intentional slots stay empty strings but must be present.
          if (!mediaBySlot.has(slot)) {
            // fixation-bottom/wall style empties are historical; required set here is the 17 canonical product_media slots.
            mediaBySlot.set(slot, mediaBySlot.get(slot) ?? '');
          }
        }
        if (productMediaRows.length !== 17) {
          throw new EditorialUnavailableError(
            `product_media expected 17 canonical slots, got ${productMediaRows.length}`,
          );
        }

        const posters: Record<string, string> = {};
        for (const item of MAGNETIC_POSTER_SLOTS) {
          const url = mediaBySlot.get(item.slot);
          if (url) posters[`${item.designSlug}:${item.size}`] = url;
        }

        const magneticSystemMedia: MagneticSystemMedia = {
          video: mediaBySlot.get('magnetic_system_video') ?? '',
          defaultPoster: mediaBySlot.get('magnetic_system_default_cover') ?? '',
          posters,
        };

        const richContentVideos: Record<string, string> = {
          'rich-materials': mediaBySlot.get('materials_video') ?? '',
          'rich-edging': mediaBySlot.get('edging_video') ?? '',
        };

        const fixationVideo = mediaBySlot.get('fixation_video') ?? '';

        const gallery: GalleryImage[] = galleryImages.map((row, index) => ({
          key: text(row.key) || `gallery-${index}`,
          designSlug: text((row.designs as SupabaseRow | undefined)?.slug) || null,
          size: (text((row.sizes as SupabaseRow | undefined)?.code) || null) as SizeId | null,
          src: r2Url(row.media_url),
          alt: text(row.alt),
          sort: number(row.sort, index + 1),
          fallbackSrc: '',
          isPlaceholder: false,
        })).filter(item => item.src);

        const sets: ContentSet[] = contentSets.map(row => ({
          key: text(row.key),
          kind: text(row.kind) as 'inside' | 'fixation',
          designSlug: text((row.designs as SupabaseRow | undefined)?.slug) || null,
          size: (text((row.sizes as SupabaseRow | undefined)?.code) || null) as SizeId | null,
          sizeGroup: (text(row.size_group) || null) as SizeContentGroup | null,
          title: text(row.title),
          contentTabLabel: text(row.content_tab_label),
          faqTabLabel: text(row.faq_tab_label),
          infoBox: text(row.info_box),
        }));

        const sections: ContentSection[] = contentSections.map(row => ({
          key: text(row.key),
          contentSetKey: text((row.content_sets as SupabaseRow | undefined)?.key),
          title: text(row.title),
          text: text(row.text),
          image: r2Url(row.media_url) || undefined,
          imagePlaceholder: text(row.image_placeholder) || undefined,
          sort: number(row.sort),
        }));

        const faqs: FaqItem[] = faqItems.map(row => ({
          key: text(row.key),
          group: text(row.faq_group) as 'inside' | 'fixation' | 'logo',
          question: text(row.question),
          answer: text(row.answer),
          sort: number(row.sort),
        }));

        const logoRow = logoSettingsRows[0];
        const logo: LogoSettings = logoRow
          ? {
              title: text(logoRow.title),
              infoText: text(logoRow.info_text),
              fallbackImage: r2Url(logoRow.fallback_image_url),
              placementImage: r2Url(logoRow.placement_image_url),
              specs: Array.isArray(logoRow.specs)
                ? (logoRow.specs as LogoSettings['specs'])
                : [],
            }
          : DEFAULT_CONTENT_SOURCE.logoSettings;

        const rich: RichContentSection[] = richSections.map(row => ({
          key: text(row.key),
          title: text(row.title),
          subtitle: text(row.subtitle),
          description: text(row.description),
          additionalInfo: text(row.additional_title) && text(row.additional_text)
            ? {
                title: text(row.additional_title),
                text: text(row.additional_text),
                list: Array.isArray(row.additional_list) ? row.additional_list as string[] : undefined,
              }
            : undefined,
          sort: number(row.sort),
        }));

        const richImages: RichContentSectionImage[] = richSectionImages.map(row => ({
          key: text(row.key),
          designSlug: text((row.designs as SupabaseRow | undefined)?.slug),
          sectionKey: text((row.rich_sections as SupabaseRow | undefined)?.key),
          src: r2Url(row.media_url),
          alt: text(row.alt),
        })).filter(item => item.designSlug && item.sectionKey && item.src);

        const benefits: BenefitModalData[] = benefitModals.map(row => ({
          type: text(row.key) as BenefitModalData['type'],
          cardLabel: text(row.card_label),
          title: text(row.title),
          subtitle: text(row.subtitle),
          sort: number(row.sort),
          blocks: (row.content as { blocks?: BenefitModalData['blocks'] } | null)?.blocks ?? [],
        })).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

        const reviewRow = reviewSettingsRows[0];
        const reviews: ReviewsData = {
          settings: reviewRow
            ? {
                enabled: bool(reviewRow.reviews_enabled, true),
                title: text(reviewRow.reviews_title),
                descriptionLine1: text(reviewRow.reviews_description_line_1),
                descriptionLine2: text(reviewRow.reviews_description_line_2),
                instagramHandle: text(reviewRow.reviews_instagram_handle),
                ctaLabel: text(reviewRow.reviews_cta_label),
                modalTitle: text(reviewRow.reviews_modal_title),
                modalDescription: text(reviewRow.reviews_modal_description),
              }
            : DEFAULT_CONTENT_SOURCE.reviews.settings,
          items: parseReviewItems(reviewRow?.reviews_items),
          screenshots: parseReviewScreenshots(reviewRow?.reviews_screenshots),
        };

        const videoRow = videoReviewSettingsRows[0];
        const videoItems: VideoReviewItem[] = Array.isArray(videoRow?.video_reviews)
          ? (videoRow.video_reviews as SupabaseRow[]).map((item, index) => ({
              id: text(item.id) || `vr-${index + 1}`,
              title: text(item.title),
              videoUrl: r2Url(item.video_url) || text(item.video_url),
              coverUrl: r2Url(item.cover_url) || text(item.cover_url),
              sort: number(item.sort, index + 1),
              isActive: item.is_active === undefined ? true : bool(item.is_active, true),
            }))
              .filter(item => item.videoUrl)
              .sort((a, b) => a.sort - b.sort)
              .filter(item => item.isActive)
          : [];

        const videoReviews: VideoReviewsData = {
          enabled: videoRow?.video_reviews_enabled === undefined
            ? DEFAULT_CONTENT_SOURCE.videoReviews.enabled
            : bool(videoRow.video_reviews_enabled, true),
          title: text(videoRow?.video_reviews_title, DEFAULT_CONTENT_SOURCE.videoReviews.title),
          socialBadgeUrl: r2Url(videoRow?.video_reviews_social_badge_url) || DEFAULT_CONTENT_SOURCE.videoReviews.socialBadgeUrl,
          socialHandle: text(videoRow?.video_reviews_social_handle, DEFAULT_CONTENT_SOURCE.videoReviews.socialHandle),
          socialVerified: videoRow?.video_reviews_social_verified === undefined
            ? DEFAULT_CONTENT_SOURCE.videoReviews.socialVerified
            : bool(videoRow.video_reviews_social_verified, true),
          socialText: text(videoRow?.video_reviews_social_text, DEFAULT_CONTENT_SOURCE.videoReviews.socialText),
          stats: [
            {
              value: text(videoRow?.video_reviews_stat_1_value, DEFAULT_CONTENT_SOURCE.videoReviews.stats[0]?.value ?? ''),
              text: text(videoRow?.video_reviews_stat_1_text, DEFAULT_CONTENT_SOURCE.videoReviews.stats[0]?.text ?? ''),
            },
            {
              value: text(videoRow?.video_reviews_stat_2_value, DEFAULT_CONTENT_SOURCE.videoReviews.stats[1]?.value ?? ''),
              text: text(videoRow?.video_reviews_stat_2_text, DEFAULT_CONTENT_SOURCE.videoReviews.stats[1]?.text ?? ''),
            },
            {
              value: text(videoRow?.video_reviews_stat_3_value, DEFAULT_CONTENT_SOURCE.videoReviews.stats[2]?.value ?? ''),
              text: text(videoRow?.video_reviews_stat_3_text, DEFAULT_CONTENT_SOURCE.videoReviews.stats[2]?.text ?? ''),
            },
          ],
          videos: videoItems,
        };

        const siteRow = siteSettingsRows[0];
        const siteSettings: SiteSettings = {
          designInfoText: text(siteRow?.design_info_text),
          featureMagneticText: text(siteRow?.feature_magnetic_text),
          featureMaterialFlag: text(siteRow?.feature_material_flag),
          featureMaterialText: text(siteRow?.feature_material_text),
          richSignoff: text(siteRow?.rich_signoff),
          mediaPlaceholder: r2Url(siteRow?.media_placeholder_url)
            || DEFAULT_CONTENT_SOURCE.siteSettings.mediaPlaceholder,
          siteFlag: r2Url(siteRow?.site_flag_url)
            || DEFAULT_CONTENT_SOURCE.siteSettings.siteFlag,
        };

        return {
          galleryImages: gallery,
          contentSets: sets,
          contentSections: sections,
          faqItems: faqs,
          logoSettings: logo,
          richSections: rich,
          richSectionImages: richImages,
          magneticSystemMedia,
          richContentVideos,
          fixationVideo,
          benefitModals: benefits,
          reviews,
          videoReviews,
          siteSettings,
          homepage: homepageSettingsRows[0] ? mapHomepageRow(homepageSettingsRows[0]) : DEFAULT_HOMEPAGE,
          about: aboutSettingsRows[0] ? mapAboutRow(aboutSettingsRows[0]) : DEFAULT_ABOUT,
          carMat: carMatSettingsRows[0] ? mapCarMatRow(carMatSettingsRows[0]) : {
            designs: DEFAULT_CAR_MAT_DESIGNS,
            promoMedia: DEFAULT_CAR_MAT_PROMO_MEDIA,
            modalTitle: '',
            modalDescription: '',
          },
        };
      } catch (error) {
        if (error instanceof EditorialUnavailableError) throw error;
        throw new EditorialUnavailableError(
          error instanceof Error ? error.message : 'Supabase editorial unavailable',
        );
      }
    },
  };
}
