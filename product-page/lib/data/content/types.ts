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
  VideoReviewsData,
} from '@/lib/content/types';
import type { AboutData, CarMatContent, HomepageData } from '@/lib/content/settings-defaults';

/**
 * Editorial portion of ContentSource (CONTENT_STORE).
 * Commerce/catalog is owned separately by CATALOG_STORE.
 */
export interface EditorialContent {
  galleryImages: GalleryImage[];
  contentSets: ContentSet[];
  contentSections: ContentSection[];
  faqItems: FaqItem[];
  logoSettings: LogoSettings;
  richSections: RichContentSection[];
  richSectionImages: RichContentSectionImage[];
  magneticSystemMedia: MagneticSystemMedia;
  richContentVideos: Record<string, string>;
  fixationVideo: string;
  benefitModals: BenefitModalData[];
  reviews: ReviewsData;
  videoReviews: VideoReviewsData;
  siteSettings: SiteSettings;
  /** Typed homepage/about/car-mat settings rows (filled by the Supabase adapter). */
  homepage?: HomepageData;
  about?: AboutData;
  carMat?: CarMatContent;
}

export interface ContentRepository {
  /** Editorial-only load. Must not supply pricing/stock/variants. */
  loadEditorial(): Promise<EditorialContent>;
}
