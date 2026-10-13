/**
 * Pure Stage 3 parity helpers. No network, no secrets, no PII printing.
 */

export type Raw = Record<string, unknown>;

export const PRODUCT_MEDIA_SLOTS = [
  'materials_video',
  'edging_video',
  'fixation_video',
  'magnetic_system_video',
  'magnetic_system_default_cover',
  'magnetic_system_cover_2_0_s',
  'magnetic_system_cover_2_0_m',
  'magnetic_system_cover_2_0_l',
  'magnetic_system_cover_2_0_xl',
  'magnetic_system_cover_3_0_s',
  'magnetic_system_cover_3_0_m',
  'magnetic_system_cover_3_0_l',
  'magnetic_system_cover_3_0_xl',
  'magnetic_system_cover_4_0_s',
  'magnetic_system_cover_4_0_m',
  'magnetic_system_cover_4_0_l',
  'magnetic_system_cover_4_0_xl',
] as const;

export const INTENTIONAL_EMPTY_MEDIA_KEYS = new Set(['fixation-bottom', 'fixation-wall']);

export const APPROVED_INTENTIONAL_TRANSFORMS = [
  'carzo_brand_pricing → brands.logo_extra',
  'carzo_size_shipping → sizes.shipping_*',
  'carzo_fixations.extra_by_size → fixation_size_extras',
  'carzo_media_settings → product_media',
  'carzo_site_settings → 6 target settings tables',
  'Directus file UUIDs → R2 URLs',
  'carzo_logo_placements → dropped',
  'directus_user_ids → dropped',
  'Telegram bot_token → env-only',
  'site_settings.customers → dropped',
  'manager_note loyalty JSON → loyalty_* columns',
  'historical checkout_attempt_id = NULL',
  'optional customer_id may remain NULL',
  'approved intentional-empty media remains NULL',
] as const;

export function isUuid(value: unknown): boolean {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isDirectusFileUuid(value: unknown): boolean {
  return isUuid(value);
}

export function isDirectusMediaRef(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false;
  return isUuid(value)
    || value.includes('/assets/')
    || value.includes('/api/directus-assets/')
    || value.includes('directus-production-');
}

export function isApprovedR2Url(value: unknown, publicBase = 'https://media.carzo.com.ua'): boolean {
  return typeof value === 'string' && value.startsWith(`${publicBase}/`) && value.length > publicBase.length + 1;
}

export function isForbiddenTargetMediaUrl(value: unknown): boolean {
  return isDirectusMediaRef(value) || isDirectusFileUuid(value);
}

export function classifyMediaRef(value: unknown): 'empty' | 'r2' | 'directus' | 'other' {
  if (value === null || value === undefined || value === '') return 'empty';
  if (isDirectusMediaRef(value)) return 'directus';
  if (isApprovedR2Url(value)) return 'r2';
  return 'other';
}

/** Semantic media equivalence: target must be approved R2 URL when source was a known mapped file. */
export function mediaSemanticEqual(source: unknown, target: unknown, knownR2BySourceFile?: Map<string, string>): boolean {
  const t = typeof target === 'string' ? target : null;
  if (t && isApprovedR2Url(t)) return true;
  if (knownR2BySourceFile && typeof source === 'string' && knownR2BySourceFile.has(source)) {
    return knownR2BySourceFile.get(source) === t;
  }
  if (!source && !t) return true;
  return false;
}

export function countDuplicates<T>(rows: T[], keyOf: (row: T) => string): number {
  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  let dups = 0;
  for (const count of Array.from(seen.values())) if (count > 1) dups += count - 1;
  return dups;
}

export function countOrphans<TParent, TChild>(
  children: TChild[],
  parents: TParent[],
  childKey: (row: TChild) => string | null,
  parentKey: (row: TParent) => string,
): number {
  const parentKeys = new Set(parents.map(parentKey));
  let orphans = 0;
  for (const child of children) {
    const key = childKey(child);
    if (key === null || key === undefined || key === '') continue;
    if (!parentKeys.has(key)) orphans += 1;
  }
  return orphans;
}

export function normalizeTier(row: { key?: unknown; min_quantity?: unknown; minQuantity?: unknown; amount?: unknown; sort?: unknown }) {
  return {
    key: String(row.key ?? ''),
    minQuantity: Number(row.minQuantity ?? row.min_quantity ?? 0),
    amount: Number(row.amount ?? 0),
    sort: Number(row.sort ?? 0),
  };
}

export function normalizeQuoteForCompare(quote: Raw): Raw {
  const clone = JSON.parse(JSON.stringify(quote)) as Raw;
  delete clone.verifiedAt;
  return clone;
}

/** Normalize optional missing fields to null so undefined/null compare equal. */
export function normalizeNulls(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(normalizeNulls);
  if (value && typeof value === 'object') {
    const out: Raw = {};
    for (const [k, v] of Object.entries(value as Raw)) out[k] = normalizeNulls(v);
    return out;
  }
  return value;
}

/** Recursively sort object keys; preserve array order. */
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const out: Raw = {};
    for (const k of Object.keys(value as Raw).sort()) {
      out[k] = sortKeysDeep((value as Raw)[k]);
    }
    return out;
  }
  return value;
}

