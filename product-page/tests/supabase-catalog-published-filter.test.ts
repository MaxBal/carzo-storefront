/**
 * C-07: discount_tiers must be queried with status='published' only.
 * Fake PostgREST over global fetch — no live DB, no writes.
 *
 * Run: pnpm run test:audit-fixes
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { createSupabaseCatalogRepository } from '../lib/data/catalog/supabase';

type FixtureRows = Record<string, Record<string, unknown>[]>;

const fixtures: FixtureRows = {
  designs: [],
  sizes: [],
  brands: [],
  fixations: [],
  fixation_size_extras: [],
  variants: [],
  discount_tiers: [
    { key: 'qty-2', min_quantity: 2, amount: 100, sort: 1, status: 'published' },
    { key: 'qty-draft', min_quantity: 5, amount: 500, sort: 2, status: 'draft' },
    { key: 'qty-archived', min_quantity: 10, amount: 900, sort: 3, status: 'archived' },
  ],
  site_settings: [],
};

const requestedUrls: string[] = [];

function fakeFetch(input: RequestInfo | URL): Promise<Response> {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  requestedUrls.push(url);
  const parsed = new URL(url);
  const table = parsed.pathname.split('/').pop() ?? '';
  let rows = fixtures[table] ?? [];
  // Emulate PostgREST eq filters: ?status=eq.published etc.
  parsed.searchParams.forEach((raw, column) => {
    if (column === 'select') return;
    const match = /^eq\.(.*)$/.exec(raw);
    if (match) {
      const expected = match[1];
      rows = rows.filter(row => String(row[column]) === expected);
    }
  });
  return Promise.resolve(
    new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('C-07 discount_tiers published filter (mock PostgREST, no DB)', () => {
  let tierKeys: string[];

  before(async () => {
    process.env.SUPABASE_URL = 'http://supabase.invalid';
    process.env.SUPABASE_SECRET_KEY = 'test-secret';
    globalThis.fetch = fakeFetch as unknown as typeof fetch;

    const catalog = await createSupabaseCatalogRepository().loadCatalog();
    tierKeys = catalog.discountTiers.map(tier => tier.key);
  });

  it('requests discount_tiers with status=eq.published', () => {
    const request = requestedUrls.find(url => url.includes('/discount_tiers'));
    assert.ok(request, 'discount_tiers select was issued');
    assert.ok(
      request.includes('status=eq.published'),
      `expected status=eq.published in ${request}`,
    );
  });

  it('excludes draft and archived tiers from the mapped catalog', () => {
    assert.deepEqual(tierKeys, ['qty-2']);
    assert.ok(!tierKeys.includes('qty-draft'), 'draft tier must be excluded');
    assert.ok(!tierKeys.includes('qty-archived'), 'archived tier must be excluded');
  });

  it('keeps the published filter on the other status-bearing catalog tables', () => {
    for (const table of ['designs', 'sizes', 'brands', 'fixations', 'variants']) {
      const request = requestedUrls.find(url => url.includes(`/${table}?`));
      assert.ok(request, `${table} select was issued`);
      assert.ok(
        request.includes('status=eq.published'),
        `expected status=eq.published for ${table} in ${request}`,
      );
    }
    // Tables without a status column must stay unfiltered.
    const extras = requestedUrls.find(url => url.includes('/fixation_size_extras?'));
    assert.ok(extras && !extras.includes('status='), 'fixation_size_extras stays unfiltered');
    const settings = requestedUrls.find(url => url.includes('/site_settings?'));
    assert.ok(settings && !settings.includes('status='), 'site_settings stays unfiltered');
  });
});
