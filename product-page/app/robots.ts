import type { MetadataRoute } from 'next';
import { absoluteSiteUrl, siteOrigin } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const isStaging = process.env.VERCEL_URL?.includes('staging') || 
                    process.env.NEXT_PUBLIC_SITE_URL?.includes('staging');

  if (isStaging) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
    },
    sitemap: absoluteSiteUrl('/sitemap.xml'),
    host: siteOrigin(),
  };
}
