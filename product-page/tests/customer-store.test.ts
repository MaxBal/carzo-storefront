import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { maskPhone, normalizeCustomerPhone } from '../lib/cart/customer-phone';
import { resolveCustomerStoreBackend } from '../lib/cart/customer-store/config';
import { createDirectusCustomerStore } from '../lib/cart/customer-store/directus';
import {
  buildExistingCustomerUpdate,
  buildNewCustomerRow,
  normalizeFullName,
} from '../lib/cart/customer-store/merge';
import { createSupabaseCustomerStore } from '../lib/cart/customer-store/supabase';
import {
  CustomerStoreError,
  type CustomerRecord,
  type CustomerStore,
  type UpsertCustomerInput,
} from '../lib/cart/customer-store/types';

describe('normalizeCustomerPhone', () => {
  it('accepts supported Ukrainian representations', () => {
    assert.equal(normalizeCustomerPhone('+380931234567'), '+380931234567');
    assert.equal(normalizeCustomerPhone('380931234567'), '+380931234567');
    assert.equal(normalizeCustomerPhone('0931234567'), '+380931234567');
    assert.equal(normalizeCustomerPhone('931234567'), '+380931234567');
    assert.equal(normalizeCustomerPhone('+38 (093) 123-45-67'), '+380931234567');
    assert.equal(normalizeCustomerPhone('380 93 123 45 67'), '+380931234567');
    assert.equal(normalizeCustomerPhone('(093) 123-45-67'), '+380931234567');
  });

  it('rejects invalid and garbage input', () => {
    assert.equal(normalizeCustomerPhone(''), null);
    assert.equal(normalizeCustomerPhone('   '), null);
    assert.equal(normalizeCustomerPhone('abc'), null);
    assert.equal(normalizeCustomerPhone('12'), null);
    assert.equal(normalizeCustomerPhone('123'), null);
    assert.equal(normalizeCustomerPhone(null), null);
    assert.equal(normalizeCustomerPhone(undefined), null);
  });

  it('rejects foreign and ambiguous numbers with extra digits', () => {
    // Non-380 international.
    assert.equal(normalizeCustomerPhone('+15551234567'), null);
    assert.equal(normalizeCustomerPhone('+7931234567'), null);
    assert.equal(normalizeCustomerPhone('+441234567890'), null);
    // Canonical Ukrainian + extra trailing digit.
    assert.equal(normalizeCustomerPhone('3809312345678'), null);
    assert.equal(normalizeCustomerPhone('+3809312345678'), null);
    // Extra leading digits before 380.
    assert.equal(normalizeCustomerPhone('1380931234567'), null);
    assert.equal(normalizeCustomerPhone('01380931234567890'), null);
    // Long arbitrary numeric input must not become a UA number via last-9 slice.
    assert.equal(normalizeCustomerPhone('12345678901234567890'), null);
    assert.equal(normalizeCustomerPhone('9999999999999999999'), null);
    // Too short.
    assert.equal(normalizeCustomerPhone('3809312345'), null);
    assert.equal(normalizeCustomerPhone('09312345'), null);
  });

  it('masks phones for diagnostics', () => {
    assert.equal(maskPhone('+380931234567'), '+38***67');
  });
});

describe('resolveCustomerStoreBackend', () => {
  it('defaults to directus when unset', () => {
    assert.equal(resolveCustomerStoreBackend({}), 'directus');
    assert.equal(resolveCustomerStoreBackend({ CUSTOMER_STORE: '' }), 'directus');
    assert.equal(resolveCustomerStoreBackend({ CUSTOMER_STORE: '   ' }), 'directus');
  });

  it('selects an explicit backend', () => {
    assert.equal(resolveCustomerStoreBackend({ CUSTOMER_STORE: 'directus' }), 'directus');
    assert.equal(resolveCustomerStoreBackend({ CUSTOMER_STORE: 'supabase' }), 'supabase');
    assert.equal(resolveCustomerStoreBackend({ CUSTOMER_STORE: 'SUPABASE' }), 'supabase');
  });

  it('fails fast on invalid values', () => {
    assert.throws(
      () => resolveCustomerStoreBackend({ CUSTOMER_STORE: 'json' }),
      (err: unknown) => err instanceof CustomerStoreError && err.code === 'CONFIG',
    );
    assert.throws(
      () => resolveCustomerStoreBackend({ CUSTOMER_STORE: 'both' }),
      (err: unknown) => err instanceof CustomerStoreError && err.code === 'CONFIG',
    );
  });
});

