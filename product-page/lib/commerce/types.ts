import type { ShippingProfile } from '@/lib/content/types';

/** Selected IDs/values only. Prices, titles and eligibility always come from the server. */
export interface CatalogCartItem {
  productId: string;
  variantId: string;
  options: Record<string, string>;
  personalization: Record<string, string>;
  quantity: number;
}

export interface ProductOptionChoice {
  key: string;
  label: string;
  priceExtra: number;
  crmSku: string | null;
  brandId: string | null;
}

export interface ProductOptionGroup {
  key: string;
  label: string;
  inputType: 'choice' | 'text';
  required: boolean;
  maxLength: number;
  priceExtra: number;
  choices: ProductOptionChoice[];
}

export interface CommerceVariant {
  id: string;
  label: string;
  sku: string;
  price: number;
  inStock: boolean;
  attributes: Record<string, string>;
  designId: string | null;
  mediaUrl: string | null;
  shippingProfile: ShippingProfile;
}

export interface CommerceProduct {
  id: string;
  slug: string;
  name: string;
  productType: string;
  layoutKey: string;
  quantityDiscountEligible: boolean;
  variants: CommerceVariant[];
  optionGroups: ProductOptionGroup[];
}

/** Immutable, server-built order-line configuration; never re-read historical options from the catalog. */
export interface CatalogItemSnapshot {
  productId: string;
  variantId: string;
  productType: string;
  variantLabel: string;
  attributes: Record<string, string>;
  sku: string;
  selectedOptions: Array<{
    key: string;
    label: string;
    value: string;
    priceExtra: number;
    crmSku: string | null;
  }>;
  shippingProfile: ShippingProfile;
}

export function catalogConfiguration(snapshot: CatalogItemSnapshot): string[] {
  return [snapshot.variantLabel, ...snapshot.selectedOptions.map(option => `${option.label}: ${option.value}`)].filter(Boolean);
}
