/**
 * Pure Stage 2A helpers: media gap classification, R2 key planning, URL checks.
 * No network, no secrets, no PII printing.
 */

export type Raw = Record<string, unknown>;

export const PUBLIC_MEDIA_BASE = 'https://media.carzo.com.ua';

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

export type MediaClass =
  | 'URL_ONLY'
  | 'FILE_ONLY'
  | 'BOTH'
  | 'EMPTY'
  | 'LOCAL_FALLBACK_ONLY'
  | 'NOT_REQUIRED'
  | 'LEGACY_UNUSED';

export type SourceFileMeta = {
  id: string;
  filenameDownload: string | null;
  type: string | null;
  filesize: number | null;
  width: number | null;
  height: number | null;
};

export type CriticalTargetRef = {
  table: 'designs' | 'rich_section_images' | 'logo_settings' | 'product_media';
  field: string;
  /** non-sensitive row key / slug / slot */
  targetKey: string;
  sourceCollection: string;
  sourceField: string;
  sourceFileUuid: string;
  sourceMeta: SourceFileMeta;
};

export type PlannedObject = {
  r2Key: string;
  publicUrl: string;
  sourceFileUuid: string;
  contentType: string;
  sourceExt: string;
  /** target refs that will point at this object */
  targetRefs: Array<Pick<CriticalTargetRef, 'table' | 'field' | 'targetKey'>>;
  action: 'REUSE' | 'COPY';
  reason: string;
};

export type SupabaseFieldUpdate =
  | { table: 'designs'; where: { slug: string }; set: { selector_image_url: string } }
  | { table: 'rich_section_images'; where: { key: string }; set: { media_url: string } }
  | { table: 'logo_settings'; where: Record<string, never>; set: { fallback_image_url: string } }
  | {
      table: 'product_media';
      insert: { slot: string; media_url: string };
    };

/** Approved writable media fields only. */
export const APPROVED_UPDATES = new Set([
  'designs.selector_image_url',
  'rich_section_images.media_url',
  'logo_settings.fallback_image_url',
  'product_media.slot+media_url',
]);

