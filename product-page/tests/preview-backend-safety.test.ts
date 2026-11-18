import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { assertSafeSupabaseTarget } from '../lib/supabase/environment';
import { createSupabaseAdminClient } from '../lib/supabase/server';
import { createSupabaseOrderRepository } from '../lib/data/orders/supabase';
import { createCustomerStore } from '../lib/cart/customer-store';
import { createDirectusCustomerStore } from '../lib/cart/customer-store/directus';
import { loadSupabaseHomepageSettings } from '../lib/data/content/supabase';
import { createSupabasePageRepository } from '../lib/data/pages/supabase';
import { createKeyCrmOrder } from '../lib/keycrm/client';
import { syncKeyCrmOrder } from '../lib/keycrm/sync';
import { handleKeyCrmOrderStatusWebhook } from '../lib/keycrm/webhook';
import type { OrderSnapshot } from '../lib/data/orders/types';
import type { KeyCrmOrderInput, KeyCrmOrderPayload } from '../lib/keycrm/types';

const productionRef = 'kmhegysmtsjqtwwaacht';
const productionUrl = `https://${productionRef}.supabase.co`;
const testRef = 'synthetictestproject';
const testUrl = `https://${testRef}.supabase.co`;

describe('Supabase target policy', () => {
  for (const VERCEL_ENV of ['preview', 'development', 'staging', undefined]) {
    it(`rejects Production and unconfigured remote targets in ${VERCEL_ENV}`, () => {
      assert.throws(() => assertSafeSupabaseTarget(productionUrl, { VERCEL_ENV }));
      assert.throws(() => assertSafeSupabaseTarget(productionUrl, { VERCEL_ENV, SUPABASE_PREVIEW_PROJECT_REF: productionRef }));
      assert.throws(() => assertSafeSupabaseTarget(testUrl, { VERCEL_ENV }));
      assert.doesNotThrow(() => assertSafeSupabaseTarget(testUrl, { VERCEL_ENV, SUPABASE_PREVIEW_PROJECT_REF: testRef }));
    });
  }
  it('allows loopback only in local runtime and does not infer Production from NODE_ENV', () => {
    for (const url of ['http://localhost:54321', 'http://127.0.0.1:4320', 'http://[::1]:54321']) {
      assert.doesNotThrow(() => assertSafeSupabaseTarget(url, {}));
      assert.throws(() => assertSafeSupabaseTarget(url, { VERCEL: '1' }));
      assert.throws(() => assertSafeSupabaseTarget(url, { VERCEL_ENV: 'preview' }));
    }
    assert.throws(() => assertSafeSupabaseTarget(productionUrl, { NODE_ENV: 'production' }));
  });
  it('rejects lookalike hosts, credentials, paths, queries and non-HTTPS remote URLs', () => {
    for (const url of [`${testUrl}.evil.invalid`, `${testUrl}/proxy`, `${testUrl}?target=prod`,
      `${testUrl}#fragment`, `https://user:pass@${testRef}.supabase.co`, testUrl.replace('https:', 'http:'), 'invalid']) {
      assert.throws(() => assertSafeSupabaseTarget(url, { SUPABASE_PREVIEW_PROJECT_REF: testRef }));
    }
  });
  it('preserves Production configuration without connecting', () => {
    assert.doesNotThrow(() => assertSafeSupabaseTarget(productionUrl, { VERCEL_ENV: 'production' }));
  });
  it('allows the exact shared project only with an explicit Preview opt-in and matching ref', () => {
    const env = { VERCEL_ENV: 'preview', SUPABASE_PREVIEW_PROJECT_REF: productionRef,
      SUPABASE_ALLOW_SHARED_PREVIEW: 'true' };
    assert.doesNotThrow(() => assertSafeSupabaseTarget(productionUrl, env));
    for (const SUPABASE_ALLOW_SHARED_PREVIEW of [undefined, '', 'false', '1', 'TRUE']) {
      assert.throws(() => assertSafeSupabaseTarget(productionUrl, { ...env, SUPABASE_ALLOW_SHARED_PREVIEW }));
    }
    for (const VERCEL_ENV of ['development', 'staging', undefined]) {
      assert.throws(() => assertSafeSupabaseTarget(productionUrl, { ...env, VERCEL_ENV }));
    }
    for (const SUPABASE_PREVIEW_PROJECT_REF of [undefined, '', testRef]) {
      assert.throws(() => assertSafeSupabaseTarget(productionUrl, { ...env, SUPABASE_PREVIEW_PROJECT_REF }));
    }
    for (const url of [`${productionUrl}.evil.invalid`, `${productionUrl}/proxy`, `${productionUrl}?x=1`,
      `${productionUrl}#fragment`, `https://user:pass@${productionRef}.supabase.co`,
      productionUrl.replace('https:', 'http:'), productionUrl.replace('.co', '.co:8443')]) {
      assert.throws(() => assertSafeSupabaseTarget(url, env));
    }
  });
});

