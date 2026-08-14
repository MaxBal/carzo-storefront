import 'server-only';

import type { NovaPoshtaCity, NovaPoshtaPoint } from './cart/types';

const ENDPOINT = 'https://api.novaposhta.ua/v2.0/json/';
const POSTOMAT_TYPES = new Set([
  '95dc212d-479c-4ffb-a8ab-8c1b9073d0bc',
  'f9316480-5f2d-425d-bc2c-ac7cd29decf0',
]);
const cache = new Map<string, { expires: number; data: unknown[] }>();

type NovaRecord = Record<string, unknown>;

async function callNovaPoshta(method: string, properties: Record<string, string>) {
  const apiKey = process.env.NOVA_POSHTA_API_KEY?.trim();
  if (!apiKey) throw new Error('NOVA_POSHTA_API_KEY is not configured');
  const cacheKey = `${method}:${JSON.stringify(properties)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data as NovaRecord[];

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      modelName: 'Address',
      calledMethod: method,
      methodProperties: properties,
    }),
    cache: 'no-store',
  });
  const payload = await response.json() as {
    success?: boolean;
    data?: NovaRecord[];
    errors?: string[];
  };
  if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
    throw new Error(payload.errors?.join('; ') || 'Nova Poshta request failed');
  }
  cache.set(cacheKey, { expires: Date.now() + 5 * 60_000, data: payload.data });
  return payload.data;
}

function text(record: NovaRecord, field: string) {
  const value = record[field];
  return typeof value === 'string' ? value : '';
}

function toPoint(record: NovaRecord): NovaPoshtaPoint {
  const typeRef = text(record, 'TypeOfWarehouse');
  return {
    ref: text(record, 'Ref'),
    name: text(record, 'Description'),
    address: text(record, 'ShortAddress') || text(record, 'Description'),
    type: POSTOMAT_TYPES.has(typeRef) || /поштомат/i.test(text(record, 'Description')) ? 'postomat' : 'branch',
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

export async function findNovaPoshtaPoints(cityRef: string, query = ''): Promise<NovaPoshtaPoint[]> {
  const properties: Record<string, string> = {
    CityRef: cityRef,
    Limit: '50',
    Page: '1',
  };
  const normalized = query.trim().slice(0, 80);
  if (normalized) properties.FindByString = normalized;
  const data = await callNovaPoshta('getWarehouses', properties);
  return data.map(toPoint).filter(point => point.ref && point.name);
}

export async function resolveNovaPoshtaPoint(cityRef: string, pointRef: string) {
  const data = await callNovaPoshta('getWarehouses', {
    CityRef: cityRef,
    Ref: pointRef,
    Limit: '1',
    Page: '1',
  });
  const record = data.find(item => text(item, 'Ref') === pointRef);
  if (!record || text(record, 'CityRef') !== cityRef) throw new Error('Delivery point was not found');
  const point = toPoint(record);
  const cityName = text(record, 'CityDescription');
  if (!cityName) throw new Error('Delivery city was not found');
  return { cityRef, cityName, point };
}
