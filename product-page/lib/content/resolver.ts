import { DEFAULT_CONTENT_SOURCE } from './default-source';
import type {
  BenefitModalData,
  BenefitModalType,
  ContentSet,
  ContentSource,
  GalleryImage,
  InfoModalData,
  ProductCatalog,
  ProductParams,
  ProductVariant,
  ResolvedProductContent,
  ResolvedRichContentSection,
  SizeId,
} from './types';

function warnFallback(kind: string, requestedKey: string, fallbackKey: string) {
  if (process.env.NODE_ENV === 'production') return;
  console.warn(`[carzo-content] Missing ${kind} for "${requestedKey}"; using fallback "${fallbackKey}".`);
}

function sorted<T extends { sort: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sort - b.sort);
}

function interpolateSize(value: string, size: SizeId) {
  return value.replaceAll('{size}', size);
}

function resolveGallery(params: ProductParams, source: ContentSource): GalleryImage[] {
  const exact = source.galleryImages.filter(item => item.designSlug === params.designSlug && item.size === params.size);
  const design = source.designs.find(item => item.slug === params.designSlug);
  if (exact.length > 0) {
    return sorted(exact).map((item, index) => ({
      ...item,
      alt: item.alt.trim() || `Автокейс ${params.size} Carzo ${design?.version ?? params.designSlug} — фото ${index + 1}`,
      fallbackSrc: source.siteSettings.mediaPlaceholder,
      isPlaceholder: false,
    }));
  }

  warnFallback('gallery', `${params.designSlug}:${params.size}`, 'media placeholder');
  return [{
    key: `gallery-placeholder:${params.designSlug}:${params.size}`,
    designSlug: params.designSlug,
    size: params.size,
    src: source.siteSettings.mediaPlaceholder,
    fallbackSrc: source.siteSettings.mediaPlaceholder,
    alt: `Автокейс ${params.size} Carzo ${design?.version ?? params.designSlug}`,
    sort: 1,
    isPlaceholder: true,
  }];
}

function contentSetSections(contentSet: ContentSet, source: ContentSource) {
  return sorted(source.contentSections.filter(section => section.contentSetKey === contentSet.key));
}

function faqs(group: 'inside' | 'fixation' | 'logo', source: ContentSource) {
  return sorted(source.faqItems.filter(item => item.group === group));
}

function toModal(contentSet: ContentSet, size: SizeId, faqGroup: 'inside' | 'fixation', source: ContentSource): InfoModalData {
  return {
    title: interpolateSize(contentSet.title, size),
    tabs: [
      {
        label: interpolateSize(contentSet.contentTabLabel, size),
        sections: contentSetSections(contentSet, source),
      },
      {
        label: contentSet.faqTabLabel,
        infoBox: contentSet.infoBox,
        faqs: faqs(faqGroup, source),
      },
    ],
  };
}

function resolveInsideModal(params: ProductParams, source: ContentSource) {
  const size = source.sizes.find(item => item.id === params.size);
  const requestedGroup = size?.contentGroup ?? 'M';
  const exact = source.contentSets.find(item => item.kind === 'inside' && item.sizeGroup === requestedGroup);
  if (exact) return toModal(exact, params.size, 'inside', source);

  const fallback = source.contentSets.find(item => item.kind === 'inside' && item.sizeGroup === 'M')
    ?? DEFAULT_CONTENT_SOURCE.contentSets.find(item => item.kind === 'inside')!;
  warnFallback('inside modal', requestedGroup, fallback.sizeGroup ?? fallback.key);
  return toModal(fallback, params.size, 'inside', source);
}

function matrixSet(kind: 'fixation', params: ProductParams, source: ContentSource) {
  const candidates = source.contentSets.filter(item => item.kind === kind);
  const exact = candidates.find(item => item.designSlug === params.designSlug && item.size === params.size);
  if (exact) return exact;
  const designFallback = candidates.find(item => item.designSlug === params.designSlug && item.size === null);
  if (designFallback) return designFallback;
  const sizeFallback = candidates.find(item => item.designSlug === null && item.size === params.size);
  if (sizeFallback) return sizeFallback;
  return candidates.find(item => item.designSlug === null && item.size === null);
}

function resolveFixationModal(params: ProductParams, source: ContentSource) {
  const resolved = matrixSet('fixation', params, source)
    ?? DEFAULT_CONTENT_SOURCE.contentSets.find(item => item.kind === 'fixation')!;
  if (resolved.designSlug !== params.designSlug || resolved.size !== params.size) {
    warnFallback('fixation modal', `${params.designSlug}:${params.size}`, resolved.key);
  }
  return toModal(resolved, params.size, 'fixation', source);
}

function resolvePlacement(params: ProductParams, source: ContentSource) {
  const exact = source.logoPlacements.find(item => item.designSlug === params.designSlug && item.size === params.size);
  if (exact) return exact.image;
  const designFallback = source.logoPlacements.find(item => item.designSlug === params.designSlug && item.size === null);
  if (designFallback) return designFallback.image;
  const globalFallback = source.logoPlacements.find(item => item.designSlug === null && item.size === null);
  warnFallback('logo placement', `${params.designSlug}:${params.size}`, globalFallback?.key ?? 'logo fallback image');
  return globalFallback?.image || source.logoSettings.fallbackImage;
}