describe('merge policy helpers', () => {
  it('treats empty names as null', () => {
    assert.equal(normalizeFullName('  '), null);
    assert.equal(normalizeFullName(''), null);
    assert.equal(normalizeFullName(null), null);
    assert.equal(normalizeFullName('  Олена  '), 'Олена');
  });

  it('builds new site customers with site provenance', () => {
    const row = buildNewCustomerRow('+380931234567', {
      phone: '+380931234567',
      fullName: '  Олена ',
      source: 'site',
      imported: false,
    });
    assert.deepEqual(row, {
      phone: '+380931234567',
      full_name: 'Олена',
      source: 'site',
      imported: false,
    });
  });

  it('defaults source to site and imported to false for new storefront rows', () => {
    const row = buildNewCustomerRow('+380931234567', { phone: '+380931234567' });
    assert.equal(row.source, 'site');
    assert.equal(row.imported, false);
    assert.equal(row.full_name, null);
  });

  it('never puts provenance/legacy fields into existing-customer updates', () => {
    const update = buildExistingCustomerUpdate(
      { phone: '+380931234567', fullName: 'Нове Імʼя', source: 'site', imported: false },
      '2026-10-02T00:00:00.000Z',
    );
    assert.deepEqual(update, {
      full_name: 'Нове Імʼя',
      updated_at: '2026-10-02T00:00:00.000Z',
    });
    assert.ok(update);
    assert.equal('source' in update, false);
    assert.equal('imported' in update, false);
    assert.equal('legacy_orders_count' in update, false);
    assert.equal('legacy_products_count' in update, false);
    assert.equal('legacy_city' in update, false);
    assert.equal('legacy_delivery' in update, false);
    assert.equal('created_at' in update, false);
    assert.equal('phone' in update, false);
  });

  it('does not schedule an update when the new name is empty', () => {
    assert.equal(
      buildExistingCustomerUpdate({ phone: '+380931234567', fullName: '   ' }, '2026-10-02T00:00:00.000Z'),
      null,
    );
    assert.equal(
      buildExistingCustomerUpdate({ phone: '+380931234567' }, '2026-10-02T00:00:00.000Z'),
      null,
    );
  });
});

// ---------------------------------------------------------------------------
// Supabase adapter (mock client — no live writes)
// ---------------------------------------------------------------------------

type SupabaseResult = { data: unknown; error: { message: string } | null };

type MockSupabaseCall = {
  method: 'select' | 'upsert' | 'update';
  table: string;
  payload?: unknown;
  phone?: string;
};

function createMockSupabaseClient(handlers: {
  select?: (phone: string) => SupabaseResult;
  upsert?: (row: Record<string, unknown>) => SupabaseResult;
  update?: (fields: Record<string, unknown>, phone: string) => SupabaseResult;
}) {
  const calls: MockSupabaseCall[] = [];

  function from(table: string) {
    return {
      select(_cols: string) {
        return {
          eq(_col: string, value: string) {
            return {
              async maybeSingle(): Promise<SupabaseResult> {
                calls.push({ method: 'select', table, phone: value });
                return handlers.select?.(value) ?? { data: null, error: null };
              },
            };
          },
        };
      },
      upsert(row: Record<string, unknown>, _opts?: unknown) {
        calls.push({ method: 'upsert', table, payload: row });
        return {
          select(_cols: string) {
            return Promise.resolve(
              handlers.upsert?.(row) ?? { data: [{ phone: row.phone }], error: null },
            );
          },
        };
      },
      update(fields: Record<string, unknown>) {
        return {
          eq(_col: string, value: string) {
            calls.push({ method: 'update', table, payload: fields, phone: value });
            return Promise.resolve(
              handlers.update?.(fields, value) ?? { data: null, error: null },
            );
          },
        };
      },
    };
  }

  return { client: { from } as never, calls };
}

