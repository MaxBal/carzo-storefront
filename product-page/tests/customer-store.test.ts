import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { maskPhone, normalizeCustomerPhone } from '../lib/cart/customer-phone';
import { resolveCustomerStoreBackend } from '../lib/cart/customer-store/config';
import {
  buildExistingCustomerUpdate,
  buildNewCustomerRow,
  normalizeFullName,
} from '../lib/cart/customer-store/merge';
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
  });

  it('rejects invalid input', () => {
    assert.equal(normalizeCustomerPhone(''), null);
    assert.equal(normalizeCustomerPhone('   '), null);
    assert.equal(normalizeCustomerPhone('abc'), null);
    assert.equal(normalizeCustomerPhone('123'), null);
    assert.equal(normalizeCustomerPhone(null), null);
    assert.equal(normalizeCustomerPhone(undefined), null);
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

/** In-memory store used to assert lookup/write semantics without live backends. */
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

    // Simulate PHASE 3 imported row that must not be destroyed.
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