describe('non-production backend boundaries with accidental credentials', () => {
  const keys = ['VERCEL_ENV', 'VERCEL', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_PREVIEW_PROJECT_REF',
    'SUPABASE_ALLOW_SHARED_PREVIEW', 'DIRECTUS_URL', 'DIRECTUS_READ_TOKEN'] as const;
  let saved: Array<string | undefined>;
  let originalFetch: typeof fetch;
  let requests: number;
  let expectedRequests: number;
  beforeEach(() => {
    saved = keys.map(key => process.env[key]);
    originalFetch = globalThis.fetch;
    requests = 0;
    expectedRequests = 0;
    delete process.env.SUPABASE_ALLOW_SHARED_PREVIEW;
    process.env.VERCEL_ENV = 'preview';
    process.env.SUPABASE_URL = productionUrl;
    process.env.SUPABASE_SECRET_KEY = 'synthetic-only';
    // Explicitly mislabelling the working project must still fail closed.
    process.env.SUPABASE_PREVIEW_PROJECT_REF = productionRef;
    process.env.DIRECTUS_URL = 'https://directus.invalid';
    process.env.DIRECTUS_READ_TOKEN = 'synthetic-only';
    globalThis.fetch = async () => { requests += 1; throw new Error('unexpected network call'); };
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    keys.forEach((key, i) => {
      if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i];
    });
    assert.equal(requests, expectedRequests, 'only explicitly expected synthetic requests may pass');
  });
  it('blocks admin client, order RPC and Supabase customer lookup/upsert before network', async () => {
    assert.throws(() => createSupabaseAdminClient(), /disabled outside/);
    await assert.rejects(() => createSupabaseOrderRepository().createOrder({ checkoutAttemptId: 'synthetic' } as OrderSnapshot), /disabled outside/);
    const customers = createCustomerStore('supabase');
    await assert.rejects(() => customers.findCustomerByPhone('+380501112233'), /disabled outside/);
    await assert.rejects(() => customers.upsertCustomerByPhone({ phone: '+380501112233' }), /disabled outside/);
  });
  it('covers separate editorial and pages clients, including draft reads', async () => {
    await assert.rejects(() => loadSupabaseHomepageSettings(), /disabled outside/);
    const pages = createSupabasePageRepository();
    assert.equal(await pages.getPublishedPage('synthetic'), null);
    assert.deepEqual(await pages.getPublishedPageSummaries(), []);
    assert.equal(await pages.getPreviewPage('synthetic'), null);
  });
  it('blocks both Directus customer POST and registry PATCH paths before any reads', async () => {
    const customers = createDirectusCustomerStore();
    await assert.rejects(() => customers.findCustomerByPhone('+380501112233'), /disabled outside/);
    await assert.rejects(() => customers.upsertCustomerByPhone({ phone: '+380501112233' }), /disabled outside/);
  });
  it('allows an explicitly selected isolated client to initialize without a request', () => {
    process.env.SUPABASE_URL = testUrl;
    process.env.SUPABASE_PREVIEW_PROJECT_REF = testRef;
    assert.ok(createSupabaseAdminClient());
  });
  for (const VERCEL_ENV of ['preview', 'development', 'staging', undefined]) {
    it(`blocks keyCRM sync, direct create and valid webhook in ${VERCEL_ENV}`, async () => {
      let called = 0;
      const env = { NODE_ENV: 'test', VERCEL_ENV, SUPABASE_ALLOW_SHARED_PREVIEW: 'true',
        KEYCRM_SYNC_ENABLED: 'true', KEYCRM_API_KEY: 'synthetic',
        KEYCRM_SOURCE_ID: '1', KEYCRM_DELIVERY_SERVICE_ID: '1', KEYCRM_WEBHOOK_SECRET: 'synthetic',
        KEYCRM_LOYALTY_STATUS_IDS: '21' } as NodeJS.ProcessEnv;
      const fetchImpl: typeof fetch = async () => { called += 1; throw new Error('unexpected CRM call'); };
      await assert.rejects(() => createKeyCrmOrder({} as KeyCrmOrderPayload, { env, apiKey: 'synthetic', fetchImpl }), /disabled outside/);
      assert.equal(await syncKeyCrmOrder({} as KeyCrmOrderInput, { env, fetchImpl }), 'disabled');
      const result = await handleKeyCrmOrderStatusWebhook(
        { event: 'order.change_order_status', context: { id: 1, status_id: 21 } }, 'synthetic',
        { env, getOrder: async () => { called += 1; throw new Error('unexpected read'); },
          upsertCustomer: async () => { called += 1; } },
      );
      assert.deepEqual(result, { status: 503, body: { error: 'disabled_environment' } });
      assert.equal(called, 0);
    });
  }
  it('allows shared client RPC and customer POST only after opt-in (mock fetch)', async () => {
    process.env.SUPABASE_ALLOW_SHARED_PREVIEW = 'true';
    expectedRequests = 2;
    const paths: string[] = [];
    globalThis.fetch = async (input, init) => {
      requests += 1;
      const url = new URL(String(input));
      assert.equal(url.origin, productionUrl);
      assert.equal(init?.method, 'POST');
      paths.push(url.pathname);
      return new Response(JSON.stringify({ id: 'synthetic', created: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    };
    // Use an uncached client: runtime env switching is a test fixture only.
    const client = createSupabaseAdminClient();
    assert.equal((await client.rpc('create_order_with_items', {})).error, null);
    assert.equal((await client.from('customers').insert({ phone: '+380501112233' })).error, null);
    assert.deepEqual(paths, ['/rest/v1/rpc/create_order_with_items', '/rest/v1/customers']);
  });
  it('routes allowed Preview order/customer writes only to the isolated project (mock fetch)', async () => {
    process.env.SUPABASE_URL = testUrl;
    process.env.SUPABASE_PREVIEW_PROJECT_REF = testRef;
    expectedRequests = 2;
    const paths: string[] = [];
    globalThis.fetch = async (input, init) => {
      requests += 1;
      const url = new URL(String(input));
      assert.equal(url.origin, testUrl);
      assert.equal(init?.method, 'POST');
      paths.push(url.pathname);
      const data = url.pathname.endsWith('/customers')
        ? [{ phone: '+380501112233' }]
        : { id: 'synthetic', order_number: 'CZ-SYNTHETIC', total: 100, created: true };
      return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
    };
    const result = await createSupabaseOrderRepository().createOrder({
      checkoutAttemptId: 'synthetic', loyalty: {}, items: [],
    } as unknown as OrderSnapshot);
    assert.equal(result.created, true);
    const customer = await createCustomerStore('supabase').upsertCustomerByPhone({ phone: '+380501112233' });
    assert.equal(customer?.phone, '+380501112233');
    assert.deepEqual(paths, ['/rest/v1/rpc/create_order_with_items', '/rest/v1/customers']);
  });
});
