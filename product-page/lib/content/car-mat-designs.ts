import 'server-only';
import { cache } from 'react';
import { resolveMediaUrl, resolveJsonMediaUrl, normalizeExternalUrl } from '@/lib/media';

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
    image: resolveJsonMediaUrl(item as { image?: unknown; imageUrl?: unknown }),
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

    return resolveMediaUrl(data.external_url, data.image, DEFAULT_MEDIA_PLACEHOLDER);
  } catch {
    return DEFAULT_MEDIA_PLACEHOLDER;
  }
});
