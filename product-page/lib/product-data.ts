import { DEFAULT_CONTENT_SOURCE } from '@/lib/content/default-source';
import { getProductCatalog } from '@/lib/content/resolver';
import type {
  BrandInfo,
  DesignInfo,
  FixationInfo,
  ProductCatalog,
  ProductParams,
  SizeId,
  SizeInfo,
} from '@/lib/content/types';

export type {
  BrandInfo,
  DesignInfo,
  FixationInfo,
  ProductCatalog,
  ProductParams,
  SizeId,
  SizeInfo,
} from '@/lib/content/types';

export const DEFAULT_CATALOG = getProductCatalog(DEFAULT_CONTENT_SOURCE);
export const SIZES = DEFAULT_CATALOG.sizes;
export const DESIGNS = DEFAULT_CATALOG.designs;
export const BRANDS = DEFAULT_CATALOG.brands;
export const FIXATIONS = DEFAULT_CATALOG.fixations;
export const DEFAULT_SIZE: SizeId = 'M';

export function sizeUrlToId(slug: string, catalog: ProductCatalog = DEFAULT_CATALOG): SizeId | null {
  return catalog.sizes.find(size => size.slug === slug.toLowerCase())?.id ?? null;
}

export function sizeIdToUrl(id: SizeId, catalog: ProductCatalog = DEFAULT_CATALOG): string {
  return catalog.sizes.find(size => size.id === id)?.slug ?? id.toLowerCase();
}

export function getSizeInfo(id: SizeId, catalog: ProductCatalog = DEFAULT_CATALOG): SizeInfo {
  return catalog.sizes.find(size => size.id === id)
    ?? DEFAULT_CATALOG.sizes.find(size => size.id === id)!;
}

export function getDesignBySlug(slug: string, catalog: ProductCatalog = DEFAULT_CATALOG): DesignInfo | null {
  return catalog.designs.find(design => design.slug === slug) ?? null;
}

export function getBrandById(id: string, catalog: ProductCatalog = DEFAULT_CATALOG): BrandInfo | null {
  return catalog.brands.find(brand => brand.id === id) ?? null;
}

export function getFixationByValue(value: string, catalog: ProductCatalog = DEFAULT_CATALOG): FixationInfo {
  return catalog.fixations.find(fixation => fixation.value === value)
    ?? catalog.fixations[0]
    ?? DEFAULT_CATALOG.fixations[0];
}

export function buildProductUrl(params: ProductParams, catalog: ProductCatalog = DEFAULT_CATALOG): string {
  const size = sizeIdToUrl(params.size, catalog);
  const brand = params.brandId && params.brandId !== 'none' ? `/${params.brandId}` : '';
  return `/case/design/${size}/${params.designSlug}${brand}`;
}

export function buildProductTitle(params: ProductParams, catalog: ProductCatalog = DEFAULT_CATALOG): string {
  const design = getDesignBySlug(params.designSlug, catalog);
  const version = design?.version ?? params.designSlug;
  const brand = getBrandById(params.brandId, catalog);
  const brandName = brand && brand.id !== 'none' ? brand.name : null;
  if (brandName) return `Автокейс ${params.size} Carzo ${version} для ${brandName}`;
  return `Автокейс ${params.size} Carzo ${version}`;
}

export function buildMetaDescription(params: ProductParams, catalog: ProductCatalog = DEFAULT_CATALOG): string {
  const design = getDesignBySlug(params.designSlug, catalog);
  const version = design?.version ?? params.designSlug;
  const brand = getBrandById(params.brandId, catalog);
  const brandName = brand && brand.id !== 'none' ? brand.name : null;
  if (brandName) {
    return `Автокейс ${params.size} Carzo ${version} для ${brandName} — автомобільний органайзер у багажник з металевим лого ${brandName} та німецької еко-шкіри.`;
  }
  return `Автокейс ${params.size} Carzo ${version} — автомобільний органайзер у багажник з німецької еко-шкіри. Оберіть фіксацію та оформіть замовлення Carzo.`;
}

export interface ParsedRoute {
  params: ProductParams;
  redirect?: string;
  notFound?: boolean;
}

function fallbackParams(catalog: ProductCatalog): ProductParams {
  return {
    size: catalog.sizes.find(size => size.id === DEFAULT_SIZE)?.id ?? catalog.sizes[0]?.id ?? DEFAULT_SIZE,
    designSlug: catalog.designs[0]?.slug ?? DEFAULT_CATALOG.designs[0].slug,
    brandId: 'none',
  };
}

export function parseRouteSegments(
  segments: string[] | undefined,
  catalog: ProductCatalog = DEFAULT_CATALOG,
): ParsedRoute {
  const fallback = fallbackParams(catalog);
  if (!segments || segments.length === 0) return { params: fallback, notFound: true };

  if (segments.length === 1) {
    return { params: fallback, notFound: true };
  }

  const sizeSlug = segments[0];
  const designSlug = segments[1];
  const brandSlug = segments[2];
  const size = sizeUrlToId(sizeSlug, catalog);
  const design = getDesignBySlug(designSlug, catalog);

  if (!size) return { params: fallback, notFound: true };
  if (!design) return { params: { ...fallback, size }, notFound: true };
  if (segments.length > 3) return { params: { size, designSlug, brandId: 'none' }, notFound: true };

  if (sizeSlug !== sizeSlug.toLowerCase()) {
    const normalizedBrand = brandSlug && brandSlug !== 'none' ? brandSlug.toLowerCase() : 'none';
    const params = { size, designSlug, brandId: normalizedBrand };
    return { params, redirect: buildProductUrl(params, catalog) };
  }

  if (segments.length === 2) return { params: { size, designSlug, brandId: 'none' } };

  if (brandSlug.toLowerCase() === 'none') {
    const params = { size, designSlug, brandId: 'none' };
    return { params, redirect: buildProductUrl(params, catalog) };
  }

  const brand = getBrandById(brandSlug.toLowerCase(), catalog);
  if (!brand) {
    return { params: { size, designSlug, brandId: 'none' }, notFound: true };
  }

  if (brandSlug !== brandSlug.toLowerCase()) {
    const params = { size, designSlug, brandId: brand.id };
    return { params, redirect: buildProductUrl(params, catalog) };
  }

  return { params: { size, designSlug, brandId: brand.id } };
}
