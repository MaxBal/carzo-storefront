/**
 * Pure Stage 2A media-completion tests (no network).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  APPROVED_UPDATES,
  PUBLIC_MEDIA_BASE,
  PRODUCT_MEDIA_SLOTS,
  buildPublicUrl,
  canonicalObjectKey,
  classifyContentSectionNull,
  classifyMediaRef,
  dedupeSourceFiles,
  expectedCriticalTargetKeys,
  isForbiddenTargetMediaUrl,
  isSafePublicMediaUrl,
  isSupportedImageMime,
  KNOWN_CRITICAL_GAP_COUNT,
  KNOWN_UNIQUE_SOURCE_FILE_COUNT,
  missingCanonicalProductMediaSlots,
  planObjects,
  toSupabaseUpdates,
  assertOnlyApprovedUpdates,
  type CriticalTargetRef,
} from '../scripts/complete-directus-media-to-r2/transform';

const FILE_SELECTOR = 'd3bb1465-a5a6-40a5-9493-2f444931a026';
const FILE_MAGNETS = '0c724340-1362-45fa-af6f-42e7c3379b16';
const FILE_MAGNETS_4 = 'd5cfd8b2-c687-40d0-b0ce-88b5a5fc1b23';

function meta(id: string, type = 'image/jpeg') {
  return {
    id,
    filenameDownload: 'x.jpg',
    type,
    filesize: 100,
    width: 10,
    height: 10,
  };
}

function knownEightGaps(): CriticalTargetRef[] {
  return [
    {
      table: 'designs',
      field: 'selector_image_url',
      targetKey: '2-0',
      sourceCollection: 'carzo_designs',
      sourceField: 'selector_image',
      sourceFileUuid: FILE_SELECTOR,
      sourceMeta: meta(FILE_SELECTOR),
    },
    {
      table: 'designs',
      field: 'selector_image_url',
      targetKey: '3-0',
      sourceCollection: 'carzo_designs',
      sourceField: 'selector_image',
      sourceFileUuid: FILE_SELECTOR,
      sourceMeta: meta(FILE_SELECTOR),
    },
    {
      table: 'designs',
      field: 'selector_image_url',
      targetKey: '4-0',
      sourceCollection: 'carzo_designs',
      sourceField: 'selector_image',
      sourceFileUuid: FILE_SELECTOR,
      sourceMeta: meta(FILE_SELECTOR),
    },
    {
      table: 'rich_section_images',
      field: 'media_url',
      targetKey: '2-0:rich-magnets',
      sourceCollection: 'carzo_rich_section_images',
      sourceField: 'image',
      sourceFileUuid: FILE_MAGNETS,
      sourceMeta: meta(FILE_MAGNETS),
    },
    {
      table: 'rich_section_images',
      field: 'media_url',
      targetKey: '3-0:rich-magnets',
      sourceCollection: 'carzo_rich_section_images',
      sourceField: 'image',
      sourceFileUuid: FILE_MAGNETS,
      sourceMeta: meta(FILE_MAGNETS),
    },
    {
      table: 'rich_section_images',
      field: 'media_url',
      targetKey: '4-0:rich-magnets',
      sourceCollection: 'carzo_rich_section_images',
      sourceField: 'image',
      sourceFileUuid: FILE_MAGNETS_4,
      sourceMeta: meta(FILE_MAGNETS_4),
    },
    {
      table: 'logo_settings',
      field: 'fallback_image_url',
      targetKey: 'logo_settings',
      sourceCollection: 'carzo_logo_settings',
      sourceField: 'fallback_image',
      sourceFileUuid: FILE_SELECTOR,
      sourceMeta: meta(FILE_SELECTOR),
    },
    {
      table: 'product_media',
      field: 'media_url',
      targetKey: 'magnetic_system_default_cover',
      sourceCollection: 'carzo_media_settings',
      sourceField: 'magnetic_system_default_cover',
      sourceFileUuid: FILE_MAGNETS,
      sourceMeta: meta(FILE_MAGNETS),
    },
  ];
}

test('1. known 8-gap classification', () => {
  const refs = knownEightGaps();
  assert.equal(refs.length, KNOWN_CRITICAL_GAP_COUNT);
  const expected = expectedCriticalTargetKeys();
  assert.equal(expected.length, 8);
  const got = refs.map((r) => `${r.table}.${r.field}:${r.targetKey}`).sort();
  const want = expected.map((e) => `${e.table}.${e.field}:${e.targetKey}`).sort();
  assert.deepEqual(got, want);
  for (const r of refs) {
    assert.equal(classifyMediaRef({ externalUrl: null, fileRef: r.sourceFileUuid }), 'FILE_ONLY');
    assert.ok(isSupportedImageMime(r.sourceMeta.type));
  }
});

test('2. source file UUID deduplication', () => {
  const refs = knownEightGaps();
  const byUuid = dedupeSourceFiles(refs);
  assert.equal(byUuid.size, KNOWN_UNIQUE_SOURCE_FILE_COUNT);
  assert.equal(byUuid.get(FILE_SELECTOR)?.length, 4);
  assert.equal(byUuid.get(FILE_MAGNETS)?.length, 3);
  assert.equal(byUuid.get(FILE_MAGNETS_4)?.length, 1);
});

test('3. canonical object-key generation', () => {
  assert.equal(
    canonicalObjectKey({
      table: 'designs',
      targetKey: '2-0',
      sourceFileUuid: FILE_SELECTOR,
      sourceExt: 'jpg',
    }),
    'content/products/case/designs/selector-default.jpg',
  );
  assert.equal(
    canonicalObjectKey({
      table: 'rich_section_images',
      targetKey: '4-0:rich-magnets',
      sourceFileUuid: FILE_MAGNETS_4,
      sourceExt: 'jpg',
    }),
    'content/products/case/rich-content/design-4.0/magnets.jpg',
  );
});

test('4. extension/MIME preservation', () => {
  assert.equal(
    canonicalObjectKey({
      table: 'rich_section_images',
      targetKey: '4-0:rich-magnets',
      sourceFileUuid: FILE_MAGNETS_4,
      sourceExt: 'jpg',
    }).endsWith('.jpg'),
    true,
  );
  assert.equal(isSupportedImageMime('image/jpeg'), true);
  assert.equal(isSupportedImageMime('image/svg+xml'), false);
  assert.equal(isSupportedImageMime('video/mp4'), false);
});

test('5. existing matching R2 object → REUSE', () => {
  const key = 'content/products/case/designs/selector-default.jpg';
  const objects = planObjects(knownEightGaps(), {
    keyExists: (k) => k === key,
    existingSha256: (k) => (k === key ? 'aaa' : null),
    sourceSha256: (id) => (id === FILE_SELECTOR ? 'aaa' : null),
  });
  const sel = objects.find((o) => o.sourceFileUuid === FILE_SELECTOR);
  assert.equal(sel?.action, 'REUSE');
});

test('6. existing different bytes → collision/no overwrite', () => {
  const key = 'content/products/case/designs/selector-default.jpg';
  const objects = planObjects(knownEightGaps(), {
    keyExists: (k) => k === key,
    existingSha256: (k) => (k === key ? 'remote' : null),
    sourceSha256: (id) => (id === FILE_SELECTOR ? 'local' : null),
  });
  const sel = objects.find((o) => o.sourceFileUuid === FILE_SELECTOR);
  assert.match(sel?.reason || '', /different bytes/);
  assert.equal(sel?.action, 'COPY');
});

test('7. canonical 17 product_media slots', () => {
  assert.equal(PRODUCT_MEDIA_SLOTS.length, 17);
  assert.ok(PRODUCT_MEDIA_SLOTS.includes('magnetic_system_default_cover'));
  const missing = missingCanonicalProductMediaSlots([
    'materials_video',
    'edging_video',
    'fixation_video',
    'magnetic_system_video',
    ...PRODUCT_MEDIA_SLOTS.filter((s) => s.startsWith('magnetic_system_cover_')),
  ]);
  assert.deepEqual(missing, ['magnetic_system_default_cover']);
});

test('8. content section no-file NULL → INTENTIONAL_EMPTY', () => {
  const r = classifyContentSectionNull({ externalUrl: null, fileRef: null });
  assert.equal(r.class, 'INTENTIONAL_EMPTY');
  assert.equal(r.action, 'KEEP_NULL');
  const r2 = classifyContentSectionNull({ externalUrl: null, fileRef: FILE_SELECTOR });
  assert.equal(r2.class, 'HAS_SOURCE');
});

test('9. Directus file UUID never becomes target URL', () => {
  assert.equal(isForbiddenTargetMediaUrl(FILE_SELECTOR), true);
  assert.equal(isForbiddenTargetMediaUrl('https://directus.example/assets/abc'), true);
  assert.equal(isForbiddenTargetMediaUrl('/api/directus-assets/1'), true);
  assert.equal(isForbiddenTargetMediaUrl('https://media.carzo.com.ua/content/x.jpg'), false);

  const updates = toSupabaseUpdates(knownEightGaps(), [
    {
      r2Key: 'content/products/case/designs/selector-default.jpg',
      publicUrl: FILE_SELECTOR,
      sourceFileUuid: FILE_SELECTOR,
      contentType: 'image/jpeg',
      sourceExt: 'jpg',
      targetRefs: [],
      action: 'COPY',
      reason: 'test',
    },
    {
      r2Key: 'content/products/case/rich-content/design-2.0/magnets.jpg',
      publicUrl: buildPublicUrl('content/products/case/rich-content/design-2.0/magnets.jpg'),
      sourceFileUuid: FILE_MAGNETS,
      contentType: 'image/jpeg',
      sourceExt: 'jpg',
      targetRefs: [],
      action: 'COPY',
      reason: 'test',
    },
    {
      r2Key: 'content/products/case/rich-content/design-4.0/magnets.jpg',
      publicUrl: buildPublicUrl('content/products/case/rich-content/design-4.0/magnets.jpg'),
      sourceFileUuid: FILE_MAGNETS_4,
      contentType: 'image/jpeg',
      sourceExt: 'jpg',
      targetRefs: [],
      action: 'COPY',
      reason: 'test',
    },
  ]);
  // FILE_SELECTOR publicUrl is a UUID → filtered out
  assert.ok(!updates.some((u) => 'set' in u && Object.values(u.set).includes(FILE_SELECTOR)));
});

test('10. public URL construction uses media.carzo.com.ua', () => {
  const url = buildPublicUrl('content/products/case/designs/selector-default.jpg');
  assert.equal(url, `${PUBLIC_MEDIA_BASE}/content/products/case/designs/selector-default.jpg`);
  assert.ok(isSafePublicMediaUrl(url));
  assert.equal(isSafePublicMediaUrl('https://account.r2.cloudflarestorage.com/b/k'), false);
  assert.equal(isSafePublicMediaUrl('https://media.carzo.com.ua/x?X-Amz-Signature=1'), false);
});

test('11. only approved Supabase fields can be updated', () => {
  assert.ok(APPROVED_UPDATES.has('designs.selector_image_url'));
  const updates = toSupabaseUpdates(knownEightGaps(), planObjects(knownEightGaps(), {
    keyExists: () => false,
  }));
  assert.doesNotThrow(() => assertOnlyApprovedUpdates(updates));
  assert.throws(() =>
    assertOnlyApprovedUpdates([
      {
        table: 'designs',
        where: { slug: '2-0' },
        set: { selector_image_url: 'https://media.carzo.com.ua/a.jpg', label: 'hack' },
      } as never,
    ]),
  );
  assert.throws(() =>
    assertOnlyApprovedUpdates([
      {
        table: 'product_media',
        insert: { slot: 'legacy_extra', media_url: 'https://media.carzo.com.ua/a.jpg' },
      },
    ]),
  );
});
