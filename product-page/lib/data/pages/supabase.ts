import 'server-only';

import { cache } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  CmsBlockItem,
  CmsBlockTheme,
  CmsBlockType,
  CmsPage,
  CmsPageBlock,
  CmsPageSummary,
  CmsPageType,
} from '@/lib/pages/types';
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from '../config';
import type { PageRepository } from './types';

type SupabaseRow = Record<string, unknown>;

export const __PAGE_CACHE = {
  revalidate: CACHE_REVALIDATE_SECONDS,
  tags: [CACHE_TAGS.pages],
} as const;

type NextFetchInit = RequestInit & {
  next?: { revalidate?: number | false; tags?: string[] };
};

/**
 * Pages-scoped Supabase clients only. Published reads go through the Next data * cache with a 60s TTL so CMS edits appear within a minute; preview reads are
 * never cached. The shared admin client is deliberately untouched — catalog,
 * cart and orders keep their existing fetch behaviour.
 */
function createPageClient(fetchImpl: typeof fetch): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) {
    throw new Error('Missing required Supabase environment variable for pages client');
  }
  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: fetchImpl,
    },
  });
}

let cachedPageClient: SupabaseClient | null = null;
function getCachedPageClient(): SupabaseClient {
  if (!cachedPageClient) {
    cachedPageClient = createPageClient((input, init) =>
      fetch(input, {
        ...init,
        next: { revalidate: __PAGE_CACHE.revalidate, tags: [...__PAGE_CACHE.tags] },
      } as NextFetchInit),
    );
  }
  return cachedPageClient;
}

let previewPageClient: SupabaseClient | null = null;
function getPreviewPageClient(): SupabaseClient {
  if (!previewPageClient) {
    previewPageClient = createPageClient((input, init) =>
      fetch(input, { ...init, cache: 'no-store' }),
    );
  }
  return previewPageClient;
}

function getPageClient(preview: boolean): SupabaseClient {
  return preview ? getPreviewPageClient() : getCachedPageClient();
}

const PAGE_TYPES = new Set<CmsPageType>(['landing', 'content', 'legal']);
const BLOCK_TYPES = new Set<CmsBlockType>(['hero', 'rich_text', 'image_text', 'feature_grid', 'faq', 'cta']);
const BLOCK_THEMES = new Set<CmsBlockTheme>(['light', 'dark', 'soft', 'mint']);

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

/** R2 URL only — no Directus asset fallback. */
function r2Url(value: unknown): string | null {
  const raw = text(value).trim();
  if (!raw) return null;
  if (/^https:\/\/[^\s]+$/i.test(raw)) return raw;
  return null;
}

function blockItems(value: unknown): CmsBlockItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const record = item as SupabaseRow;
      return {
        title: nullableText(record.title) || undefined,
        text: nullableText(record.text) || undefined,
        question: nullableText(record.question) || undefined,
        answer: nullableText(record.answer) || undefined,
      };
    });
}

function mapBlock(row: SupabaseRow): CmsPageBlock | null {
  const typeValue = text(row.block_type) as CmsBlockType;
  if (!BLOCK_TYPES.has(typeValue)) return null;
  const themeValue = text(row.theme, 'light') as CmsBlockTheme;

  return {
    id: text(row.id),
    key: text(row.key),
    type: typeValue,
    theme: BLOCK_THEMES.has(themeValue) ? themeValue : 'light',
    sort: number(row.sort),
    anchor: nullableText(row.anchor),
    eyebrow: nullableText(row.eyebrow),
    title: nullableText(row.title),
    subtitle: nullableText(row.subtitle),
    body: nullableText(row.body),
    image: r2Url(row.image_url),
    imageAlt: text(row.image_alt),
    imagePosition: row.image_position === 'left' ? 'left' : 'right',
    primaryLabel: nullableText(row.primary_label),
    primaryUrl: nullableText(row.primary_url),
    secondaryLabel: nullableText(row.secondary_label),
    secondaryUrl: nullableText(row.secondary_url),
    items: blockItems(row.items),
  };
}