describe('Supabase adapter', () => {
  it('lookup found', async () => {
    const mock = createMockSupabaseClient({
      select: () => ({ data: { phone: '+380931234567' }, error: null }),
    });
    const store = createSupabaseCustomerStore(() => mock.client);
    const found = await store.findCustomerByPhone('0931234567');
    assert.deepEqual(found, { phone: '+380931234567' });
  });

  it('lookup missing returns null', async () => {
    const mock = createMockSupabaseClient({
      select: () => ({ data: null, error: null }),
    });
    const store = createSupabaseCustomerStore(() => mock.client);
    assert.equal(await store.findCustomerByPhone('+380931234567'), null);
  });

  it('lookup backend error is not treated as missing', async () => {
    const mock = createMockSupabaseClient({
      select: () => ({ data: null, error: { message: 'connection refused' } }),
    });
    const store = createSupabaseCustomerStore(() => mock.client);
    await assert.rejects(
      () => store.findCustomerByPhone('+380931234567'),
      (err: unknown) => err instanceof CustomerStoreError && err.code === 'UNAVAILABLE',
    );
  });

  it('creates a new site customer with canonical phone, source=site, imported=false', async () => {
    const mock = createMockSupabaseClient({
      upsert: (row) => ({ data: [{ phone: row.phone }], error: null }),
    });
    const store = createSupabaseCustomerStore(() => mock.client);
    const created = await store.upsertCustomerByPhone({
      phone: '0931234567',
      fullName: '  Олена ',
      source: 'site',
      imported: false,
    });

    assert.deepEqual(created, {
      phone: '+380931234567',
      full_name: 'Олена',
      source: 'site',
      imported: false,
    });
    const upsertCall = mock.calls.find((c) => c.method === 'upsert');
    assert.ok(upsertCall);
    assert.deepEqual(upsertCall.payload, {
      phone: '+380931234567',
      full_name: 'Олена',
      source: 'site',
      imported: false,
    });
  });

  it('duplicate/existing customer takes the merge path and keeps provenance', async () => {
    const updates: Array<Record<string, unknown>> = [];
    const mock = createMockSupabaseClient({
      upsert: () => ({ data: [], error: null }), // conflict → already exists
      update: (fields) => {
        updates.push(fields);
        return { data: null, error: null };
      },
    });
    const store = createSupabaseCustomerStore(() => mock.client);

    const after = await store.upsertCustomerByPhone({
      phone: '+380931234567',
      fullName: 'Нове Імʼя',
      source: 'site',
      imported: false,
    });

    assert.equal(after?.phone, '+380931234567');
    assert.equal(after?.full_name, 'Нове Імʼя');
    assert.equal(updates.length, 1);
    // Only allowed fields may be sent in UPDATE.
    const keys = Object.keys(updates[0]).sort();
    assert.deepEqual(keys, ['full_name', 'updated_at']);
    assert.equal('source' in updates[0], false);
    assert.equal('imported' in updates[0], false);
    assert.equal('legacy_orders_count' in updates[0], false);
    assert.equal('legacy_products_count' in updates[0], false);
    assert.equal('legacy_city' in updates[0], false);
    assert.equal('legacy_delivery' in updates[0], false);
    assert.equal('created_at' in updates[0], false);
    assert.equal('phone' in updates[0], false);
  });

  it('empty name does not schedule a destructive update', async () => {
    const mock = createMockSupabaseClient({
      upsert: () => ({ data: [], error: null }),
      update: () => {
        throw new Error('update must not run for empty fullName');
      },
    });
    const store = createSupabaseCustomerStore(() => mock.client);
    const after = await store.upsertCustomerByPhone({
      phone: '+380931234567',
      fullName: '   ',
    });
    assert.deepEqual(after, { phone: '+380931234567' });
    assert.equal(mock.calls.filter((c) => c.method === 'update').length, 0);
  });

  it('insert write failure throws WRITE_FAILED', async () => {
    const mock = createMockSupabaseClient({
      upsert: () => ({ data: null, error: { message: 'permission denied' } }),
    });
    const store = createSupabaseCustomerStore(() => mock.client);
    await assert.rejects(
      () => store.upsertCustomerByPhone({ phone: '+380931234567', fullName: 'Олена' }),
      (err: unknown) => err instanceof CustomerStoreError && err.code === 'WRITE_FAILED',
    );
  });

  it('update write failure throws WRITE_FAILED', async () => {
    const mock = createMockSupabaseClient({
      upsert: () => ({ data: [], error: null }),
      update: () => ({ data: null, error: { message: 'statement timeout' } }),
    });
    const store = createSupabaseCustomerStore(() => mock.client);
    await assert.rejects(
      () => store.upsertCustomerByPhone({ phone: '+380931234567', fullName: 'Олена' }),
      (err: unknown) => err instanceof CustomerStoreError && err.code === 'WRITE_FAILED',
    );
  });

  it('unique-violation insert error falls through to merge path', async () => {
    const updates: Array<Record<string, unknown>> = [];
    const mock = createMockSupabaseClient({
      upsert: () => ({ data: null, error: { message: 'duplicate key value violates unique constraint' } }),
      update: (fields) => {
        updates.push(fields);
        return { data: null, error: null };
      },
    });
    const store = createSupabaseCustomerStore(() => mock.client);
    const after = await store.upsertCustomerByPhone({
      phone: '+380931234567',
      fullName: 'Олена',
    });
    assert.equal(after?.full_name, 'Олена');
    assert.equal(updates.length, 1);
    assert.deepEqual(Object.keys(updates[0]).sort(), ['full_name', 'updated_at']);
  });
});

