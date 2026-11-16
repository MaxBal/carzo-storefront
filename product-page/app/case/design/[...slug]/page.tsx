import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import {
  parseRouteSegments,
  buildProductTitle,
  buildMetaDescription,
  buildProductUrl,
  buildProductJsonLd,
  getDesignBySlug,
} from '@/lib/product-data';
import { getContentSource } from '@/lib/data/content';
import { getProductCatalog, resolveProductContent } from '@/lib/content/resolver';
import { absoluteSiteUrl } from '@/lib/seo';
import ProductPageClient from './ProductPageClient';

interface PageProps {
  params: { slug: string[] };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const source = await getContentSource();
  const catalog = getProductCatalog(source);
  const { params: productParams, notFound: nf } = parseRouteSegments(params.slug, catalog);
  if (nf) {
    return { title: 'Сторінку не знайдено', robots: { index: false, follow: false } };
  }
  const title = buildProductTitle(productParams, catalog);
  const description = buildMetaDescription(productParams, catalog);
  const canonical = buildProductUrl({ ...productParams, brandId: 'none' }, catalog);
  const content = resolveProductContent(productParams, source);
  const firstImage = content.gallery.find(img => !img.isPlaceholder);
  const ogImage = firstImage?.src || '/case.jpg';

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'CARZO',
      locale: 'uk_UA',
      type: 'website',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function Page({ params }: PageProps) {
  const source = await getContentSource();
  const catalog = getProductCatalog(source);
  const parsed = parseRouteSegments(params.slug, catalog);

  if (parsed.notFound) {
    notFound();
  }

  if (parsed.redirect) {
    redirect(parsed.redirect);
  }

  const design = getDesignBySlug(parsed.params.designSlug, catalog);
  if (!design) {
    notFound();
  }

  const content = resolveProductContent(parsed.params, source);

  // JSON-LD must describe the canonical (unbranded) page: branded URLs are
  // canonicalized away, and the UI price includes the logo surcharge that the
  // base variant price does not. Aligning name/url/price with canonical keeps
  // microdata consistent with the visible canonical page.
  const { schema: productSchema } = buildProductJsonLd({
    params: parsed.params,
    catalog,
    variant: content.pricing.selectedVariant,
    gallery: content.gallery,
    toAbsoluteUrl: absoluteSiteUrl,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <ProductPageClient params={parsed.params} content={content} siteFlag={content.siteSettings.siteFlag} />
    </>
  );
}
