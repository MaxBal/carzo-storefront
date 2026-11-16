import 'server-only';

import { draftMode } from 'next/headers';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
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
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from '../config';
import type {
  CatalogCacheMode,
  CatalogData,
  CatalogRepository,
  LoadCatalogOptions,
} from './types';

type SupabaseRow = Record<string, unknown>;

export const __CATALOG_CACHE = {
  revalidate: CACHE_REVALIDATE_SECONDS,
  tags: [CACHE_TAGS.catalog],
} as const;

type NextFetchInit = RequestInit & {
  next?: { revalidate?: number | false; tags?: string[] };
};

function isDraftModeEnabled(): boolean {
  try {
    return draftMode().isEnabled;
  } catch {
    return false;
  }
}

export class CatalogUnavailableError extends Error {
  readonly code = 'UNAVAILABLE' as const;

  constructor(message: string) {
    super(message);
    this.name = 'CatalogUnavailableError';
  }
}

let cachedRevalidateCatalogClient: SupabaseClient | null = null;

function getRevalidatingCatalogClient(): SupabaseClient {
  if (!cachedRevalidateCatalogClient) {
    const url = process.env.SUPABASE_URL?.trim();
    const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
    if (!url || !secretKey) {
      throw new CatalogUnavailableError('Missing required Supabase environment variables for catalog');
    }
    cachedRevalidateCatalogClient = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) => {
          if (isDraftModeEnabled()) {
            return fetch(input, { ...init, cache: 'no-store' });
          }
          const { cache: _cache, ...rest } = init ?? {};
          return fetch(input, {
            ...rest,
            next: { revalidate: __CATALOG_CACHE.revalidate, tags: [...__CATALOG_CACHE.tags] },
          } as NextFetchInit);
        },
      },
    });
  }
  return cachedRevalidateCatalogClient;
}

function getCatalogClient(cacheMode: CatalogCacheMode = 'no-store'): SupabaseClient {
  if (cacheMode === 'revalidate' && !isDraftModeEnabled()) {
    return getRevalidatingCatalogClient();
  }
  return getSupabaseAdminClient();
}

