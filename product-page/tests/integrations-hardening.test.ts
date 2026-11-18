/**
 * Package C (C-12 + C-08): Nova Poshta resilience & keyCRM webhook hardening tests.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  callNovaPoshta,
  findNovaPoshtaPoints,
  getNovaPoshtaCacheSizeForTests,
  isNovaPoshtaRateLimited,
  isNovaPoshtaUuidRef,
  resetNovaPoshtaStateForTests,
  resolveNovaPoshtaPoint,
} from '../lib/nova-poshta';
import {
  constantTimeSecretEquals,
  extractKeyCrmWebhookSecret,
  resetKeyCrmWebhookRateLimitForTests,
  verifyKeyCrmWebhookAuth,
} from '../lib/keycrm/webhook';
import { POST as keyCrmWebhookPost } from '../app/api/keycrm/webhook/route';

describe('C-12 — Nova Poshta timeouts, bounded cache, rate limit, and error handling', () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.NOVA_POSHTA_API_KEY;

  beforeEach(() => {
    process.env.NOVA_POSHTA_API_KEY = 'test-np-key';
    resetNovaPoshtaStateForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.NOVA_POSHTA_API_KEY;
    else process.env.NOVA_POSHTA_API_KEY = originalKey;
    resetNovaPoshtaStateForTests();
  });

  it('aborts stalled Nova Poshta requests after timeoutMs and throws a clean timeout error', async () => {
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      })) as unknown as typeof fetch;

    await assert.rejects(
      () => callNovaPoshta('getCities', { FindByString: 'Київ' }, { timeoutMs: 25 }),
      /Nova Poshta request timed out/,
    );
  });

  it('handles non-JSON 502/504 gateway errors cleanly without throwing raw SyntaxError', async () => {
    globalThis.fetch = (async () =>
      new Response('<html>502 Bad Gateway</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      })) as unknown as typeof fetch;

    await assert.rejects(
      () => callNovaPoshta('getCities', { FindByString: 'Львів' }),
      /Nova Poshta invalid JSON response \(HTTP 502\)/,
    );
  });

  it('evicts expired and oldest LRU entries when cache exceeds maxCacheEntries', async () => {
    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount += 1;
      return new Response(
        JSON.stringify({ success: true, data: [{ Ref: `ref-${fetchCount}` }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const baseNow = 1_000_000;
    await callNovaPoshta('getCities', { q: '1' }, { maxCacheEntries: 3, now: baseNow });
    await callNovaPoshta('getCities', { q: '2' }, { maxCacheEntries: 3, now: baseNow + 10 });
    await callNovaPoshta('getCities', { q: '3' }, { maxCacheEntries: 3, now: baseNow + 20 });
    assert.equal(getNovaPoshtaCacheSizeForTests(), 3);
    assert.equal(fetchCount, 3);

    // Hit q='1' so it becomes most-recently-used; q='2' is now oldest
    await callNovaPoshta('getCities', { q: '1' }, { maxCacheEntries: 3, now: baseNow + 30 });
    assert.equal(fetchCount, 3);

    // Insert q='4' -> evicts q='2'
    await callNovaPoshta('getCities', { q: '4' }, { maxCacheEntries: 3, now: baseNow + 40 });
    assert.equal(getNovaPoshtaCacheSizeForTests(), 3);
    assert.equal(fetchCount, 4);

    // q='1' is still cached (no new fetch), whereas q='2' was evicted (triggers fetch)
    await callNovaPoshta('getCities', { q: '1' }, { maxCacheEntries: 3, now: baseNow + 50 });
    assert.equal(fetchCount, 4);
    await callNovaPoshta('getCities', { q: '2' }, { maxCacheEntries: 3, now: baseNow + 60 });
    assert.equal(fetchCount, 5);

    // After TTL (5 minutes + 1 ms), cached entry expires and re-fetches
    await callNovaPoshta('getCities', { q: '1' }, { maxCacheEntries: 3, now: baseNow + 5 * 60_000 + 100 });
    assert.equal(fetchCount, 6);
  });

  it('enforces bounded per-IP rate limiting and resets after window expiration', () => {
    const ip = '203.0.113.10';
    const t0 = 5_000_000;
    for (let i = 1; i <= 5; i += 1) {
      assert.equal(isNovaPoshtaRateLimited(ip, t0, 5), false);
    }
    assert.equal(isNovaPoshtaRateLimited(ip, t0, 5), true);
    // After 60s window expires, requests are allowed again
    assert.equal(isNovaPoshtaRateLimited(ip, t0 + 60_001, 5), false);
  });

  it('rejects malformed UUID refs before calling Nova Poshta API and fails closed on checkout verification', async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response('{}', { status: 500 });
    }) as unknown as typeof fetch;

    assert.equal(isNovaPoshtaUuidRef('8d5a980d-391c-11dd-90d9-001a92567626'), true);
    assert.equal(isNovaPoshtaUuidRef('not-a-uuid'), false);

    await assert.rejects(() => findNovaPoshtaPoints('not-a-uuid', 'BRANCH'), /Invalid Nova Poshta cityRef/);
    await assert.rejects(
      () => resolveNovaPoshtaPoint('not-a-uuid', '8d5a980d-391c-11dd-90d9-001a92567626', 'BRANCH'),
      /Delivery point was not found/,
    );
    assert.equal(called, false, 'Upstream API must not be called for invalid UUID refs');
  });
});

describe('C-08 — keyCRM webhook constant-time secret verification & DoS protection', () => {
  const originalSecret = process.env.KEYCRM_WEBHOOK_SECRET;
  const originalStatuses = process.env.KEYCRM_LOYALTY_STATUS_IDS;
  const originalVercelEnv = process.env.VERCEL_ENV;

  beforeEach(() => {
    process.env.KEYCRM_WEBHOOK_SECRET = 'prod-webhook-secret-2026';
    process.env.KEYCRM_LOYALTY_STATUS_IDS = '12,21';
    // Simulate Vercel Production so these cases exercise auth/rate-limit ordering;
    // the non-production fail-closed gate is covered by test:preview-safety.
    process.env.VERCEL_ENV = 'production';
    resetKeyCrmWebhookRateLimitForTests();
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.KEYCRM_WEBHOOK_SECRET;
    else process.env.KEYCRM_WEBHOOK_SECRET = originalSecret;
    if (originalStatuses === undefined) delete process.env.KEYCRM_LOYALTY_STATUS_IDS;
    else process.env.KEYCRM_LOYALTY_STATUS_IDS = originalStatuses;
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
    resetKeyCrmWebhookRateLimitForTests();
  });

  it('compares secrets of arbitrary lengths in constant time via SHA-256 digests', () => {
    assert.equal(constantTimeSecretEquals('prod-webhook-secret-2026', 'prod-webhook-secret-2026'), true);
    assert.equal(constantTimeSecretEquals('a', 'prod-webhook-secret-2026'), false);
    assert.equal(constantTimeSecretEquals('', 'prod-webhook-secret-2026'), false);
    assert.equal(
      constantTimeSecretEquals('prod-webhook-secret-2026-extra-long', 'prod-webhook-secret-2026'),
      false,
    );
  });

  it('extracts secret from query param (existing keyCRM URL) or optional headers', () => {
    const reqQuery = new Request('https://carzo-storefront.vercel.app/api/keycrm/webhook?secret=from-query', {
      method: 'POST',
    });
    assert.equal(extractKeyCrmWebhookSecret(reqQuery), 'from-query');

    const reqHeader = new Request('https://carzo-storefront.vercel.app/api/keycrm/webhook', {
      method: 'POST',
      headers: { 'x-keycrm-secret': 'from-header' },
    });
    assert.equal(extractKeyCrmWebhookSecret(reqHeader), 'from-header');
  });

  it('verifies auth before rate-limiting so unauthenticated floods cannot lock out legitimate keyCRM webhooks', async () => {
    // Send 40 unauthenticated requests from the same IP (exceeding the 30/min unauthorized threshold)
    for (let i = 1; i <= 35; i += 1) {
      const badReq = new Request('https://carzo-storefront.vercel.app/api/keycrm/webhook?secret=wrong', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.77',
        },
        body: 'not-even-valid-json{{{',
      });
      const res = await keyCrmWebhookPost(badReq);
      if (i <= 30) {
        assert.equal(res.status, 401, `Request ${i} should return 401 before parsing invalid JSON`);
      } else {
        assert.equal(res.status, 429, `Request ${i} should be throttled by unauthorized bucket`);
      }
    }

    // Now send a legitimate keyCRM webhook from the exact same IP with the valid query secret:
    // It MUST succeed (HTTP 200), proving unauthenticated floods cannot block legitimate webhooks!
    const validReq = new Request(
      'https://carzo-storefront.vercel.app/api/keycrm/webhook?secret=prod-webhook-secret-2026',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.77',
        },
        body: JSON.stringify({
          event: 'order.change_order_status',
          context: { id: 100, status_id: 1 }, // non-loyalty status -> 200 { skipped: 'status' }
        }),
      },
    );
    const validRes = await keyCrmWebhookPost(validReq);
    assert.equal(validRes.status, 200);
    const payload = (await validRes.json()) as { skipped?: string };
    assert.equal(payload.skipped, 'status');
  });

  it('verifyKeyCrmWebhookAuth returns 503 when not configured and 401 when secret is missing or wrong', () => {
    assert.deepEqual(verifyKeyCrmWebhookAuth('any', {}), {
      ok: false,
      status: 503,
      body: { error: 'not_configured' },
    });
    assert.deepEqual(
      verifyKeyCrmWebhookAuth('wrong', {
        KEYCRM_WEBHOOK_SECRET: 'expected',
        KEYCRM_LOYALTY_STATUS_IDS: '12,21',
      }),
      {
        ok: false,
        status: 401,
        body: { error: 'unauthorized' },
      },
    );
    assert.deepEqual(
      verifyKeyCrmWebhookAuth('expected', {
        KEYCRM_WEBHOOK_SECRET: 'expected',
        KEYCRM_LOYALTY_STATUS_IDS: '12,21',
      }),
      {
        ok: true,
        loyaltyStatusIds: [12, 21],
      },
    );
  });
});
