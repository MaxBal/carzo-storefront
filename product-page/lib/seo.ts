import 'server-only';

import { buildMetaDescription, buildProductTitle, buildProductUrl } from '@/lib/product-data';
import { getProductCatalog } from '@/lib/content/resolver';
import type { ContentSource, ProductParams } from '@/lib/content/types';

const FALLBACK_SITE_URL = 'https://carzo-eight.vercel.app';

export interface PublicProductLink {
  path: string;
  title: string;
  description: string;
}

export function siteOrigin() {
  const configured = process.env.SITE_URL?.trim() || FALLBACK_SITE_URL;
  try {
    return new URL(configured).origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export function absoluteSiteUrl(path = '/') {
  return new URL(path, `${siteOrigin()}/`).toString();
}

export function getPrimaryProductLinks(source: ContentSource): PublicProductLink[] {
  const catalog = getProductCatalog(source);
  const designOrder = new Map(catalog.designs.map((design, index) => [design.slug, index]));
  const sizeOrder = new Map(catalog.sizes.map((size, index) => [size.id, index]));
  const seen = new Set<string>();

  return [...source.variants]
    .sort((left, right) => (
      (designOrder.get(left.designSlug) ?? Number.MAX_SAFE_INTEGER)
      - (designOrder.get(right.designSlug) ?? Number.MAX_SAFE_INTEGER)
      || (sizeOrder.get(left.size) ?? Number.MAX_SAFE_INTEGER)
      - (sizeOrder.get(right.size) ?? Number.MAX_SAFE_INTEGER)
    ))
    .flatMap((variant) => {
      const design = catalog.designs.find(item => item.slug === variant.designSlug);
      const size = catalog.sizes.find(item => item.id === variant.size);
      if (!design || !size) return [];

      const params: ProductParams = {
        size: size.id,
        designSlug: design.slug,
        brandId: 'none',
      };
      const path = buildProductUrl(params, catalog);
      if (seen.has(path)) return [];
      seen.add(path);

      return [{
        path,
        title: buildProductTitle(params, catalog),
        description: buildMetaDescription(params, catalog),
      }];
    });
}
