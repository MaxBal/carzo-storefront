import type { Metadata } from 'next';
import type { CmsPage } from './types';

const DEFAULT_OG_IMAGE = {
  url: '/og-image.svg',
  width: 1200,
  height: 630,
  alt: 'CARZO — автомобільні органайзери',
};

export function pagePath(slug: string) {
  return slug === 'home' ? '/' : `/${slug}`;
}

export function buildCmsMetadata(page: CmsPage | null, fallbackTitle: string): Metadata {
  if (!page) return { title: fallbackTitle };
  const canonical = pagePath(page.slug);
  const images = page.seoImage 
    ? [{ url: page.seoImage, alt: page.title }] 
    : [DEFAULT_OG_IMAGE];

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
      siteName: 'CARZO',
      locale: 'uk_UA',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: page.seoTitle || page.title,
      description: page.seoDescription || undefined,
      images: images.map(img => img.url),
    },
  };
}
