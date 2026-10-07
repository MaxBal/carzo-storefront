/**
 * Stage 2A: complete Directus-file media onto Cloudflare R2, then update Supabase media URLs.
 *
 * Usage:
 *   npx tsx scripts/complete-directus-media-to-r2.ts --inventory
 *   npx tsx scripts/complete-directus-media-to-r2.ts --dry-run
 *   npx tsx scripts/complete-directus-media-to-r2.ts --apply
 *   npx tsx scripts/complete-directus-media-to-r2.ts --verify
 *
 * Env:
 *   DIRECTUS_URL, DIRECTUS_READ_TOKEN|DIRECTUS_ADMIN_TOKEN  — GET only
 *   SUPABASE_URL, SUPABASE_SECRET_KEY                       — apply/verify
 *   R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *   R2_PUBLIC_BASE_URL=https://media.carzo.com.ua
 *
 * Directus is read-only. No R2 deletes. No secrets in logs.
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Load product-page/.env.local when present (never print values).
for (const p of ['.env.local', join(process.cwd(), '.env.local')]) {
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k && v && process.env[k] === undefined) process.env[k] = v;
  }
  break;
}

import {
  PRODUCT_MEDIA_SLOTS,
  PUBLIC_MEDIA_BASE,
  buildPublicUrl,
  classifyContentSectionNull,
  classifyMediaRef,
  dedupeSourceFiles,
  expectedCriticalTargetKeys,
  isSafePublicMediaUrl,
  isSupportedImageMime,
  missingCanonicalProductMediaSlots,
  planObjects,
  toSupabaseUpdates,
  assertOnlyApprovedUpdates,
  type CriticalTargetRef,
  type PlannedObject,
  type SourceFileMeta,
  type SupabaseFieldUpdate,
} from './complete-directus-media-to-r2/transform';

type Mode = 'inventory' | 'dry-run' | 'apply' | 'verify';
type Raw = Record<string, unknown>;

function parseMode(argv: string[]): Mode {
  if (argv.includes('--apply')) return 'apply';
  if (argv.includes('--verify')) return 'verify';
  if (argv.includes('--inventory')) return 'inventory';
  return 'dry-run';
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/** GET-only Directus client. Never POST/PATCH/PUT/DELETE. */
async function directusGet<T>(path: string): Promise<T> {
  const url = requireEnv('DIRECTUS_URL').replace(/\/$/, '');
  const token = process.env.DIRECTUS_ADMIN_TOKEN?.trim() || requireEnv('DIRECTUS_READ_TOKEN');
  const res = await fetch(`${url}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Directus GET ${path} → ${res.status} ${body.slice(0, 120)}`);
  }
  return res.json() as Promise<T>;
}

async function fetchAll(collection: string): Promise<Raw[]> {
  const payload = await directusGet<{ data: Raw | Raw[] }>(`/items/${collection}?limit=-1`);
  const data = payload.data;
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

async function fetchFiles(): Promise<Map<string, SourceFileMeta & { raw: Raw }>> {
  const payload = await directusGet<{ data: Raw[] }>('/files?limit=-1');
  const map = new Map<string, SourceFileMeta & { raw: Raw }>();
  for (const f of payload.data ?? []) {
    const id = String(f.id);
    map.set(id, {
      id,
      filenameDownload: (f.filename_download as string) ?? null,
      type: (f.type as string) ?? null,
      filesize: f.filesize != null ? Number(f.filesize) : null,
      width: f.width != null ? Number(f.width) : null,
      height: f.height != null ? Number(f.height) : null,
      raw: f,
    });
  }
  return map;
}

async function downloadDirectusAsset(fileId: string): Promise<Buffer> {
  const url = requireEnv('DIRECTUS_URL').replace(/\/$/, '');
  const token = process.env.DIRECTUS_ADMIN_TOKEN?.trim() || requireEnv('DIRECTUS_READ_TOKEN');
  const res = await fetch(`${url}/assets/${fileId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Directus GET /assets/${fileId} → ${res.status}`);
  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  if (buf.length <= 0) throw new Error(`Directus asset ${fileId} empty`);
  return buf;
}

async function publicHead(url: string): Promise<{ ok: boolean; status: number; contentType: string | null; length: number | null }> {
  const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': 'carzo-stage2a' } });
  return {
    ok: res.ok,
    status: res.status,
    contentType: res.headers.get('content-type'),
    length: res.headers.get('content-length') != null ? Number(res.headers.get('content-length')) : null,
  };
}

async function publicGet(url: string): Promise<{ ok: boolean; status: number; contentType: string | null; body: Buffer }> {
  const res = await fetch(url, { headers: { 'User-Agent': 'carzo-stage2a' } });
  const body = Buffer.from(await res.arrayBuffer());
  return { ok: res.ok, status: res.status, contentType: res.headers.get('content-type'), body };
}

async function verifyPublicUrl(url: string, expectedSha: string | null, expectedType: string | null): Promise<{ ok: boolean; detail: string; sha: string | null }> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const got = await publicGet(url);
    if (!got.ok) {
      if (attempt === 3) return { ok: false, detail: `HTTP ${got.status}`, sha: null };
      await new Promise((r) => setTimeout(r, 500 * attempt));
      continue;
    }
    if (got.body.length <= 0) {
      if (attempt === 3) return { ok: false, detail: 'empty body', sha: null };
      continue;
    }
    const ct = (got.contentType || '').split(';')[0].trim().toLowerCase();
    if (expectedType && ct && !ct.startsWith(expectedType.split('/')[0])) {
      return { ok: false, detail: `content-type ${ct} != ${expectedType}`, sha: null };
    }
    const sha = sha256(got.body);
    if (expectedSha && sha !== expectedSha) {
      return { ok: false, detail: 'hash mismatch', sha };
    }
    return { ok: true, detail: `bytes=${got.body.length}`, sha };
  }
  return { ok: false, detail: 'verification attempts exhausted', sha: null };
}

