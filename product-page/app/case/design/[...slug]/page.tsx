import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { parseRouteSegments, buildProductTitle, buildMetaDescription, buildProductUrl, getDesignBySlug } from '@/lib/product-data';
import { getContentSource } from '@/lib/content/directus';
import { getProductCatalog, resolveProductContent } from '@/lib/content/resolver';
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
  return <ProductPageClient params={parsed.params} content={content} />;
}