async function readPage(
  filterField: 'slug' | 'id',
  filterValue: string,
  preview: boolean,
): Promise<CmsPage | null> {
  const client = getPageClient(preview);
  let pageQuery = client
    .from('pages')
    .select(
      'id,status,key,title,slug,page_type,seo_title,seo_description,seo_image_url,show_header,show_footer,no_index',
    )
    .eq(filterField, filterValue)
    .limit(1);
  if (!preview) pageQuery = pageQuery.eq('status', 'published');

  const pageResult = await (preview
    ? pageQuery.abortSignal(AbortSignal.timeout(8_000))
    : pageQuery);
  const { data: pageRows, error: pageError } = pageResult;
  if (pageError) {
    throw new Error(`pages read failed: ${pageError.message}`);
  }
  const pageRow = (pageRows ?? [])[0] as SupabaseRow | undefined;
  if (!pageRow) return null;

  let blockQuery = client
    .from('page_blocks')
    .select(
      'id,status,sort,key,block_type,theme,anchor,eyebrow,title,subtitle,body,image_url,image_alt,image_position,primary_label,primary_url,secondary_label,secondary_url,items',
    )
    .eq('page_id', text(pageRow.id))
    .order('sort', { ascending: true });
  if (!preview) blockQuery = blockQuery.eq('status', 'published');

  const { data: blockRows, error: blockError } = await blockQuery;
  if (blockError) {
    throw new Error(`page_blocks read failed: ${blockError.message}`);
  }

  const pageTypeValue = text(pageRow.page_type, 'content') as CmsPageType;

  return {
    id: text(pageRow.id),
    status: text(pageRow.status, 'draft') as CmsPage['status'],
    key: text(pageRow.key),
    title: text(pageRow.title),
    slug: text(pageRow.slug),
    pageType: PAGE_TYPES.has(pageTypeValue) ? pageTypeValue : 'content',
    seoTitle: text(pageRow.seo_title, text(pageRow.title)),
    seoDescription: text(pageRow.seo_description),
    seoImage: r2Url(pageRow.seo_image_url),
    showHeader: bool(pageRow.show_header, true),
    showFooter: bool(pageRow.show_footer, true),
    noIndex: bool(pageRow.no_index, false),
    blocks: ((blockRows ?? []) as SupabaseRow[])
      .map(mapBlock)
      .filter((block): block is CmsPageBlock => block !== null),
  };
}

/**
 * Supabase pages adapter. Published reads use ~60s cache; preview is no-store
 * and may read draft rows. R2 media only. No Directus fallback.
 */
export function createSupabasePageRepository(): PageRepository {
  return {
    getPublishedPage: cache(async (slug: string) => {
      try {
        return await readPage('slug', slug, false);
      } catch (error) {
        console.error('Unable to load published Supabase page', error);
        return null;
      }
    }),
    getPublishedPageSummaries: cache(async (): Promise<CmsPageSummary[]> => {
      try {
        const { data, error } = await getCachedPageClient()
          .from('pages')
          .select('id,key,title,slug,seo_description,no_index')
          .eq('status', 'published')
          .order('slug', { ascending: true });
        if (error) throw new Error(error.message);
        return ((data ?? []) as SupabaseRow[]).map(row => ({
          id: text(row.id),
          key: text(row.key),
          title: text(row.title),
          slug: text(row.slug),
          seoDescription: text(row.seo_description),
          noIndex: bool(row.no_index, false),
        }));
      } catch (error) {
        console.error('Unable to list published Supabase pages', error);
        return [];
      }
    }),
    getPreviewPage: async (id: string) => {
      try {
        return await readPage('id', id, true);
      } catch (error) {
        console.error('Unable to load Supabase page preview', error);
        return null;
      }
    },
  };
}
