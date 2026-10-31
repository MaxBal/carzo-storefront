import type {
  BrandInfo,
  DesignInfo,
  DiscountTier,
  FixationInfo,
  ProductVariant,
  SizeInfo,
} from '@/lib/content/types';

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
   * Load commerce/catalog dataset for cart quotes and checkout.
   * Fail-closed: infrastructure errors throw; never silently fall back to another backend.
   */
  loadCatalog(): Promise<CatalogData>;
}