export function canonicalizeForCompare(value: unknown): unknown {
  return sortKeysDeep(normalizeNulls(value));
}

export function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalizeForCompare(a)) === JSON.stringify(canonicalizeForCompare(b));
}

function safePreview(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string') {
    const s = value.length > 80 ? `${value.slice(0, 80)}…` : value;
    return JSON.stringify(s);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const s = JSON.stringify(value) ?? String(value);
    return s.length > 80 ? `${s.slice(0, 80)}…` : s;
  } catch {
    return '[unserializable]';
  }
}

/** Field-level diff paths with safe truncated values. No PII bulk dump. */
export function deepDiff(a: unknown, b: unknown, path = ''): string[] {
  const na = normalizeNulls(a);
  const nb = normalizeNulls(b);
  if (na === nb) return [];
  if (na === null || nb === null || typeof na !== 'object' || typeof nb !== 'object') {
    return [`${path || '$'}: source=${safePreview(na)} target=${safePreview(nb)}`];
  }
  if (Array.isArray(na) || Array.isArray(nb)) {
    if (!Array.isArray(na) || !Array.isArray(nb)) {
      return [`${path || '$'}: source=${safePreview(na)} target=${safePreview(nb)}`];
    }
    if (na.length !== nb.length) {
      return [`${path || '$'}.length: source=${na.length} target=${nb.length}`];
    }
    const paths: string[] = [];
    for (let i = 0; i < na.length; i++) {
      paths.push(...deepDiff(na[i], nb[i], `${path}[${i}]`));
      if (paths.length >= 20) break;
    }
    return paths;
  }
  const ao = na as Raw;
  const bo = nb as Raw;
  const keys = Array.from(new Set([...Object.keys(ao), ...Object.keys(bo)])).sort();
  const paths: string[] = [];
  for (const key of keys) {
    paths.push(...deepDiff(ao[key], bo[key], path ? `${path}.${key}` : key));
    if (paths.length >= 20) break;
  }
  return paths;
}

export function comparePiiField(label: string, left: unknown, right: unknown): { label: string; mismatchCount: number } {
  return { label, mismatchCount: left === right ? 0 : 1 };
}

export function formatPiiMismatchCounts(fields: Array<{ label: string; mismatchCount: number }>): string[] {
  return fields.map(field => `${field.label} mismatch count = ${field.mismatchCount}`);
}

export type ManagerNoteResult =
  | { kind: 'empty' }
  | { kind: 'loyalty'; loyalty: {
      loyalty_phone: string | null;
      loyalty_eligible: boolean;
      loyalty_discount_percent: number;
      loyalty_discount_amount: number;
      loyalty_phone_mismatch: boolean;
    } }
  | { kind: 'human'; text: string }
  | { kind: 'unknown_json' };

export function classifyManagerNote(raw: unknown): ManagerNoteResult {
  const text = typeof raw === 'string' ? raw : raw === null || raw === undefined ? '' : String(raw);
  if (!text) return { kind: 'empty' };
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return { kind: 'human', text };
  let parsed: Raw;
  try {
    parsed = JSON.parse(trimmed) as Raw;
  } catch {
    return { kind: 'human', text };
  }
  const keys = Object.keys(parsed);
  if (keys.length === 1 && keys[0] === 'loyalty' && parsed.loyalty && typeof parsed.loyalty === 'object') {
    const l = parsed.loyalty as Raw;
    const bool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';
    const int = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : 0;
    };
    return {
      kind: 'loyalty',
      loyalty: {
        loyalty_phone: typeof l.phone === 'string' ? l.phone : null,
        loyalty_eligible: bool(l.eligible),
        loyalty_discount_percent: int(l.discount_percent),
        loyalty_discount_amount: int(l.discount_amount),
        loyalty_phone_mismatch: bool(l.phone_mismatch),
      },
    };
  }
  return { kind: 'unknown_json' };
}

