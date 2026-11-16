import 'server-only';

import type {
  DeliveryMethod,
  NovaPoshtaCity,
  NovaPoshtaPoint,
  NovaPoshtaStreet,
} from './cart/types';
import type { WarehouseLimits } from './cart/shipping';

const ENDPOINT = 'https://api.novaposhta.ua/v2.0/json/';
const POINT_RESULT_LIMIT = 20;
const POINT_FETCH_LIMIT = 50;

export const NOVA_POSHTA_TIMEOUT_MS = 8_000;
export const NOVA_POSHTA_CACHE_TTL_MS = 5 * 60_000;
export const NOVA_POSHTA_CACHE_MAX_ENTRIES = 500;
export const NOVA_POSHTA_RATE_WINDOW_MS = 60_000;
export const NOVA_POSHTA_RATE_MAX_HITS = 60;
export const NOVA_POSHTA_RATE_MAX_IPS = 1_000;

const UUID_REF_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cache = new Map<string, { expires: number; data: unknown[] }>();
const ipHits = new Map<string, { count: number; resetAt: number }>();

type NovaRecord = Record<string, unknown>;
type PointDeliveryMethod = Exclude<DeliveryMethod, 'COURIER'>;

export function isNovaPoshtaUuidRef(value: string): boolean {
  return UUID_REF_REGEX.test(value.trim());
}

/**
 * Bounded per-IP rate limiter for public Nova Poshta autocomplete routes.
 * Evicts expired buckets and caps map size so spoofed IPs cannot exhaust memory.
 */
export function isNovaPoshtaRateLimited(
  ip: string,
  now: number = Date.now(),
  maxHits: number = NOVA_POSHTA_RATE_MAX_HITS,
): boolean {
  const key = ip.trim() || 'unknown';
  const existing = ipHits.get(key);
  if (existing && existing.resetAt > now) {
    existing.count += 1;
    return existing.count > maxHits;
  }

  if (ipHits.size >= NOVA_POSHTA_RATE_MAX_IPS) {
    ipHits.forEach((v, k) => {
      if (v.resetAt <= now) ipHits.delete(k);
    });
    if (ipHits.size >= NOVA_POSHTA_RATE_MAX_IPS) {
      const oldestKey = ipHits.keys().next().value;
      if (oldestKey !== undefined) ipHits.delete(oldestKey);
    }
  }

  ipHits.set(key, { count: 1, resetAt: now + NOVA_POSHTA_RATE_WINDOW_MS });
  return false;
}

export function extractClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function getCachedNovaPoshta(cacheKey: string, now: number): NovaRecord[] | null {
  const cached = cache.get(cacheKey);
  if (!cached) return null;
  if (cached.expires <= now) {
    cache.delete(cacheKey);
    return null;
  }
  // Refresh LRU insertion order on hit
  cache.delete(cacheKey);
  cache.set(cacheKey, cached);
  return cached.data as NovaRecord[];
}

function setCachedNovaPoshta(
  cacheKey: string,
  data: NovaRecord[],
  now: number,
  maxEntries: number = NOVA_POSHTA_CACHE_MAX_ENTRIES,
): void {
  if (cache.has(cacheKey)) {
    cache.delete(cacheKey);
  } else if (cache.size >= maxEntries) {
    cache.forEach((v, k) => {
      if (v.expires <= now) cache.delete(k);
    });
    while (cache.size >= maxEntries) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey === undefined) break;
      cache.delete(oldestKey);
    }
  }
  cache.set(cacheKey, { expires: now + NOVA_POSHTA_CACHE_TTL_MS, data });
}

/** Test helpers for inspecting and resetting bounded cache and rate-limit state. */
export function getNovaPoshtaCacheSizeForTests(): number {
  return cache.size;
}

export function resetNovaPoshtaStateForTests(): void {
  cache.clear();
  ipHits.clear();
}