// ---------------------------------------------------------------------------
// Directus adapter write-path (mock fetch — no live Directus)
// ---------------------------------------------------------------------------

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Directus adapter write validation', () => {
  const originalEnv = {
    DIRECTUS_URL: process.env.DIRECTUS_URL,
    DIRECTUS_READ_TOKEN: process.env.DIRECTUS_READ_TOKEN,
  };

  function withDirectusEnv(fn: () => Promise<void>): Promise<void> {
    process.env.DIRECTUS_URL = 'https://directus.test';
    process.env.DIRECTUS_READ_TOKEN = 'test-token';
    return fn().finally(() => {
      if (originalEnv.DIRECTUS_URL === undefined) delete process.env.DIRECTUS_URL;
      else process.env.DIRECTUS_URL = originalEnv.DIRECTUS_URL;
      if (originalEnv.DIRECTUS_READ_TOKEN === undefined) delete process.env.DIRECTUS_READ_TOKEN;
      else process.env.DIRECTUS_READ_TOKEN = originalEnv.DIRECTUS_READ_TOKEN;
    });
  }

  it('registry PATCH 2xx reports success', async () => {
    await withDirectusEnv(async () => {
      const calls: Array<{ url: string; method: string; body?: unknown }> = [];
      const store = createDirectusCustomerStore({
        fetch: async (input, init) => {
          const url = String(input);
          const method = init?.method ?? 'GET';
          calls.push({ url, method, body: init?.body });
          if (method === 'GET' && url.includes('/items/customers?limit=1')) {
            return jsonResponse(200, { data: [] });
          }
          if (method === 'GET' && url.includes('/items/customers?limit=-1')) {
            return jsonResponse(200, { data: [] });
          }
          if (method === 'GET' && url.includes('/items/carzo_site_settings')) {
            return jsonResponse(200, { data: { customers: [] } });
          }
          if (method === 'POST' && url.includes('/items/customers')) {
            return jsonResponse(404, {});
          }
          if (method === 'PATCH') {
            return jsonResponse(200, { data: { customers: [] } });
          }
          return jsonResponse(500, {});
        },
      });

      const result = await store.upsertCustomerByPhone({
        phone: '+380931234567',
        fullName: 'Олена',
      });
      assert.equal(result?.phone, '+380931234567');
      assert.ok(calls.some((c) => c.method === 'PATCH'));
    });
  });

  it('registry PATCH 403 throws WRITE_FAILED and does not return a customer', async () => {
    await withDirectusEnv(async () => {
      const store = createDirectusCustomerStore({
        fetch: async (input, init) => {
          const url = String(input);
          const method = init?.method ?? 'GET';
          if (method === 'GET' && url.includes('/items/customers?limit=1')) {
            return jsonResponse(200, { data: [] });
          }
          if (method === 'GET' && url.includes('/items/customers?limit=-1')) {
            return jsonResponse(200, { data: [] });
          }
          if (method === 'GET' && url.includes('/items/carzo_site_settings')) {
            return jsonResponse(200, { data: { customers: [] } });
          }
          if (method === 'POST') {
            return jsonResponse(404, {});
          }
          if (method === 'PATCH') {
            return jsonResponse(403, {});
          }
          return jsonResponse(500, {});
        },
      });

      await assert.rejects(
        () => store.upsertCustomerByPhone({ phone: '+380931234567', fullName: 'Олена' }),
        (err: unknown) => err instanceof CustomerStoreError && err.code === 'WRITE_FAILED',
      );
    });
  });

  it('registry PATCH 500 throws WRITE_FAILED', async () => {
    await withDirectusEnv(async () => {
      const store = createDirectusCustomerStore({
        fetch: async (input, init) => {
          const url = String(input);
          const method = init?.method ?? 'GET';
          if (method === 'GET' && url.includes('/items/customers?limit=1')) {
            return jsonResponse(200, { data: [] });
          }
          if (method === 'GET' && url.includes('/items/customers?limit=-1')) {
            return jsonResponse(200, { data: [] });
          }
          if (method === 'GET' && url.includes('/items/carzo_site_settings')) {
            return jsonResponse(200, { data: { customers: [] } });
          }
          if (method === 'POST') {
            return jsonResponse(404, {});
          }
          return jsonResponse(500, {});
        },
      });

      await assert.rejects(
        () => store.upsertCustomerByPhone({ phone: '+380931234567', fullName: 'Олена' }),
        (err: unknown) => err instanceof CustomerStoreError && err.code === 'WRITE_FAILED',
      );
    });
  });

  it('collection POST 2xx returns the created customer without registry write', async () => {
    await withDirectusEnv(async () => {
      let patched = false;
      const store = createDirectusCustomerStore({
        fetch: async (input, init) => {
          const url = String(input);
          const method = init?.method ?? 'GET';
          if (method === 'GET' && url.includes('/items/customers?limit=1')) {
            return jsonResponse(200, { data: [] });
          }
          if (method === 'POST' && url.includes('/items/customers')) {
            return jsonResponse(200, {
              data: {
                phone: '+380931234567',
                full_name: 'Олена',
                source: 'site',
                imported: false,
              },
            });
          }
          if (method === 'PATCH') {
            patched = true;
            return jsonResponse(200, {});
          }
          return jsonResponse(500, {});
        },
      });

      const result = await store.upsertCustomerByPhone({
        phone: '+380931234567',
        fullName: 'Олена',
      });
      assert.equal(result?.phone, '+380931234567');
      assert.equal(patched, false);
    });
  });
});

