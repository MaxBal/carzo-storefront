import seedJson from '@/content/carzo-content.seed.json';
import type {
  BenefitModalData,
  ContentSource,
  SizeContentGroup,
  SizeId,
} from './types';

type Seed = typeof seedJson;
const seed = seedJson as Seed;

export const DEFAULT_CONTENT_SOURCE: ContentSource = {
  origin: 'fallback',
  designs: seed.designs.map(item => ({
    slug: item.slug,
    version: item.version,
    label: item.label,
    selectorImage: '/Без_имени-1.jpg',
    sort: item.sort,
  })),
  sizes: seed.sizes.map(item => ({
    id: item.code as SizeId,
    slug: item.slug,
    label: item.label,
    widthCm: item.widthCm,
    heightCm: item.heightCm,
    depthCm: item.depthCm,
    contentGroup: item.contentGroup as SizeContentGroup,
    shippingProfile: null,
    sort: item.sort,
  })),
  brands: seed.brands.map(item => ({
    id: item.slug,
    name: item.name,
    flag: item.flag,
    price: item.logoExtra,
    logoImage: '',
    sort: item.sort,
  })),
  fixations: seed.fixations.map(item => ({
    value: item.key,
    label: item.label,
    extra: item.extra,
    sort: item.sort,
  })),
  variants: seed.variants.map(item => ({
    key: item.key,
    designSlug: item.design,
    size: item.size as SizeId,
    price: item.price,
    oldPrice: item.oldPrice,
    inStock: item.inStock,
    quantityDiscountEligible: item.quantityDiscountEligible,
  })),
  galleryImages: [],
  contentSets: seed.contentSets.map(item => ({
    key: item.key,
    kind: item.kind as 'inside' | 'fixation',
    designSlug: item.design,
    size: item.size as SizeId | null,
    sizeGroup: item.sizeGroup as SizeContentGroup | null,
    title: item.title,
    contentTabLabel: item.contentTabLabel,
    faqTabLabel: item.faqTabLabel,
    infoBox: item.infoBox,
  })),
  contentSections: seed.contentSections.map(item => ({
    key: item.key,
    contentSetKey: item.contentSet,
    title: item.title,
    text: item.text,
    imagePlaceholder: item.imagePlaceholder,
    sort: item.sort,
  })),
  faqItems: seed.faqItems.map(item => ({
    key: item.key,
    group: item.group as 'inside' | 'fixation' | 'logo',
    question: item.question,
    answer: item.answer,
    sort: item.sort,
  })),
  logoSettings: {
    title: seed.logoSettings.title,
    infoText: seed.logoSettings.infoText,
    fallbackImage: seed.logoSettings.fallbackImagePath,
    specs: seed.logoSettings.specs,
  },
  logoPlacements: [],
  richSections: seed.richSections.map(item => ({
    key: item.key,
    title: item.title,
    subtitle: item.subtitle,
    description: item.description,
    additionalInfo: item.additionalTitle && item.additionalText
      ? {
          title: item.additionalTitle,
          text: item.additionalText,
          list: item.additionalList.length > 0 ? item.additionalList : undefined,
        }
      : undefined,
    sort: item.sort,
  })),
  richSectionImages: seed.richSections.flatMap(item => ['2-0', '3-0'].map(designSlug => ({
    key: `${designSlug}:${item.key}`,
    designSlug,
    sectionKey: item.key,
    src: item.imagePath,
    alt: `${item.title} — Carzo ${designSlug.replace('-', '.')}`,
  }))),
  benefitModals: seed.benefitModals.map((item, index) => ({
    type: item.key,
    cardLabel: item.cardLabel,
    title: item.title,
    subtitle: item.subtitle,
    blocks: item.content.blocks,
  })) as BenefitModalData[],
  discountTiers: seed.discountTiers.map(item => ({
    key: item.key,
    minQuantity: item.minQuantity,
    amount: item.amount,
    sort: item.sort,
  })),
  siteSettings: {
    designInfoText: seed.siteSettings.designInfoText,
    featureMagneticText: seed.siteSettings.featureMagneticText,
    featureMaterialFlag: seed.siteSettings.featureMaterialFlag,
    featureMaterialText: seed.siteSettings.featureMaterialText,
    richSignoff: seed.siteSettings.richSignoff,
    mediaPlaceholder: '/media/landscape-placeholder.svg',
  },
};
