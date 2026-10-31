import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { DEFAULT_CONTENT_SOURCE } from '@/lib/content/default-source';
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

async function selectRows(table: string, columns: string): Promise<SupabaseRow[]> {
  const { data, error } = await getSupabaseAdminClient().from(table).select(columns);
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
          selectRows('gallery_images', 'key,design_slug,size,src,alt,sort'),
          selectRows('content_sets', 'key,kind,design_slug,size,size_group,title,content_tab_label,faq_tab_label,info_box'),
          selectRows('content_sections', 'key,content_set_key,title,text,image_url,image_placeholder,sort'),
          selectRows('faq_items', 'key,faq_group,question,answer,sort'),
          selectRows('rich_sections', 'key,title,subtitle,description,additional_title,additional_text,additional_list,sort'),
          selectRows('rich_section_images', 'key,design_slug,section_key,src,alt'),
          selectRows('benefit_modals', 'key,card_label,title,subtitle,sort,content'),
          selectRows('logo_settings', 'title,info_text,fallback_image_url,logo_placement_video_url,specs'),
          selectRows('product_media', 'slot,url'),
          selectRows('site_settings', 'design_info_text,feature_magnetic_text,feature_material_flag,feature_material_text,rich_signoff,media_placeholder_url,site_flag_url,checkout_payment_details'),
          selectRows('homepage_settings', 'hero_eyebrow,hero_title,hero_lead,hero_material_tag,hero_products,logo_video_url,badges_eyebrow,badges_title,badges_description,badges_video_url,badges_size_label,badges_features,quality_eyebrow,quality_title,quality_stats'),
          selectRows('about_settings', '*'),
          selectRows('review_settings', 'enabled,title,description_line_1,description_line_2,instagram_handle,cta_label,modal_title,modal_description,items,screenshots'),
          selectRows('video_review_settings', 'enabled,title,social_badge_url,social_handle,social_verified,social_text,stat_1_value,stat_1_text,stat_2_value,stat_2_text,stat_3_value,stat_3_text,items'),
          selectRows('car_mat_settings', '*'),
        ]);

        void homepageSettingsRows;
        void aboutSettingsRows;
        void carMatSettingsRows;

        const mediaBySlot = new Map<string, string>();
        for (const row of productMediaRows) {
          const slot = text(row.slot);
          const url = r2Url(row.url);
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
          designSlug: text(row.design_slug) || null,
          size: (text(row.size) || null) as SizeId | null,
          src: r2Url(row.src),
          alt: text(row.alt),
          sort: number(row.sort, index + 1),
          fallbackSrc: '',
          isPlaceholder: false,
        })).filter(item => item.src);

        const sets: ContentSet[] = contentSets.map(row => ({
          key: text(row.key),
          kind: text(row.kind) as 'inside' | 'fixation',
          designSlug: text(row.design_slug) || null,
          size: (text(row.size) || null) as SizeId | null,
          sizeGroup: (text(row.size_group) || null) as SizeContentGroup | null,
          title: text(row.title),
          contentTabLabel: text(row.content_tab_label),
          faqTabLabel: text(row.faq_tab_label),
          infoBox: text(row.info_box),
        }));

        const sections: ContentSection[] = contentSections.map(row => ({
          key: text(row.key),
          contentSetKey: text(row.content_set_key),
          title: text(row.title),
          text: text(row.text),
          image: r2Url(row.image_url) || undefined,
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
              placementVideo: r2Url(logoRow.logo_placement_video_url),
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
          designSlug: text(row.design_slug),
          sectionKey: text(row.section_key),
          src: r2Url(row.src),
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
                enabled: bool(reviewRow.enabled, true),
                title: text(reviewRow.title),
                descriptionLine1: text(reviewRow.description_line_1),
                descriptionLine2: text(reviewRow.description_line_2),
                instagramHandle: text(reviewRow.instagram_handle),
                ctaLabel: text(reviewRow.cta_label),
                modalTitle: text(reviewRow.modal_title),
                modalDescription: text(reviewRow.modal_description),
              }
            : DEFAULT_CONTENT_SOURCE.reviews.settings,
          items: parseReviewItems(reviewRow?.items),
          screenshots: parseReviewScreenshots(reviewRow?.screenshots),
        };

        const videoRow = videoReviewSettingsRows[0];
        const videoItems: VideoReviewItem[] = Array.isArray(videoRow?.items)
          ? (videoRow.items as SupabaseRow[]).map((item, index) => ({
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
          enabled: videoRow?.enabled === undefined
            ? DEFAULT_CONTENT_SOURCE.videoReviews.enabled
            : bool(videoRow.enabled, true),
          title: text(videoRow?.title, DEFAULT_CONTENT_SOURCE.videoReviews.title),
          socialBadgeUrl: r2Url(videoRow?.social_badge_url) || DEFAULT_CONTENT_SOURCE.videoReviews.socialBadgeUrl,
          socialHandle: text(videoRow?.social_handle, DEFAULT_CONTENT_SOURCE.videoReviews.socialHandle),
          socialVerified: videoRow?.social_verified === undefined
            ? DEFAULT_CONTENT_SOURCE.videoReviews.socialVerified
            : bool(videoRow.social_verified, true),
          socialText: text(videoRow?.social_text, DEFAULT_CONTENT_SOURCE.videoReviews.socialText),
          stats: [
            {
              value: text(videoRow?.stat_1_value, DEFAULT_CONTENT_SOURCE.videoReviews.stats[0]?.value ?? ''),
              text: text(videoRow?.stat_1_text, DEFAULT_CONTENT_SOURCE.videoReviews.stats[0]?.text ?? ''),
            },
            {
              value: text(videoRow?.stat_2_value, DEFAULT_CONTENT_SOURCE.videoReviews.stats[1]?.value ?? ''),
              text: text(videoRow?.stat_2_text, DEFAULT_CONTENT_SOURCE.videoReviews.stats[1]?.text ?? ''),
            },
            {
              value: text(videoRow?.stat_3_value, DEFAULT_CONTENT_SOURCE.videoReviews.stats[2]?.value ?? ''),
              text: text(videoRow?.stat_3_text, DEFAULT_CONTENT_SOURCE.videoReviews.stats[2]?.text ?? ''),
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


