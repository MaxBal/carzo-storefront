import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createKeyCrmOrder, getKeyCrmOrder, KeyCrmApiError } from '../lib/keycrm/client';
import type { KeyCrmOrderPayload } from '../lib/keycrm/types';

const PAYLOAD = {
  source_id: 6,
  source_uuid: 'CZ-20261106-TEST01',
  buyer: { full_name: 'Test', phone: '+380931234567' },
  shipping: { shipping_service: 'Нова Пошта' },
  products: [{ sku: 'M4.0', price: 2249, quantity: 1 }],
} as KeyCrmOrderPayload;

function mockFetch(status: number, body: unknown = { ok: true }) {
  return async () => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('keyCRM API client', () => {
  it('sends authorized JSON and returns the parsed response', async () => {
    let seen: { url?: string; auth?: string; method?: string; body?: string } = {};
    const result = await createKeyCrmOrder(PAYLOAD, {
      apiKey: 'test-key-secret',
      fetchImpl: (async (url: string, init: RequestInit) => {
        seen = {
          url: String(url),
          auth: String((init.headers as Record<string, string>).Authorization),
          method: init.method,
          body: String(init.body),
        };
        return new Response(JSON.stringify({ id: 1 }), { status: 201 });
      }) as typeof fetch,
    });
    assert.deepEqual(result, { id: 1 });
    assert.equal(seen.url, 'https://openapi.keycrm.app/v1/order');
    assert.equal(seen.method, 'POST');
    assert.equal(seen.auth, 'Bearer test-key-secret');
    assert.match(seen.body ?? '', /CZ-20261106-TEST01/);
  });

  it('classifies auth, validation, rate-limit and server errors', async () => {
    for (const [status, code] of [[401, 'UNAUTHORIZED'], [422, 'VALIDATION'], [429, 'RATE_LIMIT'], [500, 'SERVER']] as const) {
      await assert.rejects(
        () => createKeyCrmOrder(PAYLOAD, { apiKey: 'k', fetchImpl: mockFetch(status, { message: 'x' }) as typeof fetch }),
        (error: unknown) => {
          assert.ok(error instanceof KeyCrmApiError);
          assert.equal(error.status, status);
          assert.equal(error.code, code);
          return true;
        },
      );
    }
  });

  it('never exposes the API key in error messages', async () => {
    await assert.rejects(
      () => createKeyCrmOrder(PAYLOAD, {
        apiKey: 'super-secret-key-value',
        fetchImpl: mockFetch(401) as typeof fetch,
      }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message.includes('super-secret-key-value'), false);
        return true;
      },
    );
  });

  it('maps abort to TIMEOUT and network failure to NETWORK', async () => {
    await assert.rejects(
      () => createKeyCrmOrder(PAYLOAD, {
        apiKey: 'k',
        timeoutMs: 5,
        fetchImpl: (async (_url: string, init: RequestInit) => {
          await new Promise((resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
          });
          return new Response('{}');
        }) as typeof fetch,
      }),
      (error: unknown) => error instanceof KeyCrmApiError && error.code === 'TIMEOUT',
    );

    await assert.rejects(
      () => createKeyCrmOrder(PAYLOAD, {
        apiKey: 'k',
        fetchImpl: (async () => { throw new TypeError('fetch failed'); }) as typeof fetch,
      }),
      (error: unknown) => error instanceof KeyCrmApiError && error.code === 'NETWORK',
    );
  });

  it('requires an api key (CONFIG) before any request', async () => {
    await assert.rejects(
      () => createKeyCrmOrder(PAYLOAD, { apiKey: '' }),
      (error: unknown) => error instanceof KeyCrmApiError && error.code === 'CONFIG',
    );
  });

  it('fetches an order with include for the webhook path', async () => {
    let seenUrl = '';
    await getKeyCrmOrder(67526, 'buyer', {
      apiKey: 'k',
      fetchImpl: (async (url: string) => {
        seenUrl = String(url);
        return new Response(JSON.stringify({ id: 67526, status_id: 12 }), { status: 200 });
      }) as typeof fetch,
    });
    assert.equal(seenUrl, 'https://openapi.keycrm.app/v1/order/67526?include=buyer');
  });
});