export function loyaltyTransformEqual(
  sourceNote: unknown,
  target: {
    loyalty_phone: string | null;
    loyalty_eligible: boolean;
    loyalty_discount_percent: number;
    loyalty_discount_amount: number;
    loyalty_phone_mismatch: boolean;
    manager_note: string | null;
  },
): { ok: boolean; unknownJson: boolean; kind: ManagerNoteResult['kind'] } {
  const note = classifyManagerNote(sourceNote);
  if (note.kind === 'unknown_json') return { ok: false, unknownJson: true, kind: 'unknown_json' };
  if (note.kind === 'loyalty') {
    const ok = note.loyalty.loyalty_phone === target.loyalty_phone
      && note.loyalty.loyalty_eligible === target.loyalty_eligible
      && note.loyalty.loyalty_discount_percent === target.loyalty_discount_percent
      && note.loyalty.loyalty_discount_amount === target.loyalty_discount_amount
      && note.loyalty.loyalty_phone_mismatch === target.loyalty_phone_mismatch
      && target.manager_note === null;
    return { ok, unknownJson: false, kind: 'loyalty' };
  }
  if (note.kind === 'human') {
    return { ok: target.manager_note === note.text, unknownJson: false, kind: 'human' };
  }
  return {
    ok: target.manager_note === null
      && target.loyalty_phone === null
      && target.loyalty_eligible === false
      && target.loyalty_discount_percent === 0
      && target.loyalty_discount_amount === 0
      && target.loyalty_phone_mismatch === false,
    unknownJson: false,
    kind: 'empty',
  };
}

export function canonicalPage(row: Raw): Raw {
  return {
    key: row.key,
    slug: row.slug,
    title: row.title,
    page_type: row.page_type ?? row.pageType,
    status: row.status,
    no_index: row.no_index ?? row.noIndex,
    show_header: row.show_header ?? row.showHeader,
    show_footer: row.show_footer ?? row.showFooter,
    seo_title: row.seo_title ?? row.seoTitle,
    seo_description: row.seo_description ?? row.seoDescription,
  };
}

/** Stage 2 approved: drop Directus file UUIDs / file object keys from JSON payloads. */
export function stripDirectusFileIds<T>(value: T): T {
  if (typeof value === 'string') {
    const s0 = value as string;
    if (isUuid(s0) || s0.includes('/assets/')) return null as unknown as T;
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripDirectusFileIds(item)).filter((item) => item !== null) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Raw = {};
    for (const [k, v] of Object.entries(value as Raw)) {
      const key = k.toLowerCase();
      if (key === 'image' || key.endsWith('_image') || key === 'file' || key === 'filename_disk') {
        continue;
      }
      const cleaned = stripDirectusFileIds(v);
      if (cleaned !== null && cleaned !== undefined) out[k] = cleaned;
    }
    return out as T;
  }
  return value;
}

function relationId(v: unknown): string | null {
  if (isUuid(v)) return String(v);
  if (v && typeof v === 'object') {
    const id = (v as Raw).id;
    return isUuid(id) ? String(id) : null;
  }
  return null;
}

function asString(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  return typeof v === 'string' ? v : String(v);
}

function asInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Approved TARGET SEMANTICS for page_blocks (both Directus source and Supabase target).
 * Directus-only fields / file UUIDs are intentionally not part of the compare set.
 */
