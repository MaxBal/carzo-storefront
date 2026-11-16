import assert from 'node:assert/strict';
import { it } from 'node:test';
import { callNovaPoshta, resetNovaPoshtaStateForTests } from '../lib/nova-poshta';

it('Nova Poshta deadline covers a stalled response body after headers arrived', async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.NOVA_POSHTA_API_KEY;
  process.env.NOVA_POSHTA_API_KEY = 'synthetic';
  resetNovaPoshtaStateForTests();
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    const body = new ReadableStream({ start(controller) {
      init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')));
    } });
    return new Response(body, { headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const result = await Promise.race([
      callNovaPoshta('getCities', { q: 'synthetic' }, { timeoutMs: 15 }).then(() => 'success', () => 'aborted'),
      new Promise<string>(resolve => setTimeout(() => resolve('deadline-missed'), 100)),
    ]);
    assert.equal(result, 'aborted');
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.NOVA_POSHTA_API_KEY;
    else process.env.NOVA_POSHTA_API_KEY = oldKey;
    resetNovaPoshtaStateForTests();
  }
});
