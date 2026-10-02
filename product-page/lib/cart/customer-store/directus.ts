import { normalizeCustomerPhone } from '../customer-phone';
import {
  CustomerStoreError,
  type CustomerRecord,
  type CustomerStore,
  type UpsertCustomerInput,
} from './types';

type DirectusRecord = Record<string, unknown>;
type FetchLike = typeof fetch;

function directusConfig() {
  const url = process.env.DIRECTUS_URL?.replace(/\/$/, '');
  const token = process.env.DIRECTUS_READ_TOKEN?.trim();
  if (!url || !token) {
    throw new CustomerStoreError('Directus is not configured', 'CONFIG');
  }
  return { url, token };
}

function assertWriteOk(status: number, label: string): void {
  if (status < 200 || status >= 300) {
    throw new CustomerStoreError(`${label} failed (HTTP ${status})`, 'WRITE_FAILED');
  }
}

async function getJson(path: string, doFetch: FetchLike) {
  const { url, token } = directusConfig();
  const response = await doFetch(`${url}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  return {
    status: response.status,
    body: await response.json().catch(() => ({})) as { data?: unknown },
  };
}

async function patchJson(path: string, body: unknown, doFetch: FetchLike) {
  const { url, token } = directusConfig();
  const response = await doFetch(`${url}${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return {
    status: response.status,
    body: await response.json().catch(() => ({})) as { data?: unknown },
  };
}

/**
 * Storage strategy (unchanged production semantics):
 * 1) Prefer real Directus collection `customers`.
 * 2) Fallback: JSON registry `carzo_site_settings.customers`.
 */
async function loadRegistry(doFetch: FetchLike): Promise<CustomerRecord[]> {
  try {
    const { status, body } = await getJson('/items/customers?limit=-1&fields=*', doFetch);
    if (status === 200 && Array.isArray(body.data)) {
      return body.data as CustomerRecord[];
    }
  } catch {
    // fall through to JSON registry
  }

  let status: number;
  let body: { data?: unknown };
  try {
    ({ status, body } = await getJson('/items/carzo_site_settings?fields=customers', doFetch));
  } catch {
    throw new CustomerStoreError('Directus customer registry unavailable', 'UNAVAILABLE');
  }
  if (status !== 200) {
    throw new CustomerStoreError('Directus customer registry unavailable', 'UNAVAILABLE');
  }
  const raw = (body.data as DirectusRecord | undefined)?.customers;
  return Array.isArray(raw) ? (raw as CustomerRecord[]) : [];
}

/**
 * Persist JSON registry. Success only on real 2xx — fetch() resolving is not enough.
 * A 403/500 PATCH must surface as WRITE_FAILED, never as a stored customer.
 */
async function saveRegistry(items: CustomerRecord[], doFetch: FetchLike): Promise<void> {
  let status: number;
  try {
    ({ status } = await patchJson('/items/carzo_site_settings', { customers: items }, doFetch));
  } catch {
    throw new CustomerStoreError('Directus customer registry write failed', 'WRITE_FAILED');
  }
  assertWriteOk(status, 'Directus customer registry write');
}

async function findByPhone(phone: string, doFetch: FetchLike): Promise<CustomerRecord | null> {
  try {
    const { status, body } = await getJson(
      `/items/customers?limit=1&filter[phone][_eq]=${encodeURIComponent(phone)}`,
      doFetch,
    );
    if (status === 200 && Array.isArray(body.data) && body.data[0]) {
      return body.data[0] as CustomerRecord;
    }
    if (status === 200) return null;
  } catch {
    // fallback below
  }

  const items = await loadRegistry(doFetch);
  return items.find(item => normalizeCustomerPhone(item.phone) === phone) ?? null;
}

async function upsertByPhone(
  input: UpsertCustomerInput,
  phone: string,
  doFetch: FetchLike,
): Promise<CustomerRecord> {
  const existing = await findByPhone(phone, doFetch);
  if (existing) return existing;

  const payload: CustomerRecord = {
    phone,
    full_name: input.fullName ?? null,
    source: input.source ?? 'site',
    imported: input.imported ?? false,
  };

  // Collection POST: only 2xx counts as persisted. Non-2xx (missing collection,
  // unique conflict, 5xx) falls through to the JSON registry fallback.
  try {
    const { url, token } = directusConfig();
    const response = await doFetch(`${url}/items/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    if (response.ok) {
      const body = await response.json() as { data?: CustomerRecord };
      return body.data ?? payload;
    }
  } catch {
    // fall through to JSON registry
  }

  const items = await loadRegistry(doFetch);
  const again = items.find(item => normalizeCustomerPhone(item.phone) === phone);
  if (again) return again;
  items.push(payload);
  await saveRegistry(items, doFetch);
  return payload;
}

export interface DirectusCustomerStoreOptions {
  /** Injectable for tests. Production uses global fetch. */
  fetch?: FetchLike;
}

export function createDirectusCustomerStore(
  options: DirectusCustomerStoreOptions = {},
): CustomerStore {
  const doFetch: FetchLike = options.fetch ?? fetch;

  return {
    async findCustomerByPhone(rawPhone) {
      const phone = normalizeCustomerPhone(rawPhone);
      if (!phone) return null;
      return findByPhone(phone, doFetch);
    },
    async upsertCustomerByPhone(input) {
      const phone = normalizeCustomerPhone(input.phone);
      if (!phone) return null;
      return upsertByPhone(input, phone, doFetch);
    },
  };
}
