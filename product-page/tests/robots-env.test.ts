/**
 * C-09 + C-16: VERCEL_ENV-driven preview de-indexing and baseline security headers.
 *
 * Run: pnpm run test:audit-fixes
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import robots from '../app/robots';
import nextConfig from '../next.config.js';

type EnvValues = Record<string, string | undefined>;

const ENV_KEYS = ['VERCEL_ENV', 'VERCEL_URL', 'NEXT_PUBLIC_SITE_URL'];

function withEnv<T>(values: EnvValues, fn: () => T): T {
  const saved: EnvValues = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
  }
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const key of ENV_KEYS) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function withEnvAsync<T>(values: EnvValues, fn: () => Promise<T>): Promise<T> {
  const saved: EnvValues = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
  }
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const key of ENV_KEYS) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function headerMap(headers: { key: string; value: string }[]) {
  return new Map(headers.map(header => [header.key.toLowerCase(), header.value]));
}

async function responseHeaders() {
  assert.ok(nextConfig.headers, 'next.config.js must define headers()');
  const rules = await nextConfig.headers();
  assert.equal(rules.length, 1, 'single /:path* rule');
  assert.equal(rules[0].source, '/:path*');
  return headerMap(rules[0].headers as { key: string; value: string }[]);
}

describe('C-09 robots() by VERCEL_ENV', () => {
  it('allows indexing on production', () => {
    const result = withEnv(
      { VERCEL_ENV: 'production', VERCEL_URL: 'carzo-storefront-abc.vercel.app', NEXT_PUBLIC_SITE_URL: undefined },
      () => robots(),
    );
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    assert.deepEqual(rules[0], { userAgent: '*', allow: '/', disallow: '/api/' });
    assert.ok(result.sitemap, 'sitemap advertised for production');
  });

  it('disallows everything on preview', () => {
    const result = withEnv(
      { VERCEL_ENV: 'preview', VERCEL_URL: 'carzo-storefront-git-dev.vercel.app', NEXT_PUBLIC_SITE_URL: undefined },
      () => robots(),
    );
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    assert.deepEqual(rules[0], { userAgent: '*', disallow: '/' });
    assert.equal(result.sitemap, undefined);
  });

  it('disallows everything on development', () => {
    const result = withEnv(
      { VERCEL_ENV: 'development', VERCEL_URL: undefined, NEXT_PUBLIC_SITE_URL: undefined },
      () => robots(),
    );
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    assert.deepEqual(rules[0], { userAgent: '*', disallow: '/' });
  });

  it('allows indexing in local dev (no VERCEL_ENV)', () => {
    const result = withEnv(
      { VERCEL_ENV: undefined, VERCEL_URL: undefined, NEXT_PUBLIC_SITE_URL: undefined },
      () => robots(),
    );
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    assert.deepEqual(rules[0], { userAgent: '*', allow: '/', disallow: '/api/' });
  });

  it('keeps legacy staging URL detection (staging project has VERCEL_ENV=production)', () => {
    const result = withEnv(
      { VERCEL_ENV: 'production', VERCEL_URL: 'carzo-eight-staging.vercel.app', NEXT_PUBLIC_SITE_URL: undefined },
      () => robots(),
    );
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    assert.deepEqual(rules[0], { userAgent: '*', disallow: '/' });
  });
});

describe('C-16 security headers in next.config.js', () => {
  const expectedSecurity: Record<string, string> = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy': "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
  };

  it('always serves the baseline security headers on production', async () => {
    const headers = await withEnvAsync(
      { VERCEL_ENV: 'production', VERCEL_URL: 'carzo-storefront-abc.vercel.app', NEXT_PUBLIC_SITE_URL: undefined },
      () => responseHeaders(),
    );
    for (const [key, value] of Object.entries(expectedSecurity)) {
      assert.equal(headers.get(key), value, `${key} on production`);
    }
    assert.equal(headers.get('x-robots-tag'), undefined, 'production stays indexable');
  });

  it('adds X-Robots-Tag on preview without dropping security headers', async () => {
    const headers = await withEnvAsync(
      { VERCEL_ENV: 'preview', VERCEL_URL: 'carzo-storefront-git-fix.vercel.app', NEXT_PUBLIC_SITE_URL: undefined },
      () => responseHeaders(),
    );
    assert.equal(headers.get('x-robots-tag'), 'noindex, nofollow');
    for (const [key, value] of Object.entries(expectedSecurity)) {
      assert.equal(headers.get(key), value, `${key} on preview`);
    }
  });

  it('serves security headers in local dev and keeps it indexable', async () => {
    const headers = await withEnvAsync(
      { VERCEL_ENV: undefined, VERCEL_URL: undefined, NEXT_PUBLIC_SITE_URL: undefined },
      () => responseHeaders(),
    );
    for (const [key, value] of Object.entries(expectedSecurity)) {
      assert.equal(headers.get(key), value, `${key} on local dev`);
    }
    assert.equal(headers.get('x-robots-tag'), undefined);
  });

  it('adds X-Robots-Tag for legacy staging URLs', async () => {
    const headers = await withEnvAsync(
      { VERCEL_ENV: 'production', VERCEL_URL: 'carzo-eight-staging.vercel.app', NEXT_PUBLIC_SITE_URL: undefined },
      () => responseHeaders(),
    );
    assert.equal(headers.get('x-robots-tag'), 'noindex, nofollow');
  });
});
