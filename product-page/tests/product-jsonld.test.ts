/**
 * NEW-10: Product JSON-LD must stay aligned with the canonical (unbranded) page
 * across both unbranded (/case/design/m/2-0) and branded (/case/design/m/2-0/bmw) routes.
 * C-11: Mobile gallery slide mounting helper defers offscreen slides until interaction.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_CATALOG,
  buildProductJsonLd,
  buildProductTitle,
  buildProductUrl,
  getBrandById,
  parseRouteSegments,
} from '../lib/product-data';
import { resolveProductContent } from '../lib/content/resolver';
import { DEFAULT_CONTENT_SOURCE } from '../lib/content/default-source';
import { shouldRenderMobileSlideImage } from '../components/ProductGallery';

const TEST_ORIGIN = 'https://carzo-storefront.vercel.app';
const toAbsoluteUrl = (path: string) => new URL(path, `${TEST_ORIGIN}/`).toString();

describe('NEW-10 — Product JSON-LD & canonical alignment', () => {
  it('produces canonical name, url, offers.url, and base price (2249 UAH) on unbranded /case/design/m/2-0', () => {
    const parsed = parseRouteSegments(['m', '2-0'], DEFAULT_CATALOG);
    assert.equal(parsed.notFound, undefined);
    assert.deepEqual(parsed.params, { size: 'M', designSlug: '2-0', brandId: 'none' });

    const content = resolveProductContent(parsed.params, DEFAULT_CONTENT_SOURCE);
    const { canonicalPath, canonicalUrl, schema } = buildProductJsonLd({
      params: parsed.params,
      catalog: DEFAULT_CATALOG,
      variant: content.pricing.selectedVariant,
      gallery: content.gallery,
      toAbsoluteUrl,
    });

    assert.equal(canonicalPath, '/case/design/m/2-0');
    assert.equal(canonicalUrl, 'https://carzo-storefront.vercel.app/case/design/m/2-0');
    assert.equal(schema.name, 'Автокейс M Carzo 2.0');
    assert.equal(schema.url, 'https://carzo-storefront.vercel.app/case/design/m/2-0');
    assert.equal(schema.offers.url, 'https://carzo-storefront.vercel.app/case/design/m/2-0');
    assert.equal(schema.offers.price, 2249);
    assert.equal(schema.offers.priceCurrency, 'UAH');
    assert.equal(schema.offers.availability, 'https://schema.org/InStock');
  });

  it('keeps canonical name, url, offers.url, and base price (2249 UAH) on branded /case/design/m/2-0/bmw', () => {
    const parsed = parseRouteSegments(['m', '2-0', 'bmw'], DEFAULT_CATALOG);
    assert.equal(parsed.notFound, undefined);
    assert.deepEqual(parsed.params, { size: 'M', designSlug: '2-0', brandId: 'bmw' });

    // UI title and price on /bmw include the brand name and +290 UAH logo surcharge (2539 UAH),
    // while canonical URL and JSON-LD describe the canonical unbranded product (2249 UAH).
    const uiTitle = buildProductTitle(parsed.params, DEFAULT_CATALOG);
    const bmwBrand = getBrandById('bmw', DEFAULT_CATALOG);
    const content = resolveProductContent(parsed.params, DEFAULT_CONTENT_SOURCE);
    const uiPrice = content.pricing.selectedVariant.price + (bmwBrand?.price ?? 0);

    assert.equal(uiTitle, 'Автокейс M Carzo 2.0 для BMW');
    assert.equal(uiPrice, 2539);

    const metadataCanonical = buildProductUrl({ ...parsed.params, brandId: 'none' }, DEFAULT_CATALOG);
    const { canonicalPath, canonicalUrl, schema } = buildProductJsonLd({
      params: parsed.params,
      catalog: DEFAULT_CATALOG,
      variant: content.pricing.selectedVariant,
      gallery: content.gallery,
      toAbsoluteUrl,
    });

    assert.equal(canonicalPath, metadataCanonical);
    assert.equal(canonicalPath, '/case/design/m/2-0');
    assert.equal(canonicalUrl, 'https://carzo-storefront.vercel.app/case/design/m/2-0');
    assert.equal(schema.name, 'Автокейс M Carzo 2.0');
    assert.ok(!schema.name.includes('BMW'), 'JSON-LD name must not include brand when price is base price');
    assert.equal(schema.url, canonicalUrl);
    assert.equal(schema.offers.url, canonicalUrl);
    assert.equal(schema.offers.price, 2249);
  });

  it('produces identical JSON-LD schemas for unbranded and branded routes of the same (size, design)', () => {
    const unbranded = parseRouteSegments(['m', '2-0'], DEFAULT_CATALOG).params;
    const branded = parseRouteSegments(['m', '2-0', 'bmw'], DEFAULT_CATALOG).params;

    const unbrandedContent = resolveProductContent(unbranded, DEFAULT_CONTENT_SOURCE);
    const brandedContent = resolveProductContent(branded, DEFAULT_CONTENT_SOURCE);

    const jsonLdUnbranded = buildProductJsonLd({
      params: unbranded,
      catalog: DEFAULT_CATALOG,
      variant: unbrandedContent.pricing.selectedVariant,
      gallery: unbrandedContent.gallery,
      toAbsoluteUrl,
    });
    const jsonLdBranded = buildProductJsonLd({
      params: branded,
      catalog: DEFAULT_CATALOG,
      variant: brandedContent.pricing.selectedVariant,
      gallery: brandedContent.gallery,
      toAbsoluteUrl,
    });

    assert.deepEqual(jsonLdBranded.schema, jsonLdUnbranded.schema);
  });

  it('uses first non-placeholder gallery image and falls back to /case.jpg when only placeholders exist', () => {
    const params = parseRouteSegments(['l', '4-0'], DEFAULT_CATALOG).params;
    const withRealImage = buildProductJsonLd({
      params,
      catalog: DEFAULT_CATALOG,
      variant: { price: 3249, inStock: true },
      gallery: [
        { src: '/media/landscape-placeholder.svg', isPlaceholder: true },
        { src: 'https://media.carzo.com.ua/content/products/case/gallery/design-4.0/size-l/01.webp', isPlaceholder: false },
      ],
      toAbsoluteUrl,
    });
    assert.equal(
      withRealImage.schema.image,
      'https://media.carzo.com.ua/content/products/case/gallery/design-4.0/size-l/01.webp',
    );

    const fallbackImage = buildProductJsonLd({
      params,
      catalog: DEFAULT_CATALOG,
      variant: { price: 3249, inStock: false },
      gallery: [{ src: '/media/landscape-placeholder.svg', isPlaceholder: true }],
      toAbsoluteUrl,
    });
    assert.equal(fallbackImage.schema.image, 'https://carzo-storefront.vercel.app/case.jpg');
    assert.equal(fallbackImage.schema.offers.availability, 'https://schema.org/OutOfStock');
  });
});

describe('C-11 — shouldRenderMobileSlideImage deferred mounting', () => {
  it('mounts only slide 0 on initial render (activeIndex=0, hasInteracted=false)', () => {
    const rendered = [0, 1, 2, 3, 4].filter(i => shouldRenderMobileSlideImage(i, 0, false));
    assert.deepEqual(rendered, [0]);
  });

  it('mounts slide 0 and activeIndex if activeIndex changes before full interaction flag', () => {
    const rendered = [0, 1, 2, 3, 4].filter(i => shouldRenderMobileSlideImage(i, 2, false));
    assert.deepEqual(rendered, [0, 2]);
  });

  it('mounts all slides once the user interacts with the mobile carousel', () => {
    const rendered = [0, 1, 2, 3, 4].filter(i => shouldRenderMobileSlideImage(i, 0, true));
    assert.deepEqual(rendered, [0, 1, 2, 3, 4]);
  });
});