// ---------------------------------------------------------------------------
// In-memory store semantics (kept from PHASE 4A)
// ---------------------------------------------------------------------------

function createMemoryCustomerStore(options?: {
  onFind?: () => void;
  onUpsert?: (input: UpsertCustomerInput) => void;
}): CustomerStore {
  const rows = new Map<string, CustomerRecord>();

  return {
    async findCustomerByPhone(rawPhone) {
      options?.onFind?.();
      const phone = normalizeCustomerPhone(rawPhone);
      if (!phone) return null;
      return rows.get(phone) ?? null;
    },
    async upsertCustomerByPhone(input) {
      options?.onUpsert?.(input);
      const phone = normalizeCustomerPhone(input.phone);
      if (!phone) return null;

      const existing = rows.get(phone);
      if (existing) {
        const update = buildExistingCustomerUpdate(input, 'now');
        if (update) {
          rows.set(phone, { ...existing, full_name: update.full_name });
        }
        return rows.get(phone) ?? null;
      }

      const created = buildNewCustomerRow(phone, input);
      rows.set(phone, created);
      return created;
    },
  };
}

describe('lookup semantics', () => {
  it('returns a record when the customer exists', async () => {
    const store = createMemoryCustomerStore();
    await store.upsertCustomerByPhone({ phone: '+380931234567', fullName: 'Олена' });
    const found = await store.findCustomerByPhone('+380931234567');
    assert.ok(found);
    assert.equal(found.phone, '+380931234567');
  });

  it('returns null when the customer is missing', async () => {
    const store = createMemoryCustomerStore();
    assert.equal(await store.findCustomerByPhone('+380931234567'), null);
  });

  it('propagates backend failure instead of treating it as missing', async () => {
    const store = createMemoryCustomerStore({
      onFind() {
        throw new CustomerStoreError('Customer lookup failed', 'UNAVAILABLE');
      },
    });
    await assert.rejects(
      () => store.findCustomerByPhone('+380931234567'),
      (err: unknown) => err instanceof CustomerStoreError && err.code === 'UNAVAILABLE',
    );
  });
});

