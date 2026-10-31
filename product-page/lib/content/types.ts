export type SizeId = 'S' | 'M' | 'L' | 'XL';
export type SizeContentGroup = 'S' | 'M' | 'LXL';
export type BenefitModalType = 'warranty' | 'payment' | 'delivery' | 'returns' | 'bundle' | 'loyalty';

export interface DesignInfo {
  slug: string;
  version: string;
  label: string;
  selectorImage: string;
  sort: number;
}

export interface ShippingProfile {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
}

export interface SizeInfo {
  id: SizeId;
  slug: string;
  label: string;
  widthCm: number;
  heightCm: number;
  depthCm: number;
  contentGroup: SizeContentGroup;
  shippingProfile: ShippingProfile | null;
  sort: number;
}

export interface BrandInfo {
  id: string;
  name: string | null;
  flag: string;
  price: number;
  logoImage: string;
  sort: number;
}

export interface FixationInfo {
  value: string;
  label: string;
  extra: number;
  /** Size-specific surcharge, e.g. both-fixation: s=60, m=80, l=100, xl=120. */
  extraBySize?: Partial<Record<SizeId, number>>;
  sort: number;
}

export interface ProductVariant {
  key: string;
  designSlug: string;
  size: SizeId;
  price: number;
  oldPrice: number;
  inStock: boolean;
  quantityDiscountEligible: boolean;
}

export interface GalleryImage {
  key: string;
  designSlug: string | null;
  size: SizeId | null;
  src: string;
  alt: string;
  sort: number;
  fallbackSrc: string;
  isPlaceholder: boolean;
}

export interface FaqItem {
  key: string;
  group: 'inside' | 'fixation' | 'logo';
  question: string;
  answer: string;
  sort: number;
}

export interface ContentSection {
  key: string;
  contentSetKey: string;
  title: string;
  text: string;
  image?: string;
  imagePlaceholder?: string;
  sort: number;
}

export interface ContentSet {
  key: string;
  kind: 'inside' | 'fixation';
  designSlug: string | null;
  size: SizeId | null;
  sizeGroup: SizeContentGroup | null;
  title: string;
  contentTabLabel: string;
  faqTabLabel: string;
  infoBox: string;
}

export interface InfoModalTab {
  label: string;
  sections?: ContentSection[];
  infoBox?: string;
  faqs?: FaqItem[];
}

export interface InfoModalData {
  title: string;
  tabs: [InfoModalTab, InfoModalTab];
  globalVideo?: string;
}

export interface LogoSpec {
  label: string;
  value: string;
}

export interface LogoSettings {
  title: string;
  infoText: string;
  fallbackImage: string;
  placementVideo: string;
  specs: LogoSpec[];
}

export interface LogoPlacement {
  key: string;
  designSlug: string | null;
  size: SizeId | null;
  image: string;
  sort: number;
}

export interface LogoModalData {
  title: string;
  brandName: string;
  infoText: string;
  logoImage: string;
  placementImage: string;
  placementVideo: string;
  specs: LogoSpec[];
  faqs: FaqItem[];
}

export interface RichContentSection {
  key: string;
  title: string;
  subtitle: string;
  description: string;
  additionalInfo?: {
    title: string;
    text: string;
    list?: string[];
  };
  sort: number;
}

export interface RichContentSectionImage {
  key: string;
  designSlug: string;
  sectionKey: string;
  src: string;
  alt: string;
}

export interface ResolvedRichContentSection extends RichContentSection {
  image: string;
  imageAlt: string;
  fallbackSrc: string;
  isPlaceholder: boolean;
}

export interface MagneticSystemMedia {
  video: string;
  defaultPoster: string;
  posters: Record<string, string>;
}

export interface ResolvedMagneticSystemMedia {
  video: string;
  poster: string;
  fallbackPoster: string;
  isPosterPlaceholder: boolean;
}

export type BenefitIcon =
  | 'wallet'
  | 'shield'
  | 'percent'
  | 'rotate'
  | 'truck'
  | 'package'
  | 'package_check'
  | 'refresh'
  | 'calendar'
  | 'undo'
  | 'tag'
  | 'sparkles';

export interface BenefitTextLine {
  text: string;
  tone: 'body' | 'small' | 'accent';
  dividerBefore?: boolean;
}

