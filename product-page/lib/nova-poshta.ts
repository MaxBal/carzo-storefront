import 'server-only';

import type {
  DeliveryMethod,
  NovaPoshtaCity,
  NovaPoshtaPoint,
  NovaPoshtaStreet,
} from './cart/types';

const ENDPOINT = 'https://api.novaposhta.ua/v2.0/json/';
const POINT_RESULT_LIMIT = 20;
const POINT_FETCH_LIMIT = 50;
const cache = new Map<string, { expires: number; data: unknown[] }>();

type NovaRecord = Record<string, unknown>;
type PointDeliveryMethod = Exclude<DeliveryMethod, 'COURIER'>;

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
  const properties: Record<string, string> = {
    CityRef: cityRef,
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
  const data = await callNovaPoshta('getWarehouses', {
    CityRef: cityRef,
    Ref: pointRef,
    Limit: '1',
    Page: '1',
  });
  const record = data.find(item => text(item, 'Ref') === pointRef);
  if (!record || text(record, 'CityRef') !== cityRef) throw new Error('Delivery point was not found');
  const point = toPoint(record);
  const expectedType: NovaPoshtaPoint['type'] = method === 'POSTOMAT' ? 'postomat' : 'branch';
  if (!point || point.type !== expectedType) throw new Error('Delivery point type does not match');
  const cityName = text(record, 'CityDescription');
  if (!cityName) throw new Error('Delivery city was not found');
  return { cityRef, cityName, point };
}

export async function resolveNovaPoshtaCity(cityRef: string) {
  const data = await callNovaPoshta('getCities', {
    Ref: cityRef,
    Limit: '1',
    Page: '1',
  });
  const record = data.find(item => text(item, 'Ref') === cityRef);
  const cityName = record ? text(record, 'Description') : '';
  if (!record || !cityName) throw new Error('Delivery city was not found');
  return { cityRef, cityName };
}

export async function findNovaPoshtaStreets(cityRef: string, query: string): Promise<NovaPoshtaStreet[]> {
  const normalized = query.trim().slice(0, 80);
  if (normalized.length < 2) return [];
  const data = await callNovaPoshta('getStreet', {
    CityRef: cityRef,
    FindByString: normalized,
    Limit: '20',
    Page: '1',
  });
  return data
    .map(toStreet)
    .filter(street => street.ref && street.name);
}

export async function resolveNovaPoshtaStreet(cityRef: string, streetRef: string) {
  const data = await callNovaPoshta('getStreet', {
    CityRef: cityRef,
    Ref: streetRef,
    Limit: '1',
    Page: '1',
  });
  const record = data.find(item => text(item, 'Ref') === streetRef);
  if (!record) throw new Error('Delivery street was not found');
  const street = toStreet(record);
  if (!street.ref || !street.name) throw new Error('Delivery street was not found');
  return street;
}
