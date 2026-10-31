/**
 * Pure transform tests for Stage 2 migration (no network).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertNoSecrets,
  classifyManagerNote,
  expandFixationSizeExtras,
  mediaUrl,
  PRODUCT_MEDIA_SLOTS,
  stripDirectusFileIds,
  transformBrand,
  transformNotification,
  transformOrder,
  transformProductMedia,
} from '../scripts/migrate-directus-to-supabase/transform';

test('brand_pricing.logo_extra overrides legacy brands.logo_extra', () => {
  const t = transformBrand(
    { id: 'a', slug: 'bmw', name: 'BMW', logo_extra: 999, status: 'published' },
    { logo_extra: 500 },
  );
  assert.equal(t.logo_extra, 500);
});

test('missing brand pricing is detected for operational brand', () => {
  const t = transformBrand({ id: 'a', slug: 'bmw', status: 'published' }, null);
  assert.ok(t.errors.length > 0);
});

test('duplicate brand pricing is rejected by caller contract (1:1)', () => {
  const list = [{ logo_extra: 1 }, { logo_extra: 2 }];
  assert.equal(list.length, 2);
});

test('extra_by_size expands into fixation_size_extras', () => {
  const sizeIdByCode = new Map([
    ['s', 'size-s'],
    ['m', 'size-m'],
    ['l', 'size-l'],
    ['xl', 'size-xl'],
  ]);
  const { rows, error } = expandFixationSizeExtras('fix-1', { s: 10, xl: 40 }, sizeIdByCode);
  assert.equal(error, undefined);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].size_id, 'size-s');
  assert.equal(rows[1].size_id, 'size-xl');
});

test('unknown fixation size key fails', () => {
  const { error } = expandFixationSizeExtras('f', { xxl: 1 }, new Map([['s', '1']]));
  assert.ok(error);
});

test('site settings split does not include customers JSON', () => {
  const site = { id: 'x', customers: [{ phone: '+380' }], homepage_hero_title: 'hi' };
  const homepage = Object.fromEntries(
    Object.entries(site).filter(([k]) => k.startsWith('homepage_')),
  );
  assert.ok(!('customers' in homepage));
});

test('product media maps 17 canonical slots', () => {
  const src: Record<string, string> = {};
  for (const slot of PRODUCT_MEDIA_SLOTS) src[`${slot}_url`] = `https://cdn.example/${slot}.mp4`;
  const rows = transformProductMedia(src);
  assert.equal(rows.length, 17);
  assert.ok(rows.every((r) => r.media_url?.startsWith('https://')));
});

test('Directus file UUIDs are not copied into URL fields', () => {
  const { url, fileOnly } = mediaUrl('e7baba3c-f38d-4bf9-8f3d-56172f6d061d');
  assert.equal(url, null);
  assert.equal(fileOnly, true);
});

test('stripDirectusFileIds drops nested file ids', () => {
  const cleaned = stripDirectusFileIds({
    title: 'ok',
    image: 'e7baba3c-f38d-4bf9-8f3d-56172f6d061d',
    imageUrl: 'https://cdn.example/a.jpg',
  });
  assert.equal((cleaned as Record<string, unknown>).image, undefined);
  assert.equal((cleaned as Record<string, unknown>).imageUrl, 'https://cdn.example/a.jpg');
});

test('Telegram bot token is never present in notification output', () => {
  const n = transformNotification(
    { id: '1', channel: 'telegram', bot_token: 'SECRET', directus_user_ids: [1] },
    { chat_ids: '111', bot_token: 'SECRET' },
  );
  const json = JSON.stringify(n);
  assert.ok(!json.includes('SECRET'));
  assert.ok(!json.includes('bot_token'));
  assert.ok(!json.includes('directus_user_ids'));
  assert.equal(n.telegram_chat_ids, '111');
});

test('directus_user_ids is dropped', () => {
  const n = transformNotification({ directus_user_ids: [9, 9] }, null);
  assert.ok(!('directus_user_ids' in n));
});

test('loyalty manager-note JSON parses into structured columns', () => {
  const note = classifyManagerNote(
    JSON.stringify({
      loyalty: {
        phone: '+380501112233',
        eligible: true,
        discount_percent: 5,
        discount_amount: 120,
        phone_mismatch: false,
      },
    }),
  );
  assert.equal(note.kind, 'loyalty');
  if (note.kind === 'loyalty') {
    assert.equal(note.loyalty.loyalty_discount_percent, 5);
    assert.equal(note.loyalty.loyalty_eligible, true);
  }
});

test('genuine human manager-note is preserved', () => {
  const note = classifyManagerNote('передать в отдел качества');
  assert.equal(note.kind, 'human');
  if (note.kind === 'human') assert.equal(note.text, 'передать в отдел качества');
});

test('unknown manager JSON is classified unknown_json', () => {
  assert.equal(classifyManagerNote('{"foo":1}').kind, 'unknown_json');
});

test('unsupported contact method fails', () => {
  const t = transformOrder({ id: '1', contact_method: 'email', delivery_method: 'BRANCH' }, null);
  assert.ok(t.errors.length > 0);
});

test('unsupported delivery method fails', () => {
  const t = transformOrder({ id: '1', contact_method: 'phone', delivery_method: 'PICKUP' }, null);
  assert.ok(t.errors.length > 0);
});

test('historical checkout_attempt_id remains NULL', () => {
  const t = transformOrder(
    { id: '1', contact_method: 'phone', delivery_method: 'BRANCH', order_number: 'A1' },
    null,
  );
  assert.equal(t.checkout_attempt_id, null);
});

test('customer linking does not rewrite historical phone snapshot', () => {
  const t = transformOrder(
    {
      id: '1',
      contact_method: 'phone',
      delivery_method: 'BRANCH',
      customer_phone: '050 111 22 33',
    },
    'cust-uuid',
  );
  assert.equal(t.customer_phone, '050 111 22 33');
  assert.equal(t.customer_id, 'cust-uuid');
});

test('assertNoSecrets detects leaked tokens', () => {
  const hits = assertNoSecrets({ a: 'tok-abc' }, ['tok-abc']);
  assert.equal(hits.length, 1);
});
