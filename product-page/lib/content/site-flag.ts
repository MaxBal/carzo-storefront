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

function assetUrl(file: unknown, fallback = '') {
  const directusUrl = getDirectusUrl();
  if (!directusUrl || !file) return fallback;
  const id = typeof file === 'string' ? file : (file as RecordValue).id;
  if (typeof id !== 'string') return fallback;
  return getDirectusToken()
    ? `/api/directus-assets/${encodeURIComponent(id)}`
    : `${directusUrl}/assets/${id}`;
}

export const getSiteFlag = cache(async (): Promise<string> => {
  const directusUrl = getDirectusUrl();
  if (!directusUrl) return '/flag-ua.svg';

  try {
    const query = new URLSearchParams({ fields: 'site_flag' });
    const response = await fetch(`${directusUrl}/items/carzo_site_settings?${query}`, {
      headers: directusHeaders(),
      next: { revalidate: 60 },
    });

    if (!response.ok) return '/flag-ua.svg';

    const payload = await response.json() as { data?: RecordValue };
    const data = payload.data;
    if (!data?.site_flag) return '/flag-ua.svg';

    return assetUrl(data.site_flag, '/flag-ua.svg');
  } catch {
    return '/flag-ua.svg';
  }
});
