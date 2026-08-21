import 'server-only';
import { cache } from 'react';
import { DEFAULT_CONTENT_SOURCE } from './default-source';
import type {
  BenefitModalData,
  ContentSource,
  SizeContentGroup,
  SizeId,
  ReviewsData,
} from './types';

type RecordValue = Record<string, unknown>;

function getDirectusUrl() {
  return process.env.DIRECTUS_URL?.replace(/\/$/, '') || null;
}

function getDirectusToken() {
  return process.env.DIRECTUS_READ_TOKEN?.trim() || null;
}

function directusHeaders() {
  const token = getDirectusToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function relationValue(value: unknown, field: string): string | null {
  if (!value) return null;
  if (typeof value === 'object') {
    const record = value as RecordValue;
    const nested = record[field];
    return typeof nested === 'string' ? nested : null;
  }
  return typeof value === 'string' ? value : null;
}

function assetUrl(file: unknown, fallback = '') {
  const directusUrl = getDirectusUrl();
  if (!directusUrl || !file) return fallback;
  const id = typeof file === 'string' ? file : (file as RecordValue).id;
  if (typeof id !== 'string') return fallback;
  return getDirectusToken()
    ? `/api/directus-assets/${encodeURIComponent(id)}`
    : `${directusUrl}/assets/${id}`;
}

function externalImageUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

async function readCollection(name: string, fields = '*'): Promise<RecordValue[]> {
  const directusUrl = getDirectusUrl();
  if (!directusUrl) throw new Error('DIRECTUS_URL is not configured');
  const query = new URLSearchParams({
    limit: '-1',
    fields,
    'filter[status][_eq]': 'published',
  });
  const response = await fetch(`${directusUrl}/items/${name}?${query}`, {
    headers: directusHeaders(),
    next: { revalidate: 60 },
  });
  if (!response.ok) throw new Error(`${name}: ${response.status} ${response.statusText}`);
  const payload = await response.json() as { data: RecordValue | RecordValue[] };
  return Array.isArray(payload.data) ? payload.data : [payload.data];
}

function number(value: unknown, fallback = 0) {
  return typeof value === 'number' ? value : Number(value ?? fallback);
}

function string(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function boolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function mergeByKey<T>(fallback: T[], remote: T[], key: (item: T) => string) {
  const remoteKeys = new Set(remote.map(key));
  return [...remote, ...fallback.filter(item => !remoteKeys.has(key(item)))];
}

function parseReviewItems(raw: unknown): ContentSource['reviews']['items'] {
  if (!Array.isArray(raw)) return DEFAULT_CONTENT_SOURCE.reviews.items;
  const items = raw.map((item, index) => ({
    key: string(item.key) || `review-${index}`,
    reviewText: string(item.reviewText || item.review_text),
    customerName: string(item.customerName || item.customer_name),
    reviewDate: string(item.reviewDate || item.review_date),
    rating: number(item.rating, 5),
    sort: number(item.sort, index + 1),
  })).filter(item => item.reviewText);
  return items.length > 0 ? items : DEFAULT_CONTENT_SOURCE.reviews.items;
}

function parseReviewScreenshots(raw: unknown): ContentSource['reviews']['screenshots'] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => ({
    key: string(item.key) || `screenshot-${index}`,
    image: typeof item.image === 'string'
      ? (item.image.startsWith('http') || item.image.startsWith('/api/')
        ? item.image
        : assetUrl(item.image))
      : assetUrl(item.image),
    altText: string(item.altText || item.alt_text),
    sort: number(item.sort, index + 1),
  })).filter(item => item.image);
}

