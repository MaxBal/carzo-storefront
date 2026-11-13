/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },
  async headers() {
    // Preview/development must stay out of the index. The legacy URL checks also
    // catch the separate staging project, which deploys with VERCEL_ENV=production.
    const isNonProduction =
      (Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== 'production') ||
      Boolean(process.env.VERCEL_URL?.includes('staging')) ||
      Boolean(process.env.NEXT_PUBLIC_SITE_URL?.includes('staging'));

    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      {
        key: 'Content-Security-Policy',
        value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
      },
    ];

    return [
      {
        source: '/:path*',
        headers: [
          ...securityHeaders,
          ...(isNonProduction ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] : []),
        ],
      },
    ];
  },
};

module.exports = nextConfig;
