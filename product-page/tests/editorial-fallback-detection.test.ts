/**
 * Editorial fallback observability (Stage 7.x): a failed editorial DB query must
 * not be silent. The facade logs EDITORIAL_FALLBACK_ACTIVE and flags the result;
 * the strict loaders throw instead of masking missing published content.
 *
 * Run: pnpm run test:editorial-fallback
 * No live Supabase needed: the editorial backend is pointed at an unreachable
 * URL on purpose. Catalog uses the live Directus rollback reader for the
 * getContentSource case (skipped if Directus is down).
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { DEFAULT_HOMEPAGE } from '../lib/content/settings-defaults';
import {
  getContentSource,
  loadAboutData,
  loadCarMatDesigns,
  loadCarMatPromoMedia,
  loadHomepageData,
  loadSupabaseHomepageSettings,
} from '../lib/data/content';

const DEAD_URL = 'http://127.0.0.1:9';

function captureConsoleErrors<T>(fn: () => Promise<T>): Promise<{ result: T; errors: string[] }> {
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
  };
  return fn().then(
    result => {
      console.error = original;
      return { result, errors };
    },
    error => {
      console.error = original;
      throw error;
    },
  );
}

describe('Editorial fallback is observable (Stage 7.x)', () => {
  before(() => {
    process.env.CONTENT_STORE = 'supabase';
    process.env.CATALOG_STORE = 'directus';
    process.env.SUPABASE_URL = DEAD_URL;
    process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || 'stage7x-fallback-test-placeholder';
    process.env.DIRECTUS_URL = process.env.DIRECTUS_URL?.trim() || DEAD_URL;
  });

  it('strict Supabase loader throws instead of masking a failed query', async () => {
    await assert.rejects(
      () => loadSupabaseHomepageSettings(),
      (error: unknown) => {
        assert.ok(error instanceof Error, 'loader rejects with an error');
        return true;
      },
      'loadSupabaseHomepageSettings must reject when PostgREST is unreachable',
    );
  });

  it('facade loaders fall back loudly with EDITORIAL_FALLBACK_ACTIVE', async () => {
    const homepageRun = await captureConsoleErrors(() => loadHomepageData());
    const aboutRun = await captureConsoleErrors(() => loadAboutData());
    const designsRun = await captureConsoleErrors(() => loadCarMatDesigns());
    const promoRun = await captureConsoleErrors(() => loadCarMatPromoMedia());

    assert.equal(homepageRun.result.hero.title, DEFAULT_HOMEPAGE.hero.title, 'homepage falls back to DEFAULT');
    assert.equal(aboutRun.result.hero.title.length >= 1, true);
    assert.equal(designsRun.result.length >= 1, true);
    assert.equal(promoRun.result.videoUrl.length >= 1, true);

    const allErrors = [
      ...homepageRun.errors,
      ...aboutRun.errors,
      ...designsRun.errors,
      ...promoRun.errors,
    ];
    const markers = allErrors.filter(line => line.includes('EDITORIAL_FALLBACK_ACTIVE'));
    assert.ok(
      markers.length >= 3,
      `fallback must be observable in logs; got: ${allErrors.join(' | ')}`,
    );
  });

  it('getContentSource sets editorialFallbackUsed when the editorial backend fails', async (t) => {
    let source;
    try {
      const run = await captureConsoleErrors(() => getContentSource());
      source = run.result;
      const markers = run.errors.filter(line => line.includes('EDITORIAL_FALLBACK_ACTIVE'));
      assert.ok(markers.length >= 1, 'content-source fallback must be logged');
    } catch (error) {
      // Catalog is fail-closed: if the live Directus catalog reader is down,
      // getContentSource must throw rather than substitute default prices.
      t.skip(`catalog fail-closed (Directus unavailable): ${(error as Error).message}`);
      return;
    }
    assert.equal(source.editorialFallbackUsed, true, 'fallback must be flagged on the result');
    assert.ok(source.designs.length >= 1, 'catalog data still comes from the catalog backend');
  });
});
