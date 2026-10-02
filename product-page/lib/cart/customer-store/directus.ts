import 'server-only';

import { normalizeCustomerPhone } from '../customer-phone';
import {
  CustomerStoreError,
  type CustomerRecord,
  type CustomerStore,
  type UpsertCustomerInput,
} from './types';

type DirectusRecord = Record<string, unknown>;

function directusConfig() {
  const url = process.env.DIRECTUS_URL?.replace(/\/$/, '');
  const token = process.env.DIRECTUS_READ_TOKEN?.trim();
  if (!url || !token) {
    throw new CustomerStoreError('Directus is not configured', 'CONFIG');
  }
  return { url, token };
}

async function getJson(path: string) {
  const { url, token } = directusConfig();
  const response = await fetch(`${url}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  return {
    status: response.status,
    body: await response.json().catch(() => ({})) as { data?: unknown },
  };
}

async function patchJson(path: string, body: unknown) {
  const { url, token } = directusConfig();
  const response = await fetch(`${url}${path}`, {
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
async function loadRegistry(): Promise<CustomerRecord[]> {
  try {
    const { status, body } = await getJson('/items/customers?limit=-1&fields=*');
    if (status === 200 && Array.isArray(body.data)) {
      return body.data as CustomerRecord[];
    }
  } catch {
    // fall through to JSON registry
  }

  let status: number;
  let body: { data?: unknown };
  try {
    ({ status, body } = await getJson('/items/carzo_site_settings?fields=customers'));
  } catch {
    throw new CustomerStoreError('Directus customer registry unavailable', 'UNAVAILABLE');
  }
  if (status !== 200) {
    throw new CustomerStoreError('Directus customer registry unavailable', 'UNAVAILABLE');
  }
  const raw = (body.data as DirectusRecord | undefined)?.customers;
  return Array.isArray(raw) ? (raw as CustomerRecord[]) : [];
}

async function saveRegistry(items: CustomerRecord[]): Promise<void> {
  try {
    await patchJson('/items/carzo_site_settings', { customers: items });
  } catch {
    throw new CustomerStoreError('Directus customer registry write failed', 'WRITE_FAILED');
  }
}

async function findByPhone(phone: string): Promise<CustomerRecord | null> {
  try {
    const { status, body } = await getJson(
      `/items/customers?limit=1&filter[phone][_eq]=${encodeURIComponent(phone)}`,
    );
    if (status === 200 && Array.isArray(body.data) && body.data[0]) {
      return body.data[0] as CustomerRecord;
    }
    if (status === 200) return null;
  } catch {
    // fallback below
  }

  const items = await loadRegistry();
  return items.find(item => normalizeCustomerPhone(item.phone) === phone) ?? null;
}

async function upsertByPhone(input: UpsertCustomerInput, phone: string): Promise<CustomerRecord> {
  const existing = await findByPhone(phone);
  if (existing) return existing;

  const payload: CustomerRecord = {
    phone,
    full_name: input.fullName ?? null,
    source: input.source ?? 'site',
    imported: input.imported ?? false,
  };

  try {
    const { url, token } = directusConfig();
    const response = await fetch(`${url}/items/customers`, {
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
    // Unique conflict or schema missing → fall through to JSON registry
  } catch {
    // fall through
  }

  const items = await loadRegistry();
  const again = items.find(item => normalizeCustomerPhone(item.phone) === phone);
  if (again) return again;
  items.push(payload);
  await saveRegistry(items);
  return payload;
}

export function createDirectusCustomerStore(): CustomerStore {
  return {
    async findCustomerByPhone(rawPhone) {
      const phone = normalizeCustomerPhone(rawPhone);
      if (!phone) return null;
      return findByPhone(phone);
    },
    async upsertCustomerByPhone(input) {
      const phone = normalizeCustomerPhone(input.phone);
      if (!phone) return null;
      return upsertByPhone(input, phone);
    },
  };
}