function resolveRichContent(params: ProductParams, source: ContentSource): ResolvedRichContentSection[] {
  const design = source.designs.find(item => item.slug === params.designSlug);
  const templates = sorted(
    source.origin === 'directus'
      ? source.richSections
      : (source.richSections.length > 0 ? source.richSections : DEFAULT_CONTENT_SOURCE.richSections),
  );
  return templates.map(section => {
    const media = source.richSectionImages.find(item => (
      item.designSlug === params.designSlug && item.sectionKey === section.key
    ));
    return {
      ...section,
      image: media?.src || source.siteSettings.mediaPlaceholder,
      imageAlt: media?.alt.trim() || `${section.title} — Carzo ${design?.version ?? params.designSlug}`,
      fallbackSrc: source.siteSettings.mediaPlaceholder,
      isPlaceholder: !media?.src,
    };
  });
}

function resolveMagneticSystemMedia(
  params: ProductParams,
  source: ContentSource,
  sections: ResolvedRichContentSection[],
): ResolvedProductContent['richContent']['magneticSystemMedia'] {
  const exactPoster = source.magneticSystemMedia.posters[`${params.designSlug}:${params.size}`];
  const existingSectionPoster = sections.find(section => section.key === 'rich-magnets')?.image;
  const poster = exactPoster
    || source.magneticSystemMedia.defaultPoster
    || existingSectionPoster
    || source.siteSettings.mediaPlaceholder;

  return {
    video: source.magneticSystemMedia.video,
    poster,
    fallbackPoster: source.siteSettings.mediaPlaceholder,
    isPosterPlaceholder: poster === source.siteSettings.mediaPlaceholder,
  };
}

function fallbackVariant(designSlug: string, size: SizeId): ProductVariant {
  return DEFAULT_CONTENT_SOURCE.variants.find(item => item.designSlug === designSlug && item.size === size)
    ?? DEFAULT_CONTENT_SOURCE.variants.find(item => item.size === size)!;
}

function resolvePricing(params: ProductParams, source: ContentSource) {
  const selectedVariant = source.variants.find(item => item.designSlug === params.designSlug && item.size === params.size)
    ?? fallbackVariant(params.designSlug, params.size);

  const sizePrices = Object.fromEntries(source.sizes.map(size => {
    const variant = source.variants.find(item => item.designSlug === params.designSlug && item.size === size.id)
      ?? fallbackVariant(params.designSlug, size.id);
    return [size.id, { price: variant.price, oldPrice: variant.oldPrice, inStock: variant.inStock }];
  })) as ResolvedProductContent['pricing']['sizePrices'];

  return { selectedVariant, sizePrices };
}

export function getProductCatalog(source: ContentSource = DEFAULT_CONTENT_SOURCE): ProductCatalog {
  return {
    designs: sorted(source.designs),
    sizes: sorted(source.sizes),
    brands: sorted(source.brands),
    fixations: sorted(source.fixations),
  };
}

export function getBenefitModalContent(type: BenefitModalType, source: ContentSource = DEFAULT_CONTENT_SOURCE): BenefitModalData {
  return source.benefitModals.find(item => item.type === type)
    ?? DEFAULT_CONTENT_SOURCE.benefitModals.find(item => item.type === type)!;
}

export function resolveProductContent(
  params: ProductParams,
  source: ContentSource = DEFAULT_CONTENT_SOURCE,
): ResolvedProductContent {
  const selectedBrand = source.brands.find(item => item.id === params.brandId)
    ?? DEFAULT_CONTENT_SOURCE.brands.find(item => item.id === params.brandId)
    ?? DEFAULT_CONTENT_SOURCE.brands[0];
  const brandImage = selectedBrand.logoImage || source.logoSettings.fallbackImage;
  if (selectedBrand.id !== 'none' && !selectedBrand.logoImage) {
    warnFallback('brand logo', selectedBrand.id, 'logo fallback image');
  }

  const richSections = resolveRichContent(params, source);

  return {
    catalog: getProductCatalog(source),
    gallery: resolveGallery(params, source),
    insideModal: resolveInsideModal(params, source),
    fixationModal: resolveFixationModal(params, source),
    logoModal: {
      title: source.logoSettings.title,
      brandName: selectedBrand.name ?? '',
      infoText: source.logoSettings.infoText,
      logoImage: brandImage,
      placementImage: resolvePlacement(params, source),
      specs: source.logoSettings.specs,
      faqs: faqs('logo', source),
    },
    richContent: {
      sections: richSections,
      signoff: source.siteSettings.richSignoff,
      magneticSystemMedia: resolveMagneticSystemMedia(params, source, richSections),
    },
    benefitModals: source.benefitModals,
    discountTiers: sorted(source.discountTiers),
    reviews: source.reviews,
    pricing: resolvePricing(params, source),
    siteSettings: source.siteSettings,
  };
}
