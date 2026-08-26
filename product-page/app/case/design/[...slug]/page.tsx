import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { parseRouteSegments, buildProductTitle, buildMetaDescription, buildProductUrl, getDesignBySlug } from '@/lib/product-data';
import { getContentSource } from '@/lib/content/directus';
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
          url: '/og-image.svg',
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
      images: ['/og-image.svg'],
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

  const productUrl = absoluteSiteUrl(buildProductUrl(parsed.params, catalog));
  const productTitle = buildProductTitle(parsed.params, catalog);
  const productDescription = buildMetaDescription(parsed.params, catalog);
  const { selectedVariant } = content.pricing;
  const firstImage = content.gallery.find(img => !img.isPlaceholder);
  const productImage = firstImage ? absoluteSiteUrl(firstImage.src) : absoluteSiteUrl('/og-image.svg');

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productTitle,
    description: productDescription,
    image: productImage,
    brand: {
      '@type': 'Brand',
      name: 'CARZO',
    },
    url: productUrl,
    offers: {
      '@type': 'Offer',
      price: selectedVariant.price,
      priceCurrency: 'UAH',
      availability: selectedVariant.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: productUrl,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <ProductPageClient params={parsed.params} content={content} />
    </>
  );
}