export function isUuid(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

export const isDirectusFileUuid = isUuid;

export function asString(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  return typeof v === 'string' ? v : String(v);
}

export function classifyMediaRef(input: {
  externalUrl?: unknown;
  fileRef?: unknown;
  hasLocalFallback?: boolean;
  required?: boolean;
}): MediaClass {
  const url = asString(input.externalUrl);
  const file = asString(input.fileRef);
  const hasUrl = Boolean(url && /^https?:\/\//i.test(url));
  const hasFile = Boolean(file && (isDirectusFileUuid(file) || !/^https?:/i.test(file)));

  if (input.hasLocalFallback && !hasUrl && !hasFile) return 'LOCAL_FALLBACK_ONLY';
  if (input.required === false && !hasUrl && !hasFile) return 'NOT_REQUIRED';
  if (hasUrl && hasFile) return 'BOTH';
  if (hasUrl) return 'URL_ONLY';
  if (hasFile) return 'FILE_ONLY';
  return 'EMPTY';
}

/** Directus file UUID must never become a target media URL. */
export function isForbiddenTargetMediaUrl(value: string | null | undefined): boolean {
  const s = asString(value);
  if (!s) return false;
  if (isDirectusFileUuid(s)) return true;
  if (s.includes('/assets/') || s.includes('/api/directus-assets/') || s.includes('/files/')) {
    return true;
  }
  return false;
}

export function buildPublicUrl(r2Key: string, base = PUBLIC_MEDIA_BASE): string {
  const key = r2Key.replace(/^\/+/, '');
  return `${base.replace(/\/$/, '')}/${key}`;
}

export function extensionForMime(mime: string | null | undefined): string | null {
  const m = (mime || '').toLowerCase();
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  };
  return map[m] ?? null;
}

export function isSupportedImageMime(mime: string | null | undefined): boolean {
  const m = (mime || '').toLowerCase();
  return m.startsWith('image/') && m !== 'image/svg+xml';
}

/** design slug `2-0` → path segment `2.0` (matches live R2 convention). */
export function designPathSegment(slug: string): string {
  return slug.replace(/-/g, '.');
}

/**
 * Canonical R2 object key for a critical target.
 * Deterministic, stable, collision-safe, product/content identity based.
 * Shared Directus binaries intentionally share one key (upload once).
 */
export function canonicalObjectKey(input: {
  table: CriticalTargetRef['table'];
  targetKey: string;
  sourceFileUuid: string;
  sourceExt: string;
}): string {
  const ext = input.sourceExt.replace(/^\./, '').toLowerCase();
  // Shared design selector + logo fallback binary
  if (input.sourceFileUuid === 'd3bb1465-a5a6-40a5-9493-2f444931a026') {
    return `content/products/case/designs/selector-default.${ext}`;
  }
  // Shared magnetic-system.jpg for 2-0/3-0 magnets + default cover
  if (input.sourceFileUuid === '0c724340-1362-45fa-af6f-42e7c3379b16') {
    return `content/products/case/rich-content/design-2.0/magnets.${ext}`;
  }
  if (input.table === 'rich_section_images' && input.targetKey.endsWith(':rich-magnets')) {
    const design = designPathSegment(input.targetKey.split(':')[0]);
    return `content/products/case/rich-content/design-${design}/magnets.${ext}`;
  }
  if (input.table === 'designs') {
    return `content/products/case/designs/design-${designPathSegment(input.targetKey)}/selector.${ext}`;
  }
  if (input.table === 'logo_settings') {
    return `content/products/case/logo/fallback-default.${ext}`;
  }
  if (input.table === 'product_media') {
    return `content/products/case/rich-content/global/magnetic-system/${input.targetKey}.${ext}`;
  }
  return `content/products/case/stage2a/${input.table}/${input.targetKey}.${ext}`;
}

export function dedupeSourceFiles(refs: CriticalTargetRef[]): Map<string, CriticalTargetRef[]> {
  const byUuid = new Map<string, CriticalTargetRef[]>();
  for (const ref of refs) {
    const list = byUuid.get(ref.sourceFileUuid) ?? [];
    list.push(ref);
    byUuid.set(ref.sourceFileUuid, list);
  }
  return byUuid;
}

export function planObjects(
  refs: CriticalTargetRef[],
  existing: {
    keyExists: (r2Key: string) => boolean;
    existingSha256?: (r2Key: string) => string | null;
    sourceSha256?: (fileUuid: string) => string | null;
  },
): PlannedObject[] {
  const byUuid = dedupeSourceFiles(refs);
  const out: PlannedObject[] = [];
  const claimedKeys = new Set<string>();

  for (const [uuid, list] of byUuid) {
    const meta = list[0].sourceMeta;
    const ext = extensionForMime(meta.type) ?? 'bin';
    if (!isSupportedImageMime(meta.type) && !String(meta.type || '').startsWith('video/')) {
      // still plan; apply/verify will BLOCKED on unsupported MIME
    }
    const r2Key = canonicalObjectKey({
      table: list[0].table,
      targetKey: list[0].targetKey,
      sourceFileUuid: uuid,
      sourceExt: ext,
    });
    if (claimedKeys.has(r2Key)) {
      // deterministic collision among distinct binaries — caller must resolve
      out.push({
        r2Key,
        publicUrl: buildPublicUrl(r2Key),
        sourceFileUuid: uuid,
        contentType: meta.type || 'application/octet-stream',
        sourceExt: ext,
        targetRefs: list.map((r) => ({ table: r.table, field: r.field, targetKey: r.targetKey })),
        action: 'COPY',
        reason: 'BLOCKED: unresolved object-key collision',
      });
      continue;
    }
    claimedKeys.add(r2Key);

    let action: 'REUSE' | 'COPY' = 'COPY';
    let reason = 'missing on public R2';
    if (existing.keyExists(r2Key)) {
      const remote = existing.existingSha256?.(r2Key) ?? null;
      const local = existing.sourceSha256?.(uuid) ?? null;
      if (remote && local && remote === local) {
        action = 'REUSE';
        reason = 'existing R2 object hash matches source';
      } else if (remote && local && remote !== local) {
        action = 'COPY';
        reason = 'BLOCKED: existing key has different bytes — do not overwrite';
      } else {
        action = 'REUSE';
        reason = 'existing public object present (hash not compared yet)';
      }
    }

    out.push({
      r2Key,
      publicUrl: buildPublicUrl(r2Key),
      sourceFileUuid: uuid,
      contentType: meta.type || 'application/octet-stream',
      sourceExt: ext,
      targetRefs: list.map((r) => ({ table: r.table, field: r.field, targetKey: r.targetKey })),
      action,
      reason,
    });
  }
  return out;
}

export function toSupabaseUpdates(
  refs: CriticalTargetRef[],
  objects: PlannedObject[],
): SupabaseFieldUpdate[] {
  const urlByUuid = new Map<string, string>();
  for (const obj of objects) {
    if (obj.reason.startsWith('BLOCKED')) continue;
    urlByUuid.set(obj.sourceFileUuid, obj.publicUrl);
  }
  const updates: SupabaseFieldUpdate[] = [];
  for (const ref of refs) {
    const mediaUrl = urlByUuid.get(ref.sourceFileUuid);
    if (!mediaUrl) continue;
    if (isForbiddenTargetMediaUrl(mediaUrl)) continue;
    if (ref.table === 'designs') {
      updates.push({
        table: 'designs',
        where: { slug: ref.targetKey },
        set: { selector_image_url: mediaUrl },
      });
    } else if (ref.table === 'rich_section_images') {
      updates.push({
        table: 'rich_section_images',
        where: { key: ref.targetKey },
        set: { media_url: mediaUrl },
      });
    } else if (ref.table === 'logo_settings') {
      updates.push({
        table: 'logo_settings',
        where: {},
        set: { fallback_image_url: mediaUrl },
      });
    } else if (ref.table === 'product_media') {
      updates.push({
        table: 'product_media',
        insert: { slot: ref.targetKey, media_url: mediaUrl },
      });
    }
  }
  return updates;
}

export function assertOnlyApprovedUpdates(updates: SupabaseFieldUpdate[]): void {
  for (const u of updates) {
    if (u.table === 'designs') {
      const keys = Object.keys(u.set);
      if (keys.length !== 1 || keys[0] !== 'selector_image_url') {
        throw new Error('BLOCKED: unapproved designs field update');
      }
    } else if (u.table === 'rich_section_images') {
      const keys = Object.keys(u.set);
      if (keys.length !== 1 || keys[0] !== 'media_url') {
        throw new Error('BLOCKED: unapproved rich_section_images field update');
      }
    } else if (u.table === 'logo_settings') {
      const keys = Object.keys(u.set);
      if (keys.length !== 1 || keys[0] !== 'fallback_image_url') {
        throw new Error('BLOCKED: unapproved logo_settings field update');
      }
    } else if (u.table === 'product_media') {
      const keys = Object.keys(u.insert).sort();
      if (keys.join(',') !== 'media_url,slot') {
        throw new Error('BLOCKED: unapproved product_media insert');
      }
      if (!PRODUCT_MEDIA_SLOTS.includes(u.insert.slot as (typeof PRODUCT_MEDIA_SLOTS)[number])) {
        throw new Error('BLOCKED: non-canonical product_media slot');
      }
    }
  }
}

export function classifyContentSectionNull(input: {
  externalUrl?: unknown;
  fileRef?: unknown;
}): { class: 'INTENTIONAL_EMPTY' | 'HAS_SOURCE'; action: 'KEEP_NULL' | 'REVIEW' } {
  const url = asString(input.externalUrl);
  const file = asString(input.fileRef);
  if (!url && !file) {
    return { class: 'INTENTIONAL_EMPTY', action: 'KEEP_NULL' };
  }
  return { class: 'HAS_SOURCE', action: 'REVIEW' };
}

export const KNOWN_CRITICAL_GAP_COUNT = 8;
export const KNOWN_UNIQUE_SOURCE_FILE_COUNT = 3;

export function expectedCriticalTargetKeys(): Array<{
  table: CriticalTargetRef['table'];
  field: string;
  targetKey: string;
}> {
  return [
    { table: 'designs', field: 'selector_image_url', targetKey: '2-0' },
    { table: 'designs', field: 'selector_image_url', targetKey: '3-0' },
    { table: 'designs', field: 'selector_image_url', targetKey: '4-0' },
    { table: 'rich_section_images', field: 'media_url', targetKey: '2-0:rich-magnets' },
    { table: 'rich_section_images', field: 'media_url', targetKey: '3-0:rich-magnets' },
    { table: 'rich_section_images', field: 'media_url', targetKey: '4-0:rich-magnets' },
    { table: 'logo_settings', field: 'fallback_image_url', targetKey: 'logo_settings' },
    { table: 'product_media', field: 'media_url', targetKey: 'magnetic_system_default_cover' },
  ];
}

export function missingCanonicalProductMediaSlots(existingSlots: string[]): string[] {
  return PRODUCT_MEDIA_SLOTS.filter((s) => !existingSlots.includes(s));
}

export function isSafePublicMediaUrl(url: string | null | undefined): boolean {
  const s = asString(url);
  if (!s) return false;
  if (isForbiddenTargetMediaUrl(s)) return false;
  if (!s.startsWith(`${PUBLIC_MEDIA_BASE}/`)) return false;
  if (s.includes('r2.cloudflarestorage.com')) return false;
  if (s.includes('X-Amz-') || s.includes('Signature=')) return false;
  return true;
}