/** Test helper to reset the revalidating catalog client singleton in unit tests. */
export function resetSupabaseCatalogClientForTests(): void {
  cachedRevalidateCatalogClient = null;
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function int(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

function bool(value: unknown) {
  return value === true;
}

async function selectAll(
  table: string,
  columns: string,
  options?: { publishedOnly?: boolean; cacheMode?: CatalogCacheMode },
): Promise<SupabaseRow[]> {
  let query = getCatalogClient(options?.cacheMode ?? 'no-store')
    .from(table)
    .select(columns);
  if (options?.publishedOnly) {
    query = query.eq('status', 'published');
  }
  const { data, error } = await query;
  if (error) {
    throw new CatalogUnavailableError(`Supabase ${table} read failed: ${error.message}`);
  }
  return (data ?? []) as unknown as SupabaseRow[];
}

/**
 * Supabase catalog repository — SELECT-only, R2 URL media, fail-closed.
 * Maps normalized tables into the existing domain types.
 * Defaults to `cache: 'no-store'` for live checkout/quote verification;
 * accepts `{ cache: 'revalidate' }` for public page rendering.
 */
export function createSupabaseCatalogRepository(): CatalogRepository {
  return {
    async loadCatalog(options?: LoadCatalogOptions): Promise<CatalogData> {
      const cacheMode: CatalogCacheMode = options?.cache ?? 'no-store';
      try {
        const [designs, sizes, brands, fixations, fixationExtras, variants, discountTiers, siteSettings] =
          await Promise.all([
            selectAll('designs', 'slug,version,label,selector_image_url,sort,status', { publishedOnly: true, cacheMode }),
            selectAll(
              'sizes',
              'id,code,slug,label,width_cm,height_cm,depth_cm,content_group,shipping_length_cm,shipping_width_cm,shipping_height_cm,shipping_weight_kg,sort,status',
              { publishedOnly: true, cacheMode },
            ),
            selectAll('brands', 'slug,name,flag,logo_extra,logo_image_url,sort,status', { publishedOnly: true, cacheMode }),
            selectAll('fixations', 'id,key,label,extra,sort,status', { publishedOnly: true, cacheMode }),
            selectAll('fixation_size_extras', 'fixation_id,size_id,extra', { cacheMode }),
            selectAll(
              'variants',
              'key,price,old_price,in_stock,quantity_discount_eligible,status,designs:design_id(slug),sizes:size_id(code)',
              { publishedOnly: true, cacheMode },
            ),
            selectAll('discount_tiers', 'key,min_quantity,amount,sort', { cacheMode }),
            selectAll('site_settings', 'checkout_payment_details', { cacheMode }),
          ]);

        const sizeByCode = new Map(
          sizes.map(row => [text(row.code), row]),
        );
        const sizeCodeById = new Map(
          sizes.map(row => [text(row.id), text(row.code)]),
        );
        const fixationKeyById = new Map(
          fixations.map(row => [text(row.id), text(row.key)]),
        );

        const extraByFixation = new Map<string, Partial<Record<SizeId, number>>>();
        for (const row of fixationExtras) {
          const fixationId = text(row.fixation_id);
          const sizeId = text(row.size_id);
          const fixationKey = fixationKeyById.get(fixationId);
          const sizeCode = sizeCodeById.get(sizeId);
          if (!fixationKey || !sizeCode) {
            throw new CatalogUnavailableError(
              `Supabase fixation_size_extras row has unmapped ids: fixation_id=${fixationId || '<empty>'} size_id=${sizeId || '<empty>'}`,
            );
          }
          const map = extraByFixation.get(fixationKey) ?? {};
          const n = int(row.extra);
          map[sizeCode as SizeId] = n;
          map[String(sizeCode).toLowerCase() as SizeId] = n;
          extraByFixation.set(fixationKey, map);
        }

        const mappedDesigns: DesignInfo[] = designs.map((row): DesignInfo => ({
          slug: text(row.slug),
          version: text(row.version),
          label: text(row.label),
          selectorImage: text(row.selector_image_url),
          sort: number(row.sort),
        }));

        const mappedSizes: SizeInfo[] = sizes.map((row): SizeInfo => {
          const shippingValues = [
            row.shipping_length_cm,
            row.shipping_width_cm,
            row.shipping_height_cm,
            row.shipping_weight_kg,
          ];
          return {
            id: text(row.code) as SizeId,
            slug: text(row.slug),
            label: text(row.label),
            widthCm: number(row.width_cm),
            heightCm: number(row.height_cm),
            depthCm: number(row.depth_cm),
            contentGroup: text(row.content_group) as SizeContentGroup,
            shippingProfile: shippingValues.every(value => value !== null && value !== undefined)
              ? {
                  lengthCm: number(row.shipping_length_cm),
                  widthCm: number(row.shipping_width_cm),
                  heightCm: number(row.shipping_height_cm),
                  weightKg: number(row.shipping_weight_kg),
                }
              : null,
            sort: number(row.sort),
          };
        });

        const mappedBrands: BrandInfo[] = brands.map((row): BrandInfo => ({
          id: text(row.slug),
          name: row.name === null ? null : text(row.name),
          flag: text(row.flag),
          price: int(row.logo_extra),
          logoImage: text(row.logo_image_url),
          sort: number(row.sort),
        }));

        const mappedFixations: FixationInfo[] = fixations.map((row): FixationInfo => ({
          value: text(row.key),
          label: text(row.label),
          extra: int(row.extra),
          extraBySize: extraByFixation.get(text(row.key)),
          sort: number(row.sort),
        }));

        const mappedVariants: ProductVariant[] = variants.map((row): ProductVariant => ({
          key: text(row.key),
          designSlug: text((row.designs as SupabaseRow | undefined)?.slug)
            || text((row.design as SupabaseRow | undefined)?.slug),
          size: (text((row.sizes as SupabaseRow | undefined)?.code)
            || text((row.size as SupabaseRow | undefined)?.code)) as SizeId,
          price: int(row.price),
          oldPrice: number(row.old_price),
          inStock: bool(row.in_stock),
          quantityDiscountEligible: bool(row.quantity_discount_eligible),
        }));

        const mappedTiers: DiscountTier[] = discountTiers.map((row): DiscountTier => ({
          key: text(row.key),
          minQuantity: int(row.min_quantity),
          amount: int(row.amount),
          sort: number(row.sort),
        }));

        return {
          designs: mappedDesigns,
          sizes: mappedSizes,
          brands: mappedBrands,
          fixations: mappedFixations,
          variants: mappedVariants,
          discountTiers: mappedTiers,
          checkoutPaymentDetails: text(siteSettings[0]?.checkout_payment_details).trim(),
        };
      } catch (error) {
        if (error instanceof CatalogUnavailableError) throw error;
        throw new CatalogUnavailableError(
          error instanceof Error ? error.message : 'Supabase catalog unavailable',
        );
      }
    },
  };
}
