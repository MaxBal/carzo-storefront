import 'server-only';

import type {
  BrandInfo,
  DesignInfo,
  DiscountTier,
  FixationInfo,
  ProductVariant,
  SizeContentGroup,
  SizeId,
  SizeInfo,
} from '@/lib/content/types';
import type { CatalogData, CatalogRepository } from './types';

type RecordValue = Record<string, unknown>;

function directusUrl() {
  return process.env.DIRECTUS_URL?.replace(/\/$/, '') || null;
}

function directusHeaders() {
  const token = process.env.DIRECTUS_READ_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: unknown) {
  return value === true;
}

function relation(value: unknown, field: string): string {
  if (value && typeof value === 'object') {
    const nested = (value as RecordValue)[field];
    return typeof nested === 'string' ? nested : '';
  }
  return typeof value === 'string' ? value : '';
}

async function readPublished(collection: string, fields: string): Promise<RecordValue[]> {
  const url = directusUrl();
  const token = process.env.DIRECTUS_READ_TOKEN?.trim();
  if (!url || !token) {
    throw new Error('Directus catalog is not configured');
  }
  const query = new URLSearchParams({
    limit: '-1',
    fields,
    'filter[status][_eq]': 'published',
  });
  const response = await fetch(`${url}/items/${collection}?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Directus ${collection} failed: HTTP ${response.status}`);
  }
  const payload = await response.json() as { data?: RecordValue | RecordValue[] };
  if (Array.isArray(payload.data)) return payload.data;
  return payload.data ? [payload.data] : [];
}

function fixationExtraForSize(fixation: RecordValue, size: string) {
  const bySize = fixation.extra_by_size;
  if (bySize && typeof bySize === 'object' && !Array.isArray(bySize)) {
    const map = bySize as Record<string, unknown>;
    const key = String(size).toLowerCase();
    const value = map[key] ?? map[String(size)];
    if (value !== undefined && value !== null) return number(value);
  }
  return number(fixation.extra);
}

function mapFixationExtraBySize(item: RecordValue): FixationInfo['extraBySize'] {
  const raw = item.extra_by_size;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).flatMap(([key, value]) => {
      const lower = String(key).toLowerCase();
      const n = number(value);
      return [[lower, n], [lower.toUpperCase(), n]] as Array<[string, number]>;
    }),
  ) as FixationInfo['extraBySize'];
}

/**
 * Directus catalog repository. Behavior matches the previous inline cart/server.ts reads.
 * Fail-closed on any Directus error — no static price fallback.
 */
export function createDirectusCatalogRepository(): CatalogRepository {
  return {
    async loadCatalog(): Promise<CatalogData> {
      const [
        designs,
        sizes,
        brands,
        brandPricing,
        fixations,
        variants,
        discountTiers,
        shipping,
        siteSettings,
      ] = await Promise.all([
        readPublished('carzo_designs', 'slug,version,label,selector_image_url,selector_image.id,sort'),
        readPublished('carzo_sizes', 'code,slug,label,width_cm,height_cm,depth_cm,content_group,sort'),
        readPublished('carzo_brands', 'slug,name,flag,logo_image_url,logo_image.id,sort'),
        readPublished('carzo_brand_pricing', 'brand.slug,logo_extra'),
        readPublished('carzo_fixations', 'key,label,extra,extra_by_size,sort'),
        readPublished(
          'carzo_variants',
          'key,design.slug,size.code,price,old_price,in_stock,quantity_discount_eligible',
        ),
        readPublished('carzo_discount_tiers', 'key,min_quantity,amount,sort'),
        readPublished('carzo_size_shipping', 'size.code,length_cm,width_cm,height_cm,weight_kg'),
        readPublished('carzo_site_settings', 'checkout_payment_details'),
      ]);

      const brandPriceBySlug = new Map(
        brandPricing.map(item => [relation(item.brand, 'slug'), number(item.logo_extra)]),
      );
      const shippingByCode = new Map(
        shipping.map(item => [relation(item.size, 'code'), item]),
      );

      return {
        designs: designs.map((item): DesignInfo => ({
          slug: text(item.slug),
          version: text(item.version),
          label: text(item.label),
          selectorImage: text(item.selector_image_url) || text((item.selector_image as RecordValue | undefined)?.id),
          sort: number(item.sort),
        })),
        sizes: sizes.map((item): SizeInfo => {
          const code = text(item.code);
          const ship = shippingByCode.get(code);
          const shippingValues = [
            ship?.length_cm, ship?.width_cm, ship?.height_cm, ship?.weight_kg,
          ];
          return {
            id: code as SizeId,
            slug: text(item.slug),
            label: text(item.label),
            widthCm: number(item.width_cm),
            heightCm: number(item.height_cm),
            depthCm: number(item.depth_cm),
            contentGroup: text(item.content_group) as SizeContentGroup,
            shippingProfile: shippingValues.every(value => value !== null && value !== undefined)
              ? {
                  lengthCm: number(ship?.length_cm),
                  widthCm: number(ship?.width_cm),
                  heightCm: number(ship?.height_cm),
                  weightKg: number(ship?.weight_kg),
                }
              : null,
            sort: number(item.sort),
          };
        }),
        brands: brands.map((item): BrandInfo => ({
          id: text(item.slug),
          name: item.name === null ? null : text(item.name),
          flag: text(item.flag),
          price: number(brandPriceBySlug.get(text(item.slug)) ?? 0),
          logoImage: text(item.logo_image_url) || text((item.logo_image as RecordValue | undefined)?.id),
          sort: number(item.sort),
        })),
        fixations: fixations.map((item): FixationInfo => ({
          value: text(item.key),
          label: text(item.label),
          extra: number(item.extra),
          extraBySize: mapFixationExtraBySize(item),
          sort: number(item.sort),
        })),
        variants: variants.map((item): ProductVariant => ({
          key: text(item.key),
          designSlug: relation(item.design, 'slug'),
          size: relation(item.size, 'code') as SizeId,
          price: number(item.price),
          oldPrice: number(item.old_price),
          inStock: bool(item.in_stock),
          quantityDiscountEligible: bool(item.quantity_discount_eligible),
        })),
        discountTiers: discountTiers.map((item): DiscountTier => ({
          key: text(item.key),
          minQuantity: number(item.min_quantity),
          amount: number(item.amount),
          sort: number(item.sort),
        })),
        checkoutPaymentDetails: text(siteSettings[0]?.checkout_payment_details).trim(),
      };
    },
  };
}

/** Exposed for quote unit parity with legacy inline helpers. */
export const __directusFixationExtraForSize = fixationExtraForSize;