async function loadDirectusSource(): Promise<ContentSource> {
  const [
    designs, sizes, brands, brandPricing, sizeShipping, fixations, variants, galleryImages, contentSets,
    contentSections, faqItems, logoSettings, logoPlacements, richSections, richSectionImages,
    benefitModals, discountTiers, siteSettings, mediaSettings,
  ] = await Promise.all([
    readCollection('carzo_designs', '*,selector_image.id'),
    readCollection('carzo_sizes'),
    readCollection('carzo_brands', '*,logo_image.id'),
    readCollection('carzo_brand_pricing', '*,brand.slug'),
    readCollection('carzo_size_shipping', '*,size.code'),
    readCollection('carzo_fixations'),
    readCollection('carzo_variants', '*,design.slug,size.code'),
    readCollection('carzo_gallery_images', '*,design.slug,size.code,image.id'),
    readCollection('carzo_content_sets', '*,design.slug,size.code'),
    readCollection('carzo_content_sections', '*,content_set.key,image.id'),
    readCollection('carzo_faq_items'),
    readCollection('carzo_logo_settings', '*,fallback_image.id'),
    readCollection('carzo_logo_placements', '*,design.slug,size.code,image.id'),
    readCollection('carzo_rich_sections'),
    readCollection('carzo_rich_section_images', '*,design.slug,section.key,image.id'),
    readCollection('carzo_benefit_modals'),
    readCollection('carzo_discount_tiers'),
    readCollection('carzo_site_settings'),
    readCollection('carzo_media_settings', '*,image.id'),
  ]);

  const brandPricingBySlug = new Map(
    brandPricing.map(item => [relationValue(item.brand, 'slug'), item]),
  );
  const sizeShippingByCode = new Map(
    sizeShipping.map(item => [relationValue(item.size, 'code'), item]),
  );
  const mediaPlaceholder = mediaSettings[0]
    ? assetUrl(
        mediaSettings[0].image,
        externalImageUrl(mediaSettings[0].external_url),
      ) || DEFAULT_CONTENT_SOURCE.siteSettings.mediaPlaceholder
    : DEFAULT_CONTENT_SOURCE.siteSettings.mediaPlaceholder;

  const remote: ContentSource = {
    origin: 'directus',
    designs: designs.map(item => ({
      slug: string(item.slug), version: string(item.version), label: string(item.label),
      selectorImage: assetUrl(item.selector_image, '/Без_имени-1.jpg'), sort: number(item.sort),
    })),
    sizes: sizes.map(item => {
      const shipping = sizeShippingByCode.get(string(item.code));
      const shippingValues = [
        shipping?.length_cm, shipping?.width_cm, shipping?.height_cm, shipping?.weight_kg,
      ];
      return {
        id: string(item.code) as SizeId,
        slug: string(item.slug), label: string(item.label),
        widthCm: number(item.width_cm), heightCm: number(item.height_cm), depthCm: number(item.depth_cm),
        contentGroup: string(item.content_group) as SizeContentGroup,
        shippingProfile: shippingValues.every(value => value !== null && value !== undefined)
          ? {
              lengthCm: number(shipping?.length_cm), widthCm: number(shipping?.width_cm),
              heightCm: number(shipping?.height_cm), weightKg: number(shipping?.weight_kg),
            }
          : null,
        sort: number(item.sort),
      };
    }),
    brands: brands.map(item => ({
      id: string(item.slug), name: item.name === null ? null : string(item.name), flag: string(item.flag),
      price: number(brandPricingBySlug.get(string(item.slug))?.logo_extra),
      logoImage: assetUrl(item.logo_image), sort: number(item.sort),
    })),
    fixations: fixations.map(item => ({
      value: string(item.key), label: string(item.label), extra: number(item.extra), sort: number(item.sort),
    })),
    variants: variants.map(item => ({
      key: string(item.key), designSlug: relationValue(item.design, 'slug') || '',
      size: relationValue(item.size, 'code') as SizeId,
      price: number(item.price), oldPrice: number(item.old_price), inStock: boolean(item.in_stock),
      quantityDiscountEligible: boolean(item.quantity_discount_eligible),
    })),
    galleryImages: galleryImages.map(item => ({
      key: string(item.key), designSlug: relationValue(item.design, 'slug'),
      size: relationValue(item.size, 'code') as SizeId | null,
      src: assetUrl(item.image, externalImageUrl(item.external_url)), alt: string(item.alt), sort: number(item.sort),
      fallbackSrc: mediaPlaceholder, isPlaceholder: false,
    })),
    contentSets: contentSets.map(item => ({
      key: string(item.key), kind: string(item.kind) as 'inside' | 'fixation',
      designSlug: relationValue(item.design, 'slug'), size: relationValue(item.size, 'code') as SizeId | null,
      sizeGroup: (item.size_group ? string(item.size_group) : null) as SizeContentGroup | null,
      title: string(item.title), contentTabLabel: string(item.content_tab_label),
      faqTabLabel: string(item.faq_tab_label), infoBox: string(item.info_box),
    })),
    contentSections: contentSections.map(item => ({
      key: string(item.key), contentSetKey: relationValue(item.content_set, 'key') || '',
      title: string(item.title), text: string(item.text),
      image: assetUrl(item.image, string(item.external_url)) || undefined,
      imagePlaceholder: string(item.image_placeholder) || undefined, sort: number(item.sort),
    })),
    faqItems: faqItems.map(item => ({
      key: string(item.key), group: string(item.faq_group) as 'inside' | 'fixation' | 'logo',
      question: string(item.question), answer: string(item.answer), sort: number(item.sort),
    })),
    logoSettings: logoSettings[0]
      ? {
          title: string(logoSettings[0].title), infoText: string(logoSettings[0].info_text),
          fallbackImage: assetUrl(logoSettings[0].fallback_image, '/Без_имени-1.jpg'),
          specs: Array.isArray(logoSettings[0].specs) ? logoSettings[0].specs as ContentSource['logoSettings']['specs'] : [],
        }
      : DEFAULT_CONTENT_SOURCE.logoSettings,
    logoPlacements: logoPlacements.map(item => ({
      key: string(item.key), designSlug: relationValue(item.design, 'slug'),
      size: relationValue(item.size, 'code') as SizeId | null,
      image: assetUrl(item.image, string(item.external_url)), sort: number(item.sort),
    })),
    richSections: richSections.map(item => ({
      key: string(item.key), title: string(item.title),
      subtitle: string(item.subtitle), description: string(item.description),
      additionalInfo: item.additional_title && item.additional_text
        ? {
            title: string(item.additional_title), text: string(item.additional_text),
            list: Array.isArray(item.additional_list) ? item.additional_list as string[] : undefined,
          }
        : undefined,
      sort: number(item.sort),
    })),
    richSectionImages: richSectionImages.map(item => ({
      key: string(item.key),
      designSlug: relationValue(item.design, 'slug') || '',
      sectionKey: relationValue(item.section, 'key') || '',
      src: assetUrl(item.image, externalImageUrl(item.external_url)),
      alt: string(item.alt),
    })).filter(item => item.designSlug && item.sectionKey && item.src),
    benefitModals: benefitModals.map(item => ({
      type: string(item.key), cardLabel: string(item.card_label), title: string(item.title),
      subtitle: string(item.subtitle),
      blocks: (item.content as { blocks?: BenefitModalData['blocks'] } | null)?.blocks ?? [],
    })) as BenefitModalData[],
    discountTiers: discountTiers.map(item => ({
      key: string(item.key), minQuantity: number(item.min_quantity), amount: number(item.amount), sort: number(item.sort),
    })),
    reviews: {
      settings: siteSettings[0]
        ? {
            enabled: boolean(siteSettings[0].reviews_enabled, true),
            title: string(siteSettings[0].reviews_title),
            descriptionLine1: string(siteSettings[0].reviews_description_line_1),
            descriptionLine2: string(siteSettings[0].reviews_description_line_2),
            instagramHandle: string(siteSettings[0].reviews_instagram_handle),
            ctaLabel: string(siteSettings[0].reviews_cta_label),
            modalTitle: string(siteSettings[0].reviews_modal_title),
            modalDescription: string(siteSettings[0].reviews_modal_description),
          }
        : DEFAULT_CONTENT_SOURCE.reviews.settings,
      items: parseReviewItems(siteSettings[0]?.reviews_items),
      screenshots: parseReviewScreenshots(siteSettings[0]?.reviews_screenshots),
    },
    siteSettings: siteSettings[0]
      ? {
          designInfoText: string(siteSettings[0].design_info_text),
          featureMagneticText: string(siteSettings[0].feature_magnetic_text),
          featureMaterialFlag: string(siteSettings[0].feature_material_flag),
          featureMaterialText: string(siteSettings[0].feature_material_text),
          richSignoff: string(siteSettings[0].rich_signoff),
          mediaPlaceholder,
        }
      : DEFAULT_CONTENT_SOURCE.siteSettings,
  };

  return {
    ...remote,
    designs: mergeByKey(DEFAULT_CONTENT_SOURCE.designs, remote.designs, item => item.slug),
    sizes: mergeByKey(DEFAULT_CONTENT_SOURCE.sizes, remote.sizes, item => item.id),
    brands: mergeByKey(DEFAULT_CONTENT_SOURCE.brands, remote.brands, item => item.id),
    fixations: mergeByKey(DEFAULT_CONTENT_SOURCE.fixations, remote.fixations, item => item.value),
    variants: mergeByKey(DEFAULT_CONTENT_SOURCE.variants, remote.variants, item => item.key),
    galleryImages: remote.galleryImages.filter(item => item.src),
    contentSets: mergeByKey(DEFAULT_CONTENT_SOURCE.contentSets, remote.contentSets, item => item.key),
    contentSections: mergeByKey(DEFAULT_CONTENT_SOURCE.contentSections, remote.contentSections, item => item.key),
    faqItems: mergeByKey(DEFAULT_CONTENT_SOURCE.faqItems, remote.faqItems, item => item.key),
    richSections: remote.richSections,
    richSectionImages: remote.richSectionImages,
    benefitModals: mergeByKey(DEFAULT_CONTENT_SOURCE.benefitModals, remote.benefitModals, item => item.type),
    discountTiers: mergeByKey(DEFAULT_CONTENT_SOURCE.discountTiers, remote.discountTiers, item => item.key),
    reviews: {
      settings: remote.reviews.settings,
      items: remote.reviews.items.length > 0
        ? remote.reviews.items
        : DEFAULT_CONTENT_SOURCE.reviews.items,
      screenshots: remote.reviews.screenshots,
    },
  };
}

export const getContentSource = cache(async (): Promise<ContentSource> => {
  if (!getDirectusUrl()) return DEFAULT_CONTENT_SOURCE;
  try {
    return await loadDirectusSource();
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[carzo-content] Directus is unavailable; using local fallback.', error);
    }
    return DEFAULT_CONTENT_SOURCE;
  }
});
