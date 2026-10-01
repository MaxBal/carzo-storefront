import 'server-only';

/** Canonical phone form: +380XXXXXXXXX */
export function normalizeCustomerPhone(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  let core: string | null = null;
  if (digits.startsWith('380')) {
    core = digits.slice(3, 12);
  } else if (digits.startsWith('38') && digits.length >= 11) {
    core = digits.slice(2, 11).replace(/^0/, '');
  } else if (digits.startsWith('0') && digits.length >= 10) {
    core = digits.slice(1, 10);
  } else if (digits.length === 9) {
    core = digits;
  } else if (digits.length >= 9) {
    core = digits.slice(-9);
  }

  if (!core || !/^\d{9}$/.test(core)) return null;
  return `+380${core}`;
}

export interface CustomerRecord {
  phone: string;
  full_name?: string | null;
  source?: string | null;
  imported?: boolean;
  legacy_orders_count?: number | null;
  legacy_products_count?: number | null;
  legacy_city?: string | null;
  legacy_delivery?: string | null;
}

type DirectusRecord = Record<string, unknown>;

function directusConfig() {
  const url = process.env.DIRECTUS_URL?.replace(/\/$/, '');
  const token = process.env.DIRECTUS_READ_TOKEN?.trim();
  if (!url || !token) throw new Error('Directus is not configured');
  return { url, token };
}

async function getJson(path: string) {
  const { url, token } = directusConfig();
  const response = await fetch(`${url}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  return { status: response.status, body: await response.json().catch(() => ({})) as { data?: unknown } };
}

async function patchJson(path: string, body: unknown) {
  const { url, token } = directusConfig();
  const response = await fetch(`${url}${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return { status: response.status, body: await response.json().catch(() => ({})) as { data?: unknown } };
}

/**
 * Storage strategy:
 * 1) Prefer real Directus collection `customers` (when available on the plan).
 * 2) Fallback: JSON registry `carzo_site_settings.customers` — phone is the unique key.
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
  const { status, body } = await getJson('/items/carzo_site_settings?fields=customers');
  if (status !== 200) return [];
  const raw = (body.data as DirectusRecord | undefined)?.customers;
  return Array.isArray(raw) ? (raw as CustomerRecord[]) : [];
}

async function saveRegistry(items: CustomerRecord[]): Promise<void> {
  // Only used for the JSON fallback path.
  await patchJson('/items/carzo_site_settings', { customers: items });
}

export async function findCustomerByPhone(rawPhone: string): Promise<CustomerRecord | null> {
  const phone = normalizeCustomerPhone(rawPhone);
  if (!phone) return null;

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

export interface UpsertCustomerInput {
  phone: string;
  fullName?: string | null;
  source?: string | null;
  imported?: boolean;
}

/**
 * Universal upsert by normalized phone.
 * Safe for site checkout, CRM webhook, and admin import.
 * Unique-conflict is treated as "already exists".
 */
export async function upsertCustomerByPhone(input: UpsertCustomerInput): Promise<CustomerRecord | null> {
  const phone = normalizeCustomerPhone(input.phone);
  if (!phone) return null;

  const existing = await findCustomerByPhone(phone);
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
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
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

export async function isCustomerEligible(rawPhone: string): Promise<boolean> {
  return Boolean(await findCustomerByPhone(rawPhone));
}
