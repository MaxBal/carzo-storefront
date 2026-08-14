import type { MetadataRoute } from 'next';
import { getContentSource } from '@/lib/content/directus';
import { getPublishedPageSummaries } from '@/lib/pages/directus';
import { pagePath } from '@/lib/pages/metadata';
import { absoluteSiteUrl, getPrimaryProductLinks } from '@/lib/seo';

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pages, source] = await Promise.all([
    getPublishedPageSummaries(),
    getContentSource(),
  ]);
  const entries = new Map<string, MetadataRoute.Sitemap[number]>();

  entries.set(absoluteSiteUrl('/'), {
    url: absoluteSiteUrl('/'),
    changeFrequency: 'weekly',
    priority: 1,
  });

  pages
    .filter(page => !page.noIndex)
    .forEach((page) => {
      const url = absoluteSiteUrl(pagePath(page.slug));
      entries.set(url, {
        url,
        changeFrequency: page.slug === 'home' ? 'weekly' : 'monthly',
        priority: page.slug === 'home' ? 1 : 0.6,
      });
    });

  getPrimaryProductLinks(source).forEach((product) => {
    const url = absoluteSiteUrl(product.path);
    entries.set(url, {
      url,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  });

  return Array.from(entries.values());
}
