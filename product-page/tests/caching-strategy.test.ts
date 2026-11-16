/**
 * Package B (NEW-01 + NEW-02 + NEW-07): Next.js caching strategy verification.
 *
 * Verifies:
 * 1. NEW-02: Admin client, checkout attempt probes, customer loyalty lookups,
 *    notification settings, and default `loadCatalogData()` (used by checkout &
 *    cart quoting) strictly enforce `cache: 'no-store'`.
 * 2. NEW-01: Editorial content and public catalog reads (`{ cache: 'revalidate' }`)
 *    use bounded 60s revalidation (`next: { revalidate: 60, tags: [...] }`)
 *    without `cache: 'no-store'` or `cache: 'force-cache'`.
 * 3. NEW-07: Published CMS page reads use `next: { revalidate: 60, tags: ['pages'] }`
 *    without conflicting `cache: 'force-cache'`, preview reads use `cache: 'no-store'`,
 *    and `createSupabasePageRepository()` returns stable `React.cache` references.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  getSupabaseAdminClient,
  resetSupabaseAdminClientForTests,
} from '../lib/supabase/server';
import {
  __CATALOG_CACHE,
  createSupabaseCatalogRepository,
  resetSupabaseCatalogClientForTests,
} from '../lib/data/catalog/supabase';
import {
  __CONTENT_CACHE,
  loadSupabaseAboutSettings,
  loadSupabaseHomepageSettings,
  resetSupabaseContentClientForTests,
} from '../lib/data/content/supabase';
import {
  __PAGE_CACHE,
  createSupabasePageRepository,
  resetSupabasePageClientsForTests,
} from '../lib/data/pages/supabase';
import { createSupabaseOrderRepository } from '../lib/data/orders/supabase';
import { createSupabaseCustomerStore } from '../lib/cart/customer-store/supabase';

interface CapturedFetchCall {
  url: string;
  cache?: RequestCache;
  next?: { revalidate?: number | false; tags?: string[] };
}

describe('Package B — Next.js & Supabase domain caching strategy (NEW-01, NEW-02, NEW-07)', () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalSecret = process.env.SUPABASE_SECRET_KEY;
  let captured: CapturedFetchCall[] = [];

  beforeEach(() => {
    captured = [];
    process.env.SUPABASE_URL = 'http://supabase.invalid';
    process.env.SUPABASE_SECRET_KEY = 'test-secret';
    resetSupabaseAdminClientForTests();
    resetSupabaseCatalogClientForTests();
    resetSupabaseContentClientForTests();
    resetSupabasePageClientsForTests();

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } }) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      captured.push({
        url,
        cache: init?.cache,
        next: init?.next,
      });

      const parsed = new URL(url);
      const table = parsed.pathname.split('/').pop() ?? '';
      if (table === 'orders' || table === 'customers') {
        const accept = new Headers(init?.headers).get('accept') ?? '';
        if (accept.includes('vnd.pgrst.object')) {
          return new Response('null', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      if (table === 'pages') {
        return new Response(
          JSON.stringify([
            {
              id: 'page-1',
              key: 'privacy-policy',
              status: 'published',
              title: 'Політика конфіденційності',
              slug: 'privacy-policy',
              page_type: 'legal',
              seo_title: 'Політика конфіденційності',
              seo_description: 'Опис',
              seo_image_url: null,
              show_header: true,
              show_footer: true,
              no_index: false,
            },
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = originalSecret;
    resetSupabaseAdminClientForTests();
    resetSupabaseCatalogClientForTests();
    resetSupabaseContentClientForTests();
    resetSupabasePageClientsForTests();
  });

  it('NEW-02: getSupabaseAdminClient, checkout order probes, and loyalty customer lookups strictly use cache: "no-store"', async () => {
    await getSupabaseAdminClient().from('notification_settings').select('id').limit(1);
    await createSupabaseOrderRepository().findOrderByAttemptId('11111111-2222-4333-8444-555555555555');
    await createSupabaseCustomerStore(getSupabaseAdminClient).findCustomerByPhone('+380501112233');

    assert.equal(captured.length, 3);
    for (const call of captured) {
      assert.equal(call.cache, 'no-store', `Expected cache: 'no-store' for ${call.url}`);
      assert.equal(call.next, undefined, `Admin/checkout queries must not set next.revalidate (${call.url})`);
    }
  });

  it('NEW-02 vs NEW-01: loadCatalog() defaults to cache: "no-store" for checkout/quotes, and uses 60s revalidation when { cache: "revalidate" } is passed', async () => {
    const repo = createSupabaseCatalogRepository();

    // 1. Default (checkout / cart quote path) -> strict no-store
    await repo.loadCatalog();
    assert.ok(captured.length >= 8);
    for (const call of captured) {
      assert.equal(call.cache, 'no-store', `Default loadCatalog must use no-store (${call.url})`);
      assert.equal(call.next, undefined);
    }

    // 2. Public page path ({ cache: 'revalidate' }) -> bounded 60s revalidation, no no-store or force-cache
    captured = [];
    await repo.loadCatalog({ cache: 'revalidate' });
    assert.ok(captured.length >= 8);
    for (const call of captured) {
      assert.equal(call.cache, undefined, `Revalidating catalog must not set cache (${call.url})`);
      assert.deepEqual(call.next, {
        revalidate: __CATALOG_CACHE.revalidate,
        tags: [...__CATALOG_CACHE.tags],
      });
    }
  });

  it('NEW-01: Editorial content loaders use bounded 60s revalidation without cache: "no-store"', async () => {
    await loadSupabaseHomepageSettings();
    await loadSupabaseAboutSettings();

    assert.equal(captured.length, 2);
    for (const call of captured) {
      assert.equal(call.cache, undefined, `Editorial read must not force no-store outside Draft Mode (${call.url})`);
      assert.deepEqual(call.next, {
        revalidate: __CONTENT_CACHE.revalidate,
        tags: [...__CONTENT_CACHE.tags],
      });
    }
  });

  it('NEW-07: Published CMS page reads use revalidate: 60 without conflicting cache: "force-cache", while preview reads use cache: "no-store"', async () => {
    const repoA = createSupabasePageRepository();
    const repoB = createSupabasePageRepository();

    // Repository and React.cache function references must be stable across calls
    assert.equal(repoA, repoB);
    assert.equal(repoA.getPublishedPage, repoB.getPublishedPage);
    assert.equal(repoA.getPublishedPageSummaries, repoB.getPublishedPageSummaries);

    const published = await repoA.getPublishedPage('privacy-policy');
    assert.ok(published);
    assert.equal(captured.length, 2); // pages + page_blocks
    for (const call of captured) {
      assert.equal(
        call.cache,
        undefined,
        `Published CMS page read must not specify conflicting cache: 'force-cache' (${call.url})`,
      );
      assert.deepEqual(call.next, {
        revalidate: __PAGE_CACHE.revalidate,
        tags: [...__PAGE_CACHE.tags],
      });
    }

    // Preview read -> strict cache: 'no-store'
    captured = [];
    const preview = await repoA.getPreviewPage('page-1');
    assert.ok(preview);
    assert.equal(captured.length, 2);
    for (const call of captured) {
      assert.equal(call.cache, 'no-store', `Preview CMS page read must use cache: 'no-store' (${call.url})`);
      assert.equal(call.next, undefined);
    }
  });
});
