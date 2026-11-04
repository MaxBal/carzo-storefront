/**
 * Legacy Directus loaders for homepage / about / car-mat settings.
 * Behaviour preserved from lib/content/{homepage,about,car-mat-designs}.ts
 * before Stage 7.x D-2: used only when CONTENT_STORE=directus (rollback path).
 */
import 'server-only';

import { resolveMediaUrl } from '@/lib/media';
import {
  DEFAULT_ABOUT,
  DEFAULT_CAR_MAT_PROMO_MEDIA,
  DEFAULT_CAR_MAT_DESIGNS,
  DEFAULT_HOMEPAGE,
  parseAboutSettings,
  parseCarMatDesigns,
  parseCarMatPromoMedia,
  parseHomepageSettings,
  type AboutData,
  type CarMatDesign,
  type CarMatPromoMedia,
  type HomepageData,
} from '@/lib/content/settings-defaults';

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

async function readSiteSettings(fields: string): Promise<RecordValue | null> {
  const directusUrl = getDirectusUrl();
  if (!directusUrl) return null;
  const query = new URLSearchParams({ fields });
  const response = await fetch(`${directusUrl}/items/carzo_site_settings?${query}`, {
    headers: directusHeaders(),
    next: { revalidate: 60 },
  });
  if (!response.ok) return null;
  const payload = await response.json() as { data?: RecordValue };
  return payload.data ?? null;
}

export async function loadDirectusHomepageSettings(): Promise<HomepageData> {
  const data = await readSiteSettings('*');
  if (!data) return DEFAULT_HOMEPAGE;
  return parseHomepageSettings(data, resolveMediaUrl);
}

export async function loadDirectusAboutSettings(): Promise<AboutData> {
  const data = await readSiteSettings('*');
  if (!data) return DEFAULT_ABOUT;
  return parseAboutSettings(data, resolveMediaUrl);
}

export async function loadDirectusCarMatDesigns(): Promise<CarMatDesign[]> {
  const data = await readSiteSettings('car_mat_designs');
  if (!data) return DEFAULT_CAR_MAT_DESIGNS;
  return parseCarMatDesigns(data.car_mat_designs);
}

export async function loadDirectusCarMatPromoMedia(): Promise<CarMatPromoMedia> {
  const data = await readSiteSettings(
    'car_mat_promo_video_url,car_mat_promo_video.id,car_mat_promo_cover_url,car_mat_promo_cover.id',
  );
  if (!data) return DEFAULT_CAR_MAT_PROMO_MEDIA;
  return parseCarMatPromoMedia(data, resolveMediaUrl);
}