export async function callNovaPoshta(
  method: string,
  properties: Record<string, string>,
  options?: { timeoutMs?: number; maxCacheEntries?: number; now?: number },
): Promise<NovaRecord[]> {
  const apiKey = process.env.NOVA_POSHTA_API_KEY?.trim();
  if (!apiKey) throw new Error('NOVA_POSHTA_API_KEY is not configured');

  const now = options?.now ?? Date.now();
  const cacheKey = `${method}:${JSON.stringify(properties)}`;
  const hit = getCachedNovaPoshta(cacheKey, now);
  if (hit) return hit;

  const timeoutMs = options?.timeoutMs ?? NOVA_POSHTA_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        modelName: 'Address',
        calledMethod: method,
        methodProperties: properties,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    if (
      controller.signal.aborted ||
      (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
    ) {
      throw new Error('Nova Poshta request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  let payload: {
    success?: boolean;
    data?: NovaRecord[];
    errors?: string[];
  } | null = null;
  try {
    payload = (await response.json()) as {
      success?: boolean;
      data?: NovaRecord[];
      errors?: string[];
    };
  } catch {
    throw new Error(`Nova Poshta invalid JSON response (HTTP ${response.status})`);
  }

  if (!response.ok || !payload?.success || !Array.isArray(payload.data)) {
    throw new Error(payload?.errors?.join('; ') || `Nova Poshta request failed (HTTP ${response.status})`);
  }

  setCachedNovaPoshta(cacheKey, payload.data, now, options?.maxCacheEntries);
  return payload.data;
}

function text(record: NovaRecord, field: string) {
  const value = record[field];
  return typeof value === 'string' ? value : '';
}

/** NP returns numeric fields as strings with a comma decimal separator. */
function metricValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Documented getWarehouses limitation fields:
 * TotalMaxWeightAllowed, PlaceMaxWeightAllowed, SendingLimitationsOnDimensions,
 * DenyToSelect. Absent or non-positive values stay null — never a zero limit.
 */
function warehouseLimits(record: NovaRecord): WarehouseLimits {
  const dimensions = record.SendingLimitationsOnDimensions;
  const dims = (dimensions && typeof dimensions === 'object' ? dimensions : null) as NovaRecord | null;
  const lengthCm = dims ? metricValue(dims.Length) : null;
  const widthCm = dims ? metricValue(dims.Width) : null;
  const heightCm = dims ? metricValue(dims.Height) : null;
  return {
    totalMaxWeightKg: metricValue(record.TotalMaxWeightAllowed),
    placeMaxWeightKg: metricValue(record.PlaceMaxWeightAllowed),
    sendingMaxDimensionsCm: lengthCm && widthCm && heightCm
      ? { lengthCm, widthCm, heightCm }
      : null,
    denyToSelect: text(record, 'DenyToSelect') === '1',
  };
}

function pointType(record: NovaRecord): NovaPoshtaPoint['type'] | null {
  const category = text(record, 'CategoryOfWarehouse');
  if (category === 'Branch') return 'branch';
  if (category === 'Postomat') return 'postomat';
  return null;
}

function toPoint(record: NovaRecord): NovaPoshtaPoint | null {
  const type = pointType(record);
  if (!type) return null;
  return {
    ref: text(record, 'Ref'),
    number: text(record, 'Number'),
    name: text(record, 'Description'),
    address: text(record, 'ShortAddress') || text(record, 'Description'),
    type,
    limits: warehouseLimits(record),
  };
}

function toStreet(record: NovaRecord): NovaPoshtaStreet {
  return {
    ref: text(record, 'Ref'),
    name: text(record, 'Description'),
    type: text(record, 'StreetsType'),
  };
}

export async function findNovaPoshtaCities(query: string): Promise<NovaPoshtaCity[]> {
  const normalized = query.trim().slice(0, 80);
  if (normalized.length < 2) return [];
  const data = await callNovaPoshta('getCities', {
    FindByString: normalized,
    Limit: '20',
    Page: '1',
  });
  return data.map(record => ({
    ref: text(record, 'Ref'),
    name: text(record, 'Description'),
    area: text(record, 'AreaDescription'),
    type: text(record, 'SettlementTypeDescription'),
  })).filter(city => city.ref && city.name);
}

export async function findNovaPoshtaPoints(
  cityRef: string,
  method: PointDeliveryMethod,
  query = '',
): Promise<NovaPoshtaPoint[]> {
  const cleanCityRef = cityRef.trim();
  if (!isNovaPoshtaUuidRef(cleanCityRef)) {
    throw new Error('Invalid Nova Poshta cityRef');
  }
  const properties: Record<string, string> = {
    CityRef: cleanCityRef,
    Limit: String(POINT_FETCH_LIMIT),
    Page: '1',
  };
  if (method === 'POSTOMAT') properties.CategoryOfWarehouse = 'Postomat';
  const normalized = query.trim().slice(0, 80);
  if (normalized) properties.FindByString = normalized;
  const data = await callNovaPoshta('getWarehouses', properties);
  const expectedType: NovaPoshtaPoint['type'] = method === 'POSTOMAT' ? 'postomat' : 'branch';
  return data
    .map(toPoint)
    .filter((point): point is NovaPoshtaPoint => Boolean(
      point && point.ref && point.name && point.type === expectedType,
    ))
    .slice(0, POINT_RESULT_LIMIT);
}

export async function resolveNovaPoshtaPoint(
  cityRef: string,
  pointRef: string,
  method: PointDeliveryMethod,
) {
  const cleanCityRef = cityRef.trim();
  const cleanPointRef = pointRef.trim();
  if (!isNovaPoshtaUuidRef(cleanCityRef) || !isNovaPoshtaUuidRef(cleanPointRef)) {
    throw new Error('Delivery point was not found');
  }
  const data = await callNovaPoshta('getWarehouses', {
    CityRef: cleanCityRef,
    Ref: cleanPointRef,
    Limit: '1',
    Page: '1',
  });
  const record = data.find(item => text(item, 'Ref') === cleanPointRef);
  if (!record || text(record, 'CityRef') !== cleanCityRef) throw new Error('Delivery point was not found');
  const point = toPoint(record);
  const expectedType: NovaPoshtaPoint['type'] = method === 'POSTOMAT' ? 'postomat' : 'branch';
  if (!point || point.type !== expectedType) throw new Error('Delivery point type does not match');
  const cityName = text(record, 'CityDescription');
  if (!cityName) throw new Error('Delivery city was not found');
  return { cityRef: cleanCityRef, cityName, point };
}

export async function resolveNovaPoshtaCity(cityRef: string) {
  const cleanCityRef = cityRef.trim();
  if (!isNovaPoshtaUuidRef(cleanCityRef)) {
    throw new Error('Delivery city was not found');
  }
  const data = await callNovaPoshta('getCities', {
    Ref: cleanCityRef,
    Limit: '1',
    Page: '1',
  });
  const record = data.find(item => text(item, 'Ref') === cleanCityRef);
  const cityName = record ? text(record, 'Description') : '';
  if (!record || !cityName) throw new Error('Delivery city was not found');
  return { cityRef: cleanCityRef, cityName };
}

export async function findNovaPoshtaStreets(cityRef: string, query: string): Promise<NovaPoshtaStreet[]> {
  const cleanCityRef = cityRef.trim();
  if (!isNovaPoshtaUuidRef(cleanCityRef)) {
    throw new Error('Invalid Nova Poshta cityRef');
  }
  const normalized = query.trim().slice(0, 80);
  if (normalized.length < 2) return [];
  const data = await callNovaPoshta('getStreet', {
    CityRef: cleanCityRef,
    FindByString: normalized,
    Limit: '20',
    Page: '1',
  });
  return data
    .map(toStreet)
    .filter(street => street.ref && street.name);
}

export async function resolveNovaPoshtaStreet(cityRef: string, streetRef: string) {
  const cleanCityRef = cityRef.trim();
  const cleanStreetRef = streetRef.trim();
  if (!isNovaPoshtaUuidRef(cleanCityRef) || !isNovaPoshtaUuidRef(cleanStreetRef)) {
    throw new Error('Delivery street was not found');
  }
  const data = await callNovaPoshta('getStreet', {
    CityRef: cleanCityRef,
    Ref: cleanStreetRef,
    Limit: '1',
    Page: '1',
  });
  const record = data.find(item => text(item, 'Ref') === cleanStreetRef);
  if (!record) throw new Error('Delivery street was not found');
  const street = toStreet(record);
  if (!street.ref || !street.name) throw new Error('Delivery street was not found');
  return street;
}