describe('registration merge policy (in-memory mirror of adapter rules)', () => {
  it('creates a new site customer with source=site and imported=false', async () => {
    const store = createMemoryCustomerStore();
    const created = await store.upsertCustomerByPhone({
      phone: '0931234567',
      fullName: 'Олена',
      source: 'site',
      imported: false,
    });
    assert.deepEqual(created, {
      phone: '+380931234567',
      full_name: 'Олена',
      source: 'site',
      imported: false,
    });
  });

  it('preserves imported provenance and legacy metadata on site upsert', async () => {
    const store = createMemoryCustomerStore();
    await store.upsertCustomerByPhone({
      phone: '+380931234567',
      fullName: 'Імпорт',
      source: 'keycrm,wrike',
      imported: true,
    });

    const existing = await store.findCustomerByPhone('+380931234567');
    assert.ok(existing);
    existing.source = 'keycrm,wrike';
    existing.imported = true;
    existing.legacy_orders_count = 4;
    existing.legacy_products_count = 9;
    existing.legacy_city = 'Київ';
    existing.legacy_delivery = 'Нова пошта';

    const after = await store.upsertCustomerByPhone({
      phone: '+380931234567',
      fullName: 'Нове Імʼя',
      source: 'site',
      imported: false,
    });

    assert.ok(after);
    assert.equal(after.full_name, 'Нове Імʼя');
    assert.equal(after.source, 'keycrm,wrike');
    assert.equal(after.imported, true);
    assert.equal(after.legacy_orders_count, 4);
    assert.equal(after.legacy_products_count, 9);
    assert.equal(after.legacy_city, 'Київ');
    assert.equal(after.legacy_delivery, 'Нова пошта');
  });

  it('does not erase an existing name with an empty new name', async () => {
    const store = createMemoryCustomerStore();
    await store.upsertCustomerByPhone({ phone: '+380931234567', fullName: 'Збережене' });
    const after = await store.upsertCustomerByPhone({ phone: '+380931234567', fullName: '   ' });
    assert.ok(after);
    assert.equal(after.full_name, 'Збережене');
  });

  it('is idempotent for duplicate registration', async () => {
    const store = createMemoryCustomerStore();
    const first = await store.upsertCustomerByPhone({ phone: '+380931234567', fullName: 'Олена' });
    const second = await store.upsertCustomerByPhone({ phone: '+380931234567', fullName: 'Олена' });
    assert.equal(first?.phone, second?.phone);
    assert.equal(second?.source, 'site');
    assert.equal(second?.imported, false);
  });
});
