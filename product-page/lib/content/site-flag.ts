import 'server-only';
import { cache } from 'react';
import { resolveMediaUrl } from '@/lib/media';

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

export const getSiteFlag = cache(async (): Promise<string> => {
  const directusUrl = getDirectusUrl();
  if (!directusUrl) return '/flag-ua.svg';

  try {
    const query = new URLSearchParams({ fields: 'site_flag,site_flag_url' });
    const response = await fetch(`${directusUrl}/items/carzo_site_settings?${query}`, {
      headers: directusHeaders(),
      next: { revalidate: 60 },
    });

    if (!response.ok) return '/flag-ua.svg';

    const payload = await response.json() as { data?: RecordValue };
    const data = payload.data;
    if (!data) return '/flag-ua.svg';

    return resolveMediaUrl(data.site_flag_url, data.site_flag, '/flag-ua.svg');
  } catch {
    return '/flag-ua.svg';
  }
});
