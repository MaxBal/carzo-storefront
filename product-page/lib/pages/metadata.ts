import type { Metadata } from 'next';
import type { CmsPage } from './types';

export function pagePath(slug: string) {
  return slug === 'home' ? '/' : `/${slug}`;
}

export function buildCmsMetadata(page: CmsPage | null, fallbackTitle: string): Metadata {
  if (!page) return { title: fallbackTitle };
  const canonical = pagePath(page.slug);
  const images = page.seoImage ? [{ url: page.seoImage, alt: page.title }] : undefined;

  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
    alternates: { canonical },
    robots: page.noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: page.seoTitle || page.title,
      description: page.seoDescription || undefined,
      url: canonical,
      type: 'website',
      images,
    },
  };
}
