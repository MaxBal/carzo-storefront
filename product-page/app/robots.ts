import type { MetadataRoute } from 'next';
import { absoluteSiteUrl, siteOrigin } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  // Preview/development must stay out of the index. The legacy URL checks also
  // catch the separate staging project, which deploys with VERCEL_ENV=production.
  const isNonProduction =
    (Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== 'production') ||
    Boolean(process.env.VERCEL_URL?.includes('staging')) ||
    Boolean(process.env.NEXT_PUBLIC_SITE_URL?.includes('staging'));

  if (isNonProduction) {
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
