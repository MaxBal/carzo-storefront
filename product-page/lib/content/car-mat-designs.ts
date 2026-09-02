import 'server-only';
import { cache } from 'react';

type RecordValue = Record<string, unknown>;

function getDirectusUrl() {
  return process.env.DIRECTUS_URL?.replace(/\/$/, '') || null;
}

function getDirectusToken() {
  return process.env.DIRECTUS_READ_TOKEN?.trim() || null;
}

function directusHeaders() {
  const token = getDirectusToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function string(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function assetUrl(file: unknown, fallback = '') {
  const directusUrl = getDirectusUrl();
  if (!directusUrl || !file) return fallback;
  const id = typeof file === 'string' ? file : (file as RecordValue).id;
  if (typeof id !== 'string') return fallback;
  return getDirectusToken()
    ? `/api/directus-assets/${encodeURIComponent(id)}`
    : `${directusUrl}/assets/${id}`;
}

function externalImageUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

export interface CarMatDesign {
  code: string;
  title: string;
  altText: string;
  image: string;
}

const DEFAULT_DESIGNS: CarMatDesign[] = [
  { code: '2.0', title: 'Дизайн Carzo 2.0', altText: 'Автокилимки Carzo дизайн 2.0', image: '' },
  { code: '3.0', title: 'Дизайн Carzo 3.0', altText: 'Автокилимки Carzo дизайн 3.0', image: '' },
  { code: '4.0', title: 'Дизайн Carzo 4.0', altText: 'Автокилимки Carzo дизайн 4.0', image: '' },
];

const DEFAULT_MEDIA_PLACEHOLDER = '/media/landscape-placeholder.svg';

function parseDesigns(raw: unknown): CarMatDesign[] {
  if (!Array.isArray(raw)) return DEFAULT_DESIGNS;
  return raw.map((item, index) => ({
    code: string(item.code) || DEFAULT_DESIGNS[index]?.code || '',
    title: string(item.title) || DEFAULT_DESIGNS[index]?.title || '',
    altText: string(item.altText) || DEFAULT_DESIGNS[index]?.altText || '',
    image: assetUrl(item.image),
  }));
}

export const getCarMatDesigns = cache(async (): Promise<CarMatDesign[]> => {
  const directusUrl = getDirectusUrl();
  if (!directusUrl) return DEFAULT_DESIGNS;

  try {
    const query = new URLSearchParams({ fields: 'car_mat_designs' });
    const response = await fetch(`${directusUrl}/items/carzo_site_settings?${query}`, {
      headers: directusHeaders(),
      next: { revalidate: 60 },
    });

    if (!response.ok) return DEFAULT_DESIGNS;

    const payload = await response.json() as { data?: RecordValue };
    const data = payload.data;
    if (!data) return DEFAULT_DESIGNS;

    return parseDesigns(data.car_mat_designs);
  } catch {
    return DEFAULT_DESIGNS;
  }
});

export const getCarMatMediaPlaceholder = cache(async (): Promise<string> => {
  const directusUrl = getDirectusUrl();
  if (!directusUrl) return DEFAULT_MEDIA_PLACEHOLDER;

  try {
    const query = new URLSearchParams({ fields: 'image.id,external_url' });
    const response = await fetch(`${directusUrl}/items/carzo_media_settings?${query}`, {
      headers: directusHeaders(),
      next: { revalidate: 60 },
    });

    if (!response.ok) return DEFAULT_MEDIA_PLACEHOLDER;

    const payload = await response.json() as { data?: RecordValue };
    const data = payload.data;
    if (!data) return DEFAULT_MEDIA_PLACEHOLDER;

    return assetUrl(data.image) || externalImageUrl(data.external_url) || DEFAULT_MEDIA_PLACEHOLDER;
  } catch {
    return DEFAULT_MEDIA_PLACEHOLDER;
  }
});
