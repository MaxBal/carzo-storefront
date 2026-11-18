import type {
  BrandInfo,
  DesignInfo,
  DiscountTier,
  FixationInfo,
  ProductVariant,
  SizeInfo,
} from '@/lib/content/types';

export type CatalogCacheMode = 'no-store' | 'revalidate';

export interface LoadCatalogOptions {
  /**
   * Cache policy for catalog reads:
   * - `'no-store'` (default): live uncached read for checkout and cart quotes.
   * - `'revalidate'`: bounded 60s ISR revalidation for public page rendering
   *   (automatically falls back to `'no-store'` in Draft Mode).
   */
  cache?: CatalogCacheMode;
}

export interface CatalogData {
  designs: DesignInfo[];
  sizes: SizeInfo[];
  brands: BrandInfo[];
  fixations: FixationInfo[];
  variants: ProductVariant[];
  discountTiers: DiscountTier[];
  /** Authoritative checkout payment details (from site settings). */
  checkoutPaymentDetails: string;
}

export interface QuoteCatalogInput {
  designs: DesignInfo[];
  sizes: SizeInfo[];
  brands: BrandInfo[];
  fixations: FixationInfo[];
  variants: ProductVariant[];
  discountTiers: DiscountTier[];
  checkoutPaymentDetails: string;
}

export interface CatalogRepository {
  /**
   * Load commerce/catalog dataset for cart quotes, checkout, or public pages.
   * Fail-closed: infrastructure errors throw; never silently fall back to another backend.
   */
  loadCatalog(options?: LoadCatalogOptions): Promise<CatalogData>;
}
