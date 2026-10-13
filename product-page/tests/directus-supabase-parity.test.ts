/**
 * Pure Stage 3 parity tests (no network).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  APPROVED_INTENTIONAL_TRANSFORMS,
  PRODUCT_MEDIA_SLOTS,
  assertNoSecrets,
  brandPricingEqual,
  canonicalBlock,
  canonicalPage,
  classifyManagerNote,
  classifyMediaRef,
  compareCanonicalBlocks,
  comparePiiField,
  countDuplicates,
  countOrphans,
  deepDiff,
  deepEqual,
  fixationExtraEqual,
  formatPiiMismatchCounts,
  isApprovedR2Url,
  isDirectusFileUuid,
  isForbiddenTargetMediaUrl,
  isIntentionalEmptyMediaKey,
  loyaltyTransformEqual,
  mediaSemanticEqual,
  mediaUrlSemanticEqual,
  missingCanonicalProductMediaSlots,
  normalizeQuoteForCompare,
  sortKeysDeep,
  stripDirectusFileIds,
} from '../scripts/verify-directus-supabase-parity/transform';

test('brand-pricing canonical comparison uses brand_pricing authority', () => {
  assert.equal(brandPricingEqual(290, 290), true);
  assert.equal(brandPricingEqual(0, 0), true);
  assert.equal(brandPricingEqual(290, 0), false);
  assert.equal(brandPricingEqual(null, 0), true);
});

test('fixation-extra canonical comparison expands extra_by_size', () => {
  const target = [
    { sizeCode: 's', extra: 60 },
    { sizeCode: 'm', extra: 80 },
    { sizeCode: 'l', extra: 100 },
    { sizeCode: 'xl', extra: 120 },
  ];
  assert.equal(fixationExtraEqual({ s: 60, m: 80, l: 100, xl: 120 }, 80, target), true);
  assert.equal(fixationExtraEqual({ s: 60, m: 80, l: 100, xl: 130 }, 80, target), false);
  assert.equal(fixationExtraEqual({ s: 0, m: 0, l: 0, xl: 0 }, 0, [
    { sizeCode: 's', extra: 0 },
    { sizeCode: 'm', extra: 0 },
    { sizeCode: 'l', extra: 0 },
    { sizeCode: 'xl', extra: 0 },
  ]), true);
});

test('quote normalization ignores verifiedAt', () => {
  const a = normalizeQuoteForCompare({ total: 100, verifiedAt: '2026-01-01T00:00:00Z' });
  const b = normalizeQuoteForCompare({ total: 100, verifiedAt: '2026-02-02T00:00:00Z' });
  assert.equal(deepEqual(a, b), true);
  assert.equal('verifiedAt' in a, false);
});

test('intentional-transform allow-list covers approved diffs', () => {
  assert.ok(APPROVED_INTENTIONAL_TRANSFORMS.length >= 14);
  assert.ok(APPROVED_INTENTIONAL_TRANSFORMS.some(x => x.includes('brand_pricing')));
  assert.ok(APPROVED_INTENTIONAL_TRANSFORMS.some(x => x.includes('bot_token')));
  assert.ok(APPROVED_INTENTIONAL_TRANSFORMS.some(x => x.includes('checkout_attempt_id')));
  assert.ok(APPROVED_INTENTIONAL_TRANSFORMS.some(x => x.includes('intentional-empty')));
});

test('PII comparator emits counts only', () => {
  const result = comparePiiField('customer_name', 'Alice', 'Bob');
  assert.equal(result.label, 'customer_name');
  assert.equal(result.mismatchCount, 1);
  const lines = formatPiiMismatchCounts([result, comparePiiField('customer_phone', '1', '1')]);
  assert.deepEqual(lines, ['customer_name mismatch count = 1', 'customer_phone mismatch count = 0']);
  assert.ok(!lines.some(line => line.includes('Alice') || line.includes('Bob')));
});

test('loyalty JSON comparator maps manager_note to loyalty columns', () => {
  const note = JSON.stringify({
    loyalty: {
      phone: '+380501112233',
      eligible: true,
      discount_percent: 5,
      discount_amount: 120,
      phone_mismatch: false,
    },
  });
  assert.equal(classifyManagerNote(note).kind, 'loyalty');
  const ok = loyaltyTransformEqual(note, {
    loyalty_phone: '+380501112233',
    loyalty_eligible: true,
    loyalty_discount_percent: 5,
    loyalty_discount_amount: 120,
    loyalty_phone_mismatch: false,
    manager_note: null,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.unknownJson, false);
  const bad = loyaltyTransformEqual('{"foo":1}', {
    loyalty_phone: null,
    loyalty_eligible: false,
    loyalty_discount_percent: 0,
    loyalty_discount_amount: 0,
    loyalty_phone_mismatch: false,
    manager_note: null,
  });
  assert.equal(bad.unknownJson, true);
});

test('R2/Directus media normalization accepts R2 only as target', () => {
  assert.equal(classifyMediaRef('https://media.carzo.com.ua/a.jpg'), 'r2');
  assert.equal(classifyMediaRef('e7baba3c-f38d-4bf9-8f3d-56172f6d061d'), 'directus');
  assert.equal(classifyMediaRef(null), 'empty');
  assert.equal(isApprovedR2Url('https://media.carzo.com.ua/x.png'), true);
  assert.equal(isApprovedR2Url('https://evil.example/x.png'), false);
  assert.equal(mediaSemanticEqual('d3bb1465-a5a6-40a5-9493-2f444931a026', 'https://media.carzo.com.ua/content/products/case/designs/selector-default.jpg', new Map([
    ['d3bb1465-a5a6-40a5-9493-2f444931a026', 'https://media.carzo.com.ua/content/products/case/designs/selector-default.jpg'],
  ])), true);
});

test('canonical product_media slot set has 17 slots', () => {
  assert.equal(PRODUCT_MEDIA_SLOTS.length, 17);
  assert.equal(missingCanonicalProductMediaSlots([...PRODUCT_MEDIA_SLOTS]).length, 0);
  assert.deepEqual(missingCanonicalProductMediaSlots(['materials_video']), [
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
  ]);
});

test('intentional-empty media handling allows fixation-bottom/wall', () => {
  assert.equal(isIntentionalEmptyMediaKey('fixation-bottom'), true);
  assert.equal(isIntentionalEmptyMediaKey('fixation-wall'), true);
  assert.equal(isIntentionalEmptyMediaKey('fixation-both'), false);
  assert.equal(isIntentionalEmptyMediaKey('2-0:rich-magnets'), false);
});

test('reject Directus file UUID as target media URL', () => {
  assert.equal(isDirectusFileUuid('e7baba3c-f38d-4bf9-8f3d-56172f6d061d'), true);
  assert.equal(isForbiddenTargetMediaUrl('e7baba3c-f38d-4bf9-8f3d-56172f6d061d'), true);
  assert.equal(isForbiddenTargetMediaUrl('https://media.carzo.com.ua/a.jpg'), false);
  assert.equal(isForbiddenTargetMediaUrl('https://directus-production-7c9b.up.railway.app/assets/x'), true);
  assert.equal(isForbiddenTargetMediaUrl('/api/directus-assets/x'), true);
});

test('page/block canonicalization compares SEO and block fields', () => {
  const page = canonicalPage({
    key: 'home',
    slug: 'home',
    title: 'Головна',
    page_type: 'landing',
    status: 'published',
    no_index: false,
    show_header: true,
    show_footer: true,
    seo_title: 'T',
    seo_description: 'D',
  });
  assert.equal(page.slug, 'home');
  assert.equal(page.page_type, 'landing');
  const block = canonicalBlock({
    key: 'home-hero',
    page_id: 'p1',
    block_type: 'hero',
    sort: 1,
    title: 'T',
    body: 'B',
    image_url: 'https://media.carzo.com.ua/x.jpg',
    primary_label: 'Go',
    primary_url: '/x',
    anchor: null,
    theme: 'dark',
    status: 'published',
  });
  assert.equal(block.block_type, 'hero');
  assert.equal(block.image_url, 'https://media.carzo.com.ua/x.jpg');
  assert.equal(block.primary_label, 'Go');
  assert.equal(deepEqual(canonicalPage({ ...page }), page), true);
});

test('canonicalBlock maps Directus page relation and Stage 2 fields', () => {
  const source = canonicalBlock({
    key: 'home-features',
    page: { id: '11111111-1111-1111-1111-111111111111' },
    block_type: 'feature_grid',
    title: 'T',
    eyebrow: 'E',
    subtitle: 'S',
    body: null,
    items: [
      { title: 'A', text: 'B', image: 'e7baba3c-f38d-4bf9-8f3d-56172f6d061d' },
    ],
    image_url: 'e7baba3c-f38d-4bf9-8f3d-56172f6d061d',
    image_alt: 'alt',
    image_position: 'right',
    theme: 'soft',
    primary_label: null,
    primary_url: null,
    secondary_label: null,
    secondary_url: null,
    anchor: null,
    sort: 3,
    status: 'published',
  });
  assert.equal(source.page_id, '11111111-1111-1111-1111-111111111111');
  assert.equal(source.sort, 3);
  assert.deepEqual(source.items, [{ title: 'A', text: 'B' }]);
  const target = canonicalBlock({
    key: 'home-features',
    page_id: '11111111-1111-1111-1111-111111111111',
    block_type: 'feature_grid',
    title: 'T',
    eyebrow: 'E',
    subtitle: 'S',
    body: null,
    items: [{ text: 'B', title: 'A' }],
    image_url: 'https://media.carzo.com.ua/content/home-features.jpg',
    image_alt: 'alt',
    image_position: 'right',
    theme: 'soft',
    primary_label: null,
    primary_url: null,
    secondary_label: null,
    secondary_url: null,
    anchor: null,
    sort: 3,
    status: 'published',
  });
  const cmp = compareCanonicalBlocks(
    {
      key: 'home-features',
      page: '11111111-1111-1111-1111-111111111111',
      block_type: 'feature_grid',
      title: 'T',
      eyebrow: 'E',
      subtitle: 'S',
      body: null,
      items: [{ title: 'A', text: 'B', image: 'e7baba3c-f38d-4bf9-8f3d-56172f6d061d' }],
      image: 'e7baba3c-f38d-4bf9-8f3d-56172f6d061d',
      image_url: 'e7baba3c-f38d-4bf9-8f3d-56172f6d061d',
      image_alt: 'alt',
      image_position: 'right',
      theme: 'soft',
      sort: 3,
      status: 'published',
    },
    target,
  );
  assert.equal(cmp.ok, true, cmp.paths.join(' | '));
});

test('media semantic accepts approved Directus-file → R2', () => {
  assert.equal(mediaUrlSemanticEqual(
    'e7baba3c-f38d-4bf9-8f3d-56172f6d061d',
    'https://media.carzo.com.ua/a.jpg',
  ), true);
  assert.equal(mediaUrlSemanticEqual(
    'https://media.carzo.com.ua/a.jpg',
    'https://media.carzo.com.ua/a.jpg',
  ), true);
  assert.equal(mediaUrlSemanticEqual(
    'https://media.carzo.com.ua/a.jpg',
    'https://media.carzo.com.ua/b.jpg',
  ), false);
  assert.equal(mediaUrlSemanticEqual(null, null), true);
  assert.equal(mediaUrlSemanticEqual(
    'https://media.carzo.com.ua/a.jpg',
    'e7baba3c-f38d-4bf9-8f3d-56172f6d061d',
  ), false);
});

test('deepEqual sorts keys recursively and preserves array order', () => {
  assert.equal(deepEqual({ b: 1, a: { d: 2, c: 3 } }, { a: { c: 3, d: 2 }, b: 1 }), true);
  assert.equal(deepEqual([{ x: 1, y: 2 }], [{ y: 2, x: 1 }]), true);
  assert.equal(deepEqual([1, 2], [2, 1]), false);
  assert.equal(deepEqual({ a: undefined }, { a: null }), true);
  assert.deepEqual(sortKeysDeep({ b: 1, a: 2 }), { a: 2, b: 1 });
});

test('stripDirectusFileIds removes file UUIDs and image keys', () => {
  assert.deepEqual(stripDirectusFileIds({
    title: 'A',
    text: 'B',
    image: 'e7baba3c-f38d-4bf9-8f3d-56172f6d061d',
    nested: { file: 'x', ok: 1 },
  }), { title: 'A', text: 'B', nested: { ok: 1 } });
  assert.equal(stripDirectusFileIds('e7baba3c-f38d-4bf9-8f3d-56172f6d061d'), null);
});

test('deepDiff reports safe field paths', () => {
  const paths = deepDiff({ title: 'A', items: [{ t: 1 }] }, { title: 'B', items: [{ t: 1 }] });
  assert.equal(paths.length, 1);
  assert.ok(paths[0].includes('title'));
  assert.ok(!paths[0].includes('password'));
});

test('content-source canonicalization uses key sets and counts', () => {
  const dx = [{ key: 'a' }, { key: 'b' }];
  const tg = [{ key: 'b' }, { key: 'a' }];
  assert.equal(countDuplicates(dx, r => String(r.key)), 0);
  assert.equal(countDuplicates([...dx, { key: 'a' }], r => String(r.key)), 1);
  assert.equal(countOrphans(
    [{ id: '1', parent: 'p1' }, { id: '2', parent: 'missing' }],
    [{ id: 'p1' }],
    r => r.parent,
    r => r.id,
  ), 1);
  assert.equal(new Set(dx.map(r => r.key)).size, new Set(tg.map(r => r.key)).size);
});

test('assertNoSecrets detects leaked bot tokens', () => {
  assert.equal(assertNoSecrets({ message: 'x bot_token=SECRET' }, ['SECRET']).length, 1);
  assert.equal(assertNoSecrets({ message: 'clean' }, ['SECRET']).length, 0);
});