export type BenefitBlock =
  | {
      type: 'info_card';
      icon: BenefitIcon;
      title: string;
      lines: BenefitTextLine[];
      highlight?: { title?: string; text: string };
    }
  | { type: 'badges'; items: string[] }
  | { type: 'discount_grid'; items: Array<{ label: string; value: string }> }
  | {
      type: 'calculation';
      rows: Array<{ label: string; value: string; muted: boolean }>;
      totalLabel: string;
      totalValue: string;
      note: string;
    }
  | { type: 'loyalty_hero'; value: string; label: string }
  | { type: 'steps'; items: string[] };

export interface BenefitModalData {
  type: BenefitModalType;
  cardLabel: string;
  title: string;
  subtitle: string;
  sort?: number;
  blocks: BenefitBlock[];
}

export interface DiscountTier {
  key: string;
  minQuantity: number;
  amount: number;
  sort: number;
}

export interface ReviewItem {
  key: string;
  reviewText: string;
  customerName: string;
  reviewDate: string;
  rating: number;
  sort: number;
}

export interface ReviewScreenshot {
  key: string;
  image: string;
  altText: string;
  sort: number;
}

export interface ReviewSettings {
  enabled: boolean;
  title: string;
  descriptionLine1: string;
  descriptionLine2: string;
  instagramHandle: string;
  ctaLabel: string;
  modalTitle: string;
  modalDescription: string;
}

export interface ReviewsData {
  settings: ReviewSettings;
  items: ReviewItem[];
  screenshots: ReviewScreenshot[];
}

export interface VideoReviewItem {
  id: string;
  title: string;
  videoUrl: string;
  coverUrl: string;
  sort: number;
  isActive: boolean;
}

export interface VideoReviewsData {
  enabled: boolean;
  title: string;
  socialBadgeUrl: string;
  socialHandle: string;
  socialVerified: boolean;
  socialText: string;
  stats: Array<{ value: string; text: string }>;
  videos: VideoReviewItem[];
}

export interface SiteSettings {
  designInfoText: string;
  featureMagneticText: string;
  featureMaterialFlag: string;
  featureMaterialText: string;
  richSignoff: string;
  mediaPlaceholder: string;
  siteFlag: string;
}

export interface ProductCatalog {
  designs: DesignInfo[];
  sizes: SizeInfo[];
  brands: BrandInfo[];
  fixations: FixationInfo[];
}

export interface ContentSource extends ProductCatalog {
  origin: 'fallback' | 'directus';
  variants: ProductVariant[];
  galleryImages: GalleryImage[];
  contentSets: ContentSet[];
  contentSections: ContentSection[];
  faqItems: FaqItem[];
  logoSettings: LogoSettings;
  logoPlacements: LogoPlacement[];
  richSections: RichContentSection[];
  richSectionImages: RichContentSectionImage[];
  magneticSystemMedia: MagneticSystemMedia;
  richContentVideos: Record<string, string>;
  fixationVideo: string;
  benefitModals: BenefitModalData[];
  discountTiers: DiscountTier[];
  reviews: ReviewsData;
  videoReviews: VideoReviewsData;
  siteSettings: SiteSettings;
}

export interface ProductParams {
  size: SizeId;
  designSlug: string;
  brandId: string;
}

export interface ResolvedPricing {
  selectedVariant: ProductVariant;
  sizePrices: Record<SizeId, Pick<ProductVariant, 'price' | 'oldPrice' | 'inStock'>>;
}

export interface ResolvedProductContent {
  catalog: ProductCatalog;
  gallery: GalleryImage[];
  /** design slug → thumbnail URL (gallery #1 for current size, else selector image) */
  designThumbnails: Record<string, string>;
  insideModal: InfoModalData;
  fixationModal: InfoModalData;
  logoModal: LogoModalData;
  richContent: {
    sections: ResolvedRichContentSection[];
    signoff: string;
    magneticSystemMedia: ResolvedMagneticSystemMedia;
    richContentVideos: Record<string, string>;
  };
  benefitModals: BenefitModalData[];
  discountTiers: DiscountTier[];
  reviews: ReviewsData;
  videoReviews: VideoReviewsData;
  pricing: ResolvedPricing;
  siteSettings: SiteSettings;
}
