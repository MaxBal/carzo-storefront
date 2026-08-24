import 'server-only';
import { cache } from 'react';
import { DEFAULT_CONTENT_SOURCE } from './default-source';
import type { BenefitModalData } from './types';

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

async function readCollection(name: string, fields = '*'): Promise<RecordValue[]> {
  const directusUrl = getDirectusUrl();
  if (!directusUrl) throw new Error('DIRECTUS_URL is not configured');
  const query = new URLSearchParams({
    limit: '-1',
    fields,
    'filter[status][_eq]': 'published',
  });
  const response = await fetch(`${directusUrl}/items/${name}?${query}`, {
    headers: directusHeaders(),
    next: { revalidate: 60 },
  });
  if (!response.ok) throw new Error(`${name}: ${response.status} ${response.statusText}`);
  const payload = await response.json() as { data: RecordValue | RecordValue[] };
  return Array.isArray(payload.data) ? payload.data : [payload.data];
}

function string(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export const getBenefitModals = cache(async (): Promise<BenefitModalData[]> => {
  if (!getDirectusUrl()) return DEFAULT_CONTENT_SOURCE.benefitModals;
  try {
    const benefitModals = await readCollection('carzo_benefit_modals');
    return benefitModals.map(item => ({
      type: string(item.key),
      cardLabel: string(item.card_label),
      title: string(item.title),
      subtitle: string(item.subtitle),
      blocks: (item.content as { blocks?: BenefitModalData['blocks'] } | null)?.blocks ?? [],
    })) as BenefitModalData[];
  } catch {
    return DEFAULT_CONTENT_SOURCE.benefitModals;
  }
});