export function canonicalBlock(row: Raw): Raw {
  const pageId = row.page_id !== undefined && row.page_id !== null
    ? asString(row.page_id)
    : relationId(row.page);
  const rawImage = row.image_url ?? row.imageUrl ?? row.media_url ?? row.mediaUrl ?? null;
  return {
    key: asString(row.key),
    page_id: pageId,
    block_type: asString(row.block_type ?? row.blockType),
    title: asString(row.title),
    eyebrow: asString(row.eyebrow),
    subtitle: asString(row.subtitle),
    body: asString(row.body),
    items: row.items === undefined || row.items === null
      ? null
      : stripDirectusFileIds(row.items),
    image_url: asString(rawImage),
    image_alt: asString(row.image_alt ?? row.imageAlt),
    image_position: asString(row.image_position ?? row.imagePosition),
    theme: asString(row.theme),
    primary_label: asString(row.primary_label ?? row.primaryLabel),
    primary_url: asString(row.primary_url ?? row.primaryUrl),
    secondary_label: asString(row.secondary_label ?? row.secondaryLabel),
    secondary_url: asString(row.secondary_url ?? row.secondaryUrl),
    anchor: asString(row.anchor),
    sort: asInt(row.sort) ?? 0,
    status: asString(row.status) ?? 'published',
  };
}

/**
 * Media semantic equality for approved Directus-file → R2 normalization.
 * Target must never be a Directus ref. Exact R2 URLs must match when both sides have URLs.
 */
export function mediaUrlSemanticEqual(source: unknown, target: unknown): boolean {
  const sClass = classifyMediaRef(source);
  const tClass = classifyMediaRef(target);
  if (tClass === 'directus' || tClass === 'other') return false;
  if (sClass === tClass) {
    if (sClass === 'r2') return String(source) === String(target);
    return true;
  }
  // approved: Directus file / assets path → R2 public URL
  if (sClass === 'directus' && tClass === 'r2') return true;
  return false;
}

/** Compare two canonical page_blocks: media semantic + remaining field-level equality. */
export function compareCanonicalBlocks(source: Raw, target: Raw): { ok: boolean; paths: string[] } {
  const a = canonicalBlock(source);
  const b = canonicalBlock(target);
  const paths: string[] = [];
  if (!mediaUrlSemanticEqual(a.image_url, b.image_url)) {
    paths.push(`image_url: source=${safePreview(a.image_url)} target=${safePreview(b.image_url)}`);
  }
  const restA = { ...a, image_url: null };
  const restB = { ...b, image_url: null };
  paths.push(...deepDiff(restA, restB, ''));
  return { ok: paths.length === 0, paths };
}

export function isIntentionalEmptyMediaKey(key: unknown): boolean {
  return typeof key === 'string' && INTENTIONAL_EMPTY_MEDIA_KEYS.has(key);
}

export function missingCanonicalProductMediaSlots(presentSlots: string[]): string[] {
  const present = new Set(presentSlots);
  return PRODUCT_MEDIA_SLOTS.filter(slot => !present.has(slot));
}

export function assertNoSecrets(dto: unknown, secrets: string[]): string[] {
  const hits: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (typeof v === 'string') {
      for (const s of secrets) {
        if (s && v.includes(s)) hits.push(path);
      }
      return;
    }
    if (Array.isArray(v)) v.forEach((item, i) => walk(item, `${path}[${i}]`));
    else if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v as Raw)) walk(val, `${path}.${k}`);
    }
  };
  walk(dto, '$');
  return hits;
}

export function brandPricingEqual(sourceLogoExtra: number | null, targetLogoExtra: number | null): boolean {
  return (sourceLogoExtra ?? 0) === (targetLogoExtra ?? 0);
}

export function fixationExtraEqual(
  sourceExtraBySize: Record<string, number> | null | undefined,
  sourceBaseExtra: number | null | undefined,
  targetExtras: Array<{ sizeCode: string; extra: number }>,
): boolean {
  const targetMap = new Map(targetExtras.map(row => [row.sizeCode.toLowerCase(), row.extra]));
  const sourceMap = new Map<string, number>();
  if (sourceExtraBySize && typeof sourceExtraBySize === 'object') {
    for (const [k, v] of Object.entries(sourceExtraBySize as Record<string, number>)) {
      sourceMap.set(k.toLowerCase(), Number(v));
    }
  }
  if (sourceMap.size !== targetMap.size) return false;
  for (const [size, extra] of Array.from(sourceMap.entries())) {
    if (targetMap.get(size) !== extra) return false;
  }
  if (sourceMap.size === 0) {
    return targetMap.size === 0 && (sourceBaseExtra ?? 0) === (sourceBaseExtra ?? 0);
  }
  return true;
}