type S3Like = {
  send: (cmd: unknown) => Promise<unknown>;
};

async function r2Client(): Promise<S3Like> {
  const accountId = requireEnv('R2_ACCOUNT_ID');
  const accessKeyId = requireEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY');
  const { S3Client } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client as unknown as S3Like;
}

async function r2Put(client: S3Like, bucket: string, key: string, body: Buffer, contentType: string) {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.length,
    }),
  );
}

async function r2Head(client: S3Like, bucket: string, key: string): Promise<{ exists: boolean; contentLength?: number; contentType?: string; etag?: string }> {
  const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
  try {
    const out = (await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))) as {
      ContentLength?: number;
      ContentType?: string;
      ETag?: string;
    };
    return {
      exists: true,
      contentLength: out.ContentLength,
      contentType: out.ContentType,
      etag: out.ETag,
    };
  } catch (err) {
    const name = (err as { name?: string }).name || '';
    if (name === 'NotFound' || name === 'NoSuchKey') return { exists: false };
    // some S3 clients use $metadata
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return { exists: false };
    throw err;
  }
}

function supabase(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function collectCriticalRefs(
  designs: Raw[],
  richImages: Raw[],
  logo: Raw,
  mediaSettings: Raw,
  files: Map<string, SourceFileMeta & { raw: Raw }>,
): Promise<CriticalTargetRef[]> {
  const refs: CriticalTargetRef[] = [];
  const push = (
    table: CriticalTargetRef['table'],
    field: string,
    targetKey: string,
    sourceCollection: string,
    sourceField: string,
    fileUuid: string,
  ) => {
    const meta = files.get(fileUuid);
    if (!meta) throw new Error(`BLOCKED: missing Directus file metadata ${fileUuid}`);
    refs.push({
      table,
      field,
      targetKey,
      sourceCollection,
      sourceField,
      sourceFileUuid: fileUuid,
      sourceMeta: {
        id: meta.id,
        filenameDownload: meta.filenameDownload,
        type: meta.type,
        filesize: meta.filesize,
        width: meta.width,
        height: meta.height,
      },
    });
  };

  for (const d of designs) {
    const url = d.selector_image_url as string | null;
    const file = d.selector_image as string | null;
    const cls = classifyMediaRef({ externalUrl: url, fileRef: file });
    if (cls === 'FILE_ONLY' || (!url && file)) {
      if (!file) throw new Error(`BLOCKED: design ${String(d.slug)} file-only without file`);
      push('designs', 'selector_image_url', String(d.slug), 'carzo_designs', 'selector_image', file);
    }
  }

  for (const r of richImages) {
    const url = r.external_url as string | null;
    const file = r.image as string | null;
    const cls = classifyMediaRef({ externalUrl: url, fileRef: file });
    if (cls === 'FILE_ONLY' || (!url && file)) {
      if (!file) throw new Error(`BLOCKED: rich ${String(r.key)} file-only without file`);
      push('rich_section_images', 'media_url', String(r.key), 'carzo_rich_section_images', 'image', file);
    }
  }

  {
    const url = logo.fallback_image_url as string | null;
    const file = logo.fallback_image as string | null;
    const cls = classifyMediaRef({ externalUrl: url, fileRef: file });
    if (cls === 'FILE_ONLY' || (!url && file)) {
      if (!file) throw new Error('BLOCKED: logo fallback file-only without file');
      push('logo_settings', 'fallback_image_url', 'logo_settings', 'carzo_logo_settings', 'fallback_image', file);
    }
  }

  {
    const url = (mediaSettings.magnetic_system_default_cover_url ?? null) as string | null;
    const file = mediaSettings.magnetic_system_default_cover as string | null;
    const cls = classifyMediaRef({ externalUrl: url, fileRef: file });
    if (cls === 'FILE_ONLY' || (!url && file)) {
      if (!file) throw new Error('BLOCKED: magnetic_system_default_cover file-only without file');
      push(
        'product_media',
        'media_url',
        'magnetic_system_default_cover',
        'carzo_media_settings',
        'magnetic_system_default_cover',
        file,
      );
    }
  }

  return refs;
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  log(`mode=${mode}`);
  log('Directus access: GET only');
  log(`public media base: ${process.env.R2_PUBLIC_BASE_URL || PUBLIC_MEDIA_BASE}`);

  const files = await fetchFiles();
  log(`directus files total: ${files.size}`);

  const designs = await fetchAll('carzo_designs');
  const richImages = await fetchAll('carzo_rich_section_images');
  const logoRows = await fetchAll('carzo_logo_settings');
  const mediaRows = await fetchAll('carzo_media_settings');
  const contentSections = await fetchAll('carzo_content_sections');
  const logo = logoRows[0];
  const mediaSettings = mediaRows[0];
  if (!logo || !mediaSettings) throw new Error('BLOCKED: logo_settings/media_settings missing');

  const criticalRefs = await collectCriticalRefs(designs, richImages, logo, mediaSettings, files);
  log(`critical unresolved refs: ${criticalRefs.length}`);

  const emptySections = contentSections
    .map((row) => ({
      key: String(row.key),
      title: String(row.title ?? ''),
      ...classifyContentSectionNull({ externalUrl: row.external_url, fileRef: row.image }),
    }))
    .filter((r) => r.class === 'INTENTIONAL_EMPTY');
  log(`intentional empty content_sections: ${emptySections.length} → ${emptySections.map((e) => e.key).join(', ')}`);

  const unique = dedupeSourceFiles(criticalRefs);
  log(`unique source files: ${unique.size}`);

  // Preflight gap semantics vs known baseline
  const expected = expectedCriticalTargetKeys();
  const gotKeys = criticalRefs.map((r) => `${r.table}.${r.field}:${r.targetKey}`).sort();
  const wantKeys = expected.map((e) => `${e.table}.${e.field}:${e.targetKey}`).sort();
  const hidden = gotKeys.filter((k) => !wantKeys.includes(k));
  const missing = wantKeys.filter((k) => !gotKeys.includes(k));
  if (hidden.length || missing.length) {
    log(`hidden critical: ${JSON.stringify(hidden)}`);
    log(`missing vs baseline: ${JSON.stringify(missing)}`);
    if (mode !== 'inventory') {
      throw new Error('BLOCKED: inventory differs from Stage 2 baseline 8-gap set');
    }
  } else {
    log('critical gap set matches Stage 2 baseline (8)');
  }

  if (mode === 'inventory') {
    log('INVENTORY done');
    return;
  }

  // MIME check
  for (const [uuid, list] of unique) {
    const mime = list[0].sourceMeta.type;
    if (!isSupportedImageMime(mime)) {
      throw new Error(`BLOCKED: unsupported MIME for ${uuid}: ${mime}`);
    }
  }

  // Public object existence (no writes)
  const publicExists = new Map<string, boolean>();
  for (const ref of criticalRefs) {
    // planned keys computed below; probe a few canonical candidates after plan
  }

  const plan = planObjects(criticalRefs, {
    keyExists: () => false, // refined after HEAD
  });

  // refine REUSE/COPY via public HEAD + optional R2 head
  let s3: S3Like | null = null;
  let bucket = process.env.R2_BUCKET_NAME?.trim() || '';
  const canR2 = Boolean(
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && bucket,
  );
  if (canR2) {
    s3 = await r2Client();
    log(`r2: ready bucket=${bucket}`);
  } else {
    log('r2: credentials incomplete — apply will require R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME');
  }

  const sourceSha = new Map<string, string>();
  const tmpDir = await mkdtemp(join(tmpdir(), 'carzo-stage2a-'));
  const downloaded = new Map<string, Buffer>();

  for (const obj of plan) {
    const head = await publicHead(obj.publicUrl);
    publicExists.set(obj.r2Key, head.ok);
    if (s3 && bucket) {
      try {
        const rh = await r2Head(s3, bucket, obj.r2Key);
        if (rh.exists) publicExists.set(obj.r2Key, true);
      } catch {
        // ignore head errors in dry-run
      }
    }
    if (head.ok) {
      // compare hash when practical
      const got = await publicGet(obj.publicUrl);
      const remoteSha = sha256(got.body);
      let localSha = sourceSha.get(obj.sourceFileUuid);
      if (!localSha) {
        const bytes = await downloadDirectusAsset(obj.sourceFileUuid);
        downloaded.set(obj.sourceFileUuid, bytes);
        localSha = sha256(bytes);
        sourceSha.set(obj.sourceFileUuid, localSha);
        await writeFile(join(tmpDir, `${obj.sourceFileUuid}.bin`), bytes);
      }
      if (remoteSha === localSha) {
        obj.action = 'REUSE';
        obj.reason = 'existing public object hash matches Directus source';
      } else {
        obj.action = 'COPY';
        obj.reason = 'BLOCKED: existing key has different bytes — do not overwrite';
      }
    } else {
      obj.action = 'COPY';
      obj.reason = 'missing on public R2 — copy Directus bytes';
    }
    log(
      `plan ${obj.action} ${obj.r2Key} uuid=${obj.sourceFileUuid.slice(0, 8)} refs=${obj.targetRefs.length} reason=${obj.reason}`,
    );
  }

  const blockedPlan = plan.filter((p) => p.reason.startsWith('BLOCKED'));
  if (blockedPlan.length) {
    for (const b of blockedPlan) log(`BLOCKED PLAN ${b.r2Key}: ${b.reason}`);
    throw new Error('BLOCKED: unresolved R2 object-key collisions');
  }

  const updates = toSupabaseUpdates(criticalRefs, plan);
  assertOnlyApprovedUpdates(updates);
  log(`supabase updates planned: ${updates.length}`);
  for (const u of updates) {
    if ('insert' in u) log(`  insert product_media ${u.insert.slot}`);
    else log(`  update ${u.table} ${JSON.stringify(u.where)} → ${Object.keys(u.set).join(',')}`);
  }

  if (mode === 'dry-run') {
    log('DRY-RUN PASS');
    log(`copied=0 reused=${plan.filter((p) => p.action === 'REUSE').length} copy_planned=${plan.filter((p) => p.action === 'COPY').length}`);
    await rm(tmpDir, { recursive: true, force: true });
    return;
  }

  if (mode === 'verify') {
    await runVerify(plan, criticalRefs, emptySections);
    await rm(tmpDir, { recursive: true, force: true });
    return;
  }

  // apply
  if (!s3 || !bucket) {
    throw new Error('BLOCKED: missing env R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME');
  }
  const hasSupabaseEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
  if (!hasSupabaseEnv) {
    log('supabase env missing — R2 apply/verify only; apply media URL updates via Supabase MCP');
  }

  let copied = 0;
  let reused = 0;
  for (const obj of plan) {
    if (obj.action === 'REUSE') {
      reused += 1;
      log(`REUSE ${obj.publicUrl}`);
      continue;
    }
    let bytes = downloaded.get(obj.sourceFileUuid);
    if (!bytes) {
      bytes = await downloadDirectusAsset(obj.sourceFileUuid);
      downloaded.set(obj.sourceFileUuid, bytes);
      sourceSha.set(obj.sourceFileUuid, sha256(bytes));
    }
    if (!isSupportedImageMime(obj.contentType)) {
      throw new Error(`BLOCKED: unsupported MIME ${obj.contentType}`);
    }
    // never overwrite differing bytes
    const existing = publicExists.get(obj.r2Key);
    if (existing) {
      throw new Error(`BLOCKED: refusing overwrite of existing different object ${obj.r2Key}`);
    }
    await r2Put(s3, bucket, obj.r2Key, bytes, obj.contentType);
    copied += 1;
    log(`COPY ${obj.r2Key} bytes=${bytes.length}`);

    // verify public URL before Supabase update
    const expectedSha = sourceSha.get(obj.sourceFileUuid) ?? null;
    const v = await verifyPublicUrl(obj.publicUrl, expectedSha, obj.contentType);
    if (!v.ok) {
      throw new Error(`BLOCKED: public verification failed for ${obj.publicUrl}: ${v.detail}`);
    }
    log(`verified ${obj.publicUrl} ${v.detail}`);
    obj.action = 'REUSE'; // now present
    obj.reason = 'uploaded and verified';
  }

  log(`r2 result: copied=${copied} reused=${reused}`);

  if (!hasSupabaseEnv) {
    log('skipping Supabase updates (no env). Apply these exact updates via MCP:');
    for (const u of updates) {
      log(`  ${JSON.stringify(u)}`);
    }
    await runVerify(plan, criticalRefs, emptySections);
    await rm(tmpDir, { recursive: true, force: true });
    log('APPLY R2 done — Supabase pending');
    return;
  }

  // Supabase narrow updates
  const db = supabase();
  for (const u of updates) {
    if ('insert' in u) {
      const { error, count } = await db
        .from('product_media')
        .upsert([u.insert], { onConflict: 'slot', count: 'exact' });
      if (error) throw new Error(`product_media upsert: ${error.message}`);
      log(`product_media insert/upsert ${u.insert.slot} count=${count ?? 1}`);
    } else if (u.table === 'designs') {
      const { error, count } = await db
        .from('designs')
        .update(u.set)
        .eq('slug', u.where.slug)
        .select('slug');
      if (error) throw new Error(`designs update: ${error.message}`);
      if ((count ?? 0) !== 1) throw new Error(`BLOCKED: designs update rows=${count} for ${u.where.slug}`);
      log(`designs.selector_image_url ← ${u.where.slug}`);
    } else if (u.table === 'rich_section_images') {
      const { error, count } = await db
        .from('rich_section_images')
        .update(u.set)
        .eq('key', u.where.key)
        .select('key');
      if (error) throw new Error(`rich_section_images update: ${error.message}`);
      if ((count ?? 0) !== 1) throw new Error(`BLOCKED: rich_section_images update rows=${count} for ${u.where.key}`);
      log(`rich_section_images.media_url ← ${u.where.key}`);
    } else if (u.table === 'logo_settings') {
      const { error, count } = await db.from('logo_settings').update(u.set).select('id');
      if (error) throw new Error(`logo_settings update: ${error.message}`);
      if ((count ?? 0) !== 1) throw new Error(`BLOCKED: logo_settings update rows=${count}`);
      log('logo_settings.fallback_image_url updated');
    }
  }

  await runVerify(plan, criticalRefs, emptySections);
  await rm(tmpDir, { recursive: true, force: true });
  log('APPLY done');
}

async function runVerify(
  plan: PlannedObject[],
  criticalRefs: CriticalTargetRef[],
  emptySections: Array<{ key: string; class: string }>,
) {
  log('--- verify ---');
  for (const obj of plan) {
    const v = await verifyPublicUrl(obj.publicUrl, null, obj.contentType);
    if (!v.ok) throw new Error(`verify failed ${obj.publicUrl}: ${v.detail}`);
    if (!isSafePublicMediaUrl(obj.publicUrl)) throw new Error(`unsafe public URL ${obj.publicUrl}`);
    log(`ok ${obj.publicUrl}`);
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    log('verify: Supabase env missing — skipped DB checks');
    return;
  }
  const db = supabase();

  const { data: designRows, error: dErr } = await db
    .from('designs')
    .select('slug, selector_image_url');
  if (dErr) throw new Error(dErr.message);
  const nullDesigns = (designRows ?? []).filter((r) => !r.selector_image_url);
  log(`designs.selector_image_url critical NULL = ${nullDesigns.length}`);
  if (nullDesigns.length) throw new Error('BLOCKED: designs selector still NULL');

  const { data: richRows, error: rErr } = await db
    .from('rich_section_images')
    .select('key, media_url');
  if (rErr) throw new Error(rErr.message);
  const nullRich = (richRows ?? []).filter((r) => String(r.key).endsWith(':rich-magnets') && !r.media_url);
  log(`rich-magnets media_url NULL = ${nullRich.length}`);
  if (nullRich.length) throw new Error('BLOCKED: rich-magnets still NULL');

  const { data: logoRow, error: lErr } = await db.from('logo_settings').select('fallback_image_url').single();
  if (lErr) throw new Error(lErr.message);
  if (!logoRow?.fallback_image_url) throw new Error('BLOCKED: logo fallback still NULL');
  log('logo fallback populated');

  const { data: pmRows, error: pErr } = await db.from('product_media').select('slot, media_url');
  if (pErr) throw new Error(pErr.message);
  const slots = (pmRows ?? []).map((r) => String(r.slot));
  log(`product_media count = ${slots.length}`);
  if (slots.length !== 17) throw new Error(`BLOCKED: product_media count ${slots.length} != 17`);
  const missing = missingCanonicalProductMediaSlots(slots);
  if (missing.length) throw new Error(`BLOCKED: missing slots ${missing.join(',')}`);
  if (!slots.includes('magnetic_system_default_cover')) {
    throw new Error('BLOCKED: magnetic_system_default_cover missing');
  }

  // Directus refs scan
  const { data: scan1 } = await db.from('designs').select('selector_image_url');
  const { data: scan2 } = await db.from('rich_section_images').select('media_url');
  const { data: scan3 } = await db.from('logo_settings').select('fallback_image_url');
  const { data: scan4 } = await db.from('product_media').select('media_url');
  const values = [
    ...(scan1 ?? []).map((r) => r.selector_image_url),
    ...(scan2 ?? []).map((r) => r.media_url),
    ...(scan3 ?? []).map((r) => r.fallback_image_url),
    ...(scan4 ?? []).map((r) => r.media_url),
  ];
  const bad = values.filter(
    (v) =>
      typeof v === 'string' &&
      (v.includes('/assets/') || v.includes('/api/directus-assets/') || v.includes('directus-production')),
  );
  log(`directus refs in target media fields = ${bad.length}`);
  if (bad.length) throw new Error('BLOCKED: Directus media refs remain in target');

  // structured invariants
  const counts: Record<string, number> = {};
  for (const t of [
    'designs',
    'sizes',
    'brands',
    'variants',
    'fixations',
    'fixation_size_extras',
    'discount_tiers',
    'gallery_images',
    'content_sets',
    'content_sections',
    'faq_items',
    'rich_sections',
    'rich_section_images',
    'benefit_modals',
    'logo_settings',
    'site_settings',
    'homepage_settings',
    'about_settings',
    'review_settings',
    'video_review_settings',
    'car_mat_settings',
    'pages',
    'page_blocks',
    'notification_settings',
    'orders',
    'order_items',
    'customers',
  ]) {
    const { count } = await db.from(t).select('*', { count: 'exact', head: true });
    counts[t] = count ?? -1;
  }
  counts.product_media = slots.length;
  log(`counts ${JSON.stringify(counts)}`);

  const expectedCounts: Record<string, number> = {
    designs: 3,
    sizes: 4,
    brands: 26,
    variants: 12,
    fixations: 4,
    fixation_size_extras: 16,
    discount_tiers: 2,
    gallery_images: 57,
    content_sets: 16,
    content_sections: 48,
    faq_items: 8,
    rich_sections: 4,
    rich_section_images: 12,
    benefit_modals: 6,
    logo_settings: 1,
    site_settings: 1,
    homepage_settings: 1,
    about_settings: 1,
    review_settings: 1,
    video_review_settings: 1,
    car_mat_settings: 1,
    pages: 4,
    page_blocks: 5,
    notification_settings: 1,
    orders: 10,
    order_items: 17,
    customers: 5994,
    product_media: 17,
  };
  for (const [t, n] of Object.entries(expectedCounts)) {
    if (counts[t] !== n) throw new Error(`BLOCKED: ${t} count ${counts[t]} != ${n}`);
  }

  log(`intentional empty sections: ${emptySections.map((e) => e.key).join(', ')}`);
  log('VERIFY PASS');
}

main().catch((err) => {
  log(`ERROR ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
