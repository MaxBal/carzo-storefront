import 'server-only';

import { cache } from 'react';
import type {
  CmsBlockItem,
  CmsBlockTheme,
  CmsBlockType,
  CmsPage,
  CmsPageBlock,
  CmsPageSummary,
  CmsPageType,
} from './types';

type DirectusRecord = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_TYPES = new Set<CmsPageType>(['landing', 'content', 'legal']);
const BLOCK_TYPES = new Set<CmsBlockType>(['hero', 'rich_text', 'image_text', 'feature_grid', 'faq', 'cta']);
const BLOCK_THEMES = new Set<CmsBlockTheme>(['light', 'dark', 'soft', 'mint']);

function directusUrl() {
  return process.env.DIRECTUS_URL?.replace(/\/$/, '') || null;
}

function directusHeaders() {
  const token = process.env.DIRECTUS_READ_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function nullableText(value: unknown) {
  const valueText = text(value).trim();
  return valueText || null;
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function assetPath(value: unknown) {
  if (!value) return null;
  const id = typeof value === 'string' ? value : (value as DirectusRecord).id;
  return typeof id === 'string' && UUID_PATTERN.test(id)
    ? `/api/directus-assets/${encodeURIComponent(id)}`
    : null;
}

function blockItems(value: unknown): CmsBlockItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const record = item as DirectusRecord;
      return {
        title: nullableText(record.title) || undefined,
        text: nullableText(record.text) || undefined,
        question: nullableText(record.question) || undefined,
        answer: nullableText(record.answer) || undefined,
      };
    });
}

function mapBlock(record: DirectusRecord): CmsPageBlock | null {
  const typeValue = text(record.block_type) as CmsBlockType;
  if (!BLOCK_TYPES.has(typeValue)) return null;
  const themeValue = text(record.theme, 'light') as CmsBlockTheme;

  return {
    id: text(record.id),
    key: text(record.key),
    type: typeValue,
    theme: BLOCK_THEMES.has(themeValue) ? themeValue : 'light',
    sort: number(record.sort),
    anchor: nullableText(record.anchor),
    eyebrow: nullableText(record.eyebrow),
    title: nullableText(record.title),
    subtitle: nullableText(record.subtitle),
    body: nullableText(record.body),
    image: assetPath(record.image),
    imageAlt: text(record.image_alt),
    imagePosition: record.image_position === 'left' ? 'left' : 'right',
    primaryLabel: nullableText(record.primary_label),
    primaryUrl: nullableText(record.primary_url),
    secondaryLabel: nullableText(record.secondary_label),
    secondaryUrl: nullableText(record.secondary_url),
    items: blockItems(record.items),
  };
}

async function requestItems(
  collection: string,
  query: URLSearchParams,
  preview: boolean,
): Promise<DirectusRecord[]> {
  const url = directusUrl();
  if (!url) return [];

  const response = await fetch(`${url}/items/${collection}?${query}`, {
    headers: directusHeaders(),
    ...(preview
      ? { cache: 'no-store' as const }
      : { next: { revalidate: 60, tags: ['directus-pages'] } }),
  });
  if (!response.ok) {
    throw new Error(`${collection}: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as { data?: DirectusRecord | DirectusRecord[] };
  if (!payload.data) return [];
  return Array.isArray(payload.data) ? payload.data : [payload.data];
}

async function readPage(
  filterField: 'slug' | 'id',
  filterValue: string,
  preview: boolean,
): Promise<CmsPage | null> {
  if (filterField === 'id' && !UUID_PATTERN.test(filterValue)) return null;

  const pageQuery = new URLSearchParams({
    limit: '1',
    fields: 'id,status,key,title,slug,page_type,seo_title,seo_description,seo_image.id,show_header,show_footer,no_index',
    [`filter[${filterField}][_eq]`]: filterValue,
  });
  if (!preview) pageQuery.set('filter[status][_eq]', 'published');

  const [pageRecord] = await requestItems('carzo_pages', pageQuery, preview);
  if (!pageRecord) return null;

  const blockQuery = new URLSearchParams({
    limit: '-1',
    sort: 'sort',
    fields: 'id,status,sort,key,block_type,theme,anchor,eyebrow,title,subtitle,body,image.id,image_alt,image_position,primary_label,primary_url,secondary_label,secondary_url,items',
    'filter[page][_eq]': text(pageRecord.id),
  });
  if (!preview) blockQuery.set('filter[status][_eq]', 'published');

  const blockRecords = await requestItems('carzo_page_blocks', blockQuery, preview);
  const pageTypeValue = text(pageRecord.page_type, 'content') as CmsPageType;

  return {
    id: text(pageRecord.id),
    status: text(pageRecord.status, 'draft') as CmsPage['status'],
    key: text(pageRecord.key),
    title: text(pageRecord.title),
    slug: text(pageRecord.slug),
    pageType: PAGE_TYPES.has(pageTypeValue) ? pageTypeValue : 'content',
    seoTitle: text(pageRecord.seo_title, text(pageRecord.title)),
    seoDescription: text(pageRecord.seo_description),
    seoImage: assetPath(pageRecord.seo_image),
    showHeader: bool(pageRecord.show_header, true),
    showFooter: bool(pageRecord.show_footer, true),
    noIndex: bool(pageRecord.no_index, false),
    blocks: blockRecords
      .map(mapBlock)
      .filter((block): block is CmsPageBlock => block !== null),
  };
}

export const getPublishedPage = cache(async (slug: string) => {
  try {
    return await readPage('slug', slug, false);
  } catch (error) {
    console.error('Unable to load published Directus page', error);
    return null;
  }
});

export const getPublishedPageSummaries = cache(async (): Promise<CmsPageSummary[]> => {
  try {
    const query = new URLSearchParams({
      limit: '-1',
      sort: 'slug',
      fields: 'id,key,title,slug,seo_description,no_index',
      'filter[status][_eq]': 'published',
    });
    const records = await requestItems('carzo_pages', query, false);
    return records.map(record => ({
      id: text(record.id),
      key: text(record.key),
      title: text(record.title),
      slug: text(record.slug),
      seoDescription: text(record.seo_description),
      noIndex: bool(record.no_index, false),
    }));
  } catch (error) {
    console.error('Unable to list published Directus pages', error);
    return [];
  }
});

export async function getPreviewPage(id: string) {
  try {
    return await readPage('id', id, true);
  } catch (error) {
    console.error('Unable to load Directus page preview', error);
    return null;
  }
}
