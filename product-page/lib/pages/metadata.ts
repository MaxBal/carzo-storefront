import type { Metadata } from 'next';
import type { CmsPage } from './types';

const DEFAULT_OG_IMAGE = {
  url: '/og-cover.png',
  width: 1200,
  height: 630,
  alt: 'CARZO — автомобільні органайзери',
};

/**
 * The layout title template already appends " | CARZO". CMS seo_title values
 * may carry their own suffix; strip it so the rendered title is not duplicated.
 */
function stripSiteTitleSuffix(title: string): string {
  return title.replace(/\s*\|\s*CARZO\s*$/i, '').trim() || title.trim();
}

export function pagePath(slug: string) {
  return slug === 'home' ? '/' : `/${slug}`;
}

export function buildCmsMetadata(page: CmsPage | null, fallbackTitle: string): Metadata {
  if (!page) return { title: stripSiteTitleSuffix(fallbackTitle) };
  const canonical = pagePath(page.slug);
  const resolvedTitle = stripSiteTitleSuffix(page.seoTitle || page.title);
  const images = page.seoImage
    ? [{ url: page.seoImage, alt: page.title }]
    : [DEFAULT_OG_IMAGE];

  return {
    title: resolvedTitle,
    description: page.seoDescription || undefined,
    alternates: { canonical },
    robots: page.noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: resolvedTitle,
      description: page.seoDescription || undefined,
      url: canonical,
      type: 'website',
      siteName: 'CARZO',
      locale: 'uk_UA',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: resolvedTitle,
      description: page.seoDescription || undefined,
      images: images.map(img => img.url),
    },
  };
}
