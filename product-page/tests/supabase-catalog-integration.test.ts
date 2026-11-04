/**
 * Read-only Supabase catalog integration tests: real PostgREST SELECTs through
 * the server admin client and the real catalog adapter. No INSERT/UPDATE/DELETE.
 *
 * Run: pnpm run test:supabase-catalog
 * Requires .env.local with SUPABASE_URL / SUPABASE_SECRET_KEY.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { quoteCartItems } from '../lib/cart/server';
import {
  createCatalogRepository,
  loadCatalogData,
  CatalogUnavailableError,
  type CatalogData,
} from '../lib/data/catalog';
import { getSupabaseAdminClient } from '../lib/supabase/server';
import type { SizeId } from '../lib/content/types';

const SIZES: SizeId[] = ['S', 'M', 'L', 'XL'];
const FIXATION_KEYS = ['none', 'bottom', 'wall', 'both'];
const BOTH_EXTRA: Record<SizeId, number> = { S: 60, M: 80, L: 100, XL: 120 };
const ZERO_EXTRA_KEYS = ['none', 'bottom', 'wall'];
const EXPECTED_VARIANT_COUNT = 12;
const EXPECTED_EXTRA_ROWS = 16;

function effectiveFixationExtra(
  fixation: CatalogData['fixations'][number],
  size: SizeId,
): number {
  const bySize = fixation.extraBySize ?? {};
  const value = bySize[size] ?? bySize[String(size).toLowerCase() as SizeId];
  return value ?? fixation.extra;
}

describe('Supabase catalog integration (read-only)', () => {
  let catalog: CatalogData;

  before(async () => {
    assert.ok(
      process.env.SUPABASE_URL?.trim(),
      'SUPABASE_URL must be set (use --env-file=.env.local)',
    );
    assert.ok(
      process.env.SUPABASE_SECRET_KEY?.trim(),
      'SUPABASE_SECRET_KEY must be set (use --env-file=.env.local)',
    );
    process.env.CATALOG_STORE = 'supabase';
    catalog = await loadCatalogData();
  });

  it('completes every catalog select against live PostgREST', () => {
    assert.ok(catalog.designs.length >= 1, 'designs select returned rows');
    assert.equal(catalog.sizes.length, 4, 'sizes select returned 4 rows');
    assert.ok(catalog.brands.length >= 1, 'brands select returned rows');
    assert.equal(catalog.fixations.length, 4, 'fixations select returned 4 rows');
    assert.equal(catalog.variants.length, EXPECTED_VARIANT_COUNT, 'variants select returned 12 rows');
    assert.ok(catalog.discountTiers.length >= 1, 'discount_tiers select returned rows');
    assert.equal(typeof catalog.checkoutPaymentDetails, 'string', 'site_settings select completed');
  });

  it('maps all 16 fixation_size_extras rows through UUID joins', async () => {
    const client = getSupabaseAdminClient();

    const [{ data: extraRows, error: extraError }, { data: fixationRows }, { data: sizeRows }] =
      await Promise.all([
        client.from('fixation_size_extras').select('fixation_id,size_id,extra'),
        client.from('fixations').select('id,key'),
        client.from('sizes').select('id,code'),
      ]);

    assert.equal(extraError, null, 'fixation_size_extras select must succeed');
    assert.equal(extraRows?.length, EXPECTED_EXTRA_ROWS, '16 extra rows in the source table');

    const fixationKeyById = new Map(
      (fixationRows ?? []).map((row) => [String(row.id), String(row.key)]),
    );
    const sizeCodeById = new Map(
      (sizeRows ?? []).map((row) => [String(row.id), String(row.code)]),
    );
    const mappedByKey = new Map(catalog.fixations.map((item) => [item.value, item]));

    let mappedPairs = 0;
    for (const row of extraRows ?? []) {
      const fixationKey = fixationKeyById.get(String(row.fixation_id));
      const sizeCode = sizeCodeById.get(String(row.size_id)) as SizeId | undefined;
      assert.ok(fixationKey, `fixation_id ${String(row.fixation_id)} resolves to a fixation key`);
      assert.ok(sizeCode, `size_id ${String(row.size_id)} resolves to a size code`);

      const fixation = mappedByKey.get(fixationKey);
      assert.ok(fixation, `catalog contains fixation ${fixationKey}`);
      assert.equal(
        effectiveFixationExtra(fixation, sizeCode),
        Number(row.extra),
        `extraBySize[${sizeCode}] for ${fixationKey} matches source row`,
      );
      mappedPairs += 1;
    }
    assert.equal(mappedPairs, EXPECTED_EXTRA_ROWS, 'all 16 rows mapped, none skipped');

    for (const fixation of catalog.fixations) {
      for (const size of SIZES) {
        assert.ok(
          fixation.extraBySize?.[size] !== undefined,
          `extraBySize[${size}] present for ${fixation.value} (unmapped UUIDs must fail, not skip)`,
        );
      }
    }
  });

  it('keeps the documented fixation surcharge contract', () => {
    assert.deepEqual(
      catalog.fixations.map((item) => item.value).sort(),
      [...FIXATION_KEYS].sort(),
      'fixation keys are none/bottom/wall/both',
    );

    for (const key of ZERO_EXTRA_KEYS) {
      const fixation = catalog.fixations.find((item) => item.value === key);
      assert.ok(fixation, `fixation ${key} exists`);
      assert.equal(fixation.extra, 0, `${key} base extra is 0`);
      for (const size of SIZES) {
        assert.equal(effectiveFixationExtra(fixation, size), 0, `${key}+${size} surcharge is 0`);
      }
    }

    const both = catalog.fixations.find((item) => item.value === 'both');
    assert.ok(both, 'fixation both exists');
    for (const size of SIZES) {
      assert.equal(
        effectiveFixationExtra(both, size),
        BOTH_EXTRA[size],
        `both+${size} surcharge is ${BOTH_EXTRA[size]}`,
      );
    }
  });

  it('exposes 12 variants covering every design × size pair', () => {
    const seen = new Set<string>();
    for (const variant of catalog.variants) {
      const pair = `${variant.designSlug}:${variant.size}`;
      assert.ok(!seen.has(pair), `duplicate variant ${pair}`);
      seen.add(pair);
      assert.ok(variant.price > 0, `variant ${pair} has a positive price`);
      assert.ok(variant.oldPrice >= 0, `variant ${pair} has a non-negative old price`);
    }
    assert.equal(seen.size, EXPECTED_VARIANT_COUNT, '12 unique design × size variants');

    for (const design of catalog.designs) {
      for (const size of SIZES) {
        assert.ok(seen.has(`${design.slug}:${size}`), `variant ${design.slug}:${size} exists`);
      }
    }
  });

  it('keeps brands, fixations and discount tiers coherent', () => {
    const none = catalog.brands.find((item) => item.id === 'none');
    assert.ok(none, 'brand none exists');
    assert.equal(none.price, 0, 'brand none has no logo surcharge');
    assert.ok(
      catalog.brands.some((item) => item.price > 0),
      'at least one brand carries a logo surcharge',
    );
    for (const brand of catalog.brands) {
      assert.ok(brand.id.length > 0, 'brand slug is non-empty');
    }

    for (const fixation of catalog.fixations) {
      assert.ok(fixation.value.length > 0, 'fixation key is non-empty');
      assert.ok(fixation.label.length > 0, 'fixation label is non-empty');
      assert.ok(fixation.extra >= 0, 'fixation base extra is non-negative');
    }

    for (const tier of catalog.discountTiers) {
      assert.ok(tier.key.length > 0, 'tier key is non-empty');
      assert.ok(tier.minQuantity >= 1, 'tier minQuantity is at least 1');
      assert.ok(tier.amount >= 0, 'tier amount is non-negative');
    }
  });

  it('prices cart lines as server-side variant + brand + fixation surcharge', async () => {
    const design = catalog.designs[0];
    const variantBySize = new Map(
      catalog.variants
        .filter((item) => item.designSlug === design.slug)
        .map((item) => [item.size, item]),
    );

    for (const size of SIZES) {
      const variant = variantBySize.get(size);
      assert.ok(variant, `variant ${design.slug}:${size} exists`);

      const quote = await quoteCartItems([
        { size, designSlug: design.slug, brandId: 'none', fixation: 'both', quantity: 1 },
      ]);
      const line = quote.lines[0];
      const expectedUnit = variant.price + BOTH_EXTRA[size];
      assert.equal(line.unitPrice, expectedUnit, `both+${size} unit price includes surcharge`);
      assert.equal(line.lineTotal, expectedUnit, `both+${size} line total`);
      assert.equal(quote.subtotal, expectedUnit, `both+${size} subtotal`);
      assert.equal(quote.total, quote.subtotal - quote.quantityDiscount, 'total = subtotal − discount');

      for (const fixationKey of ZERO_EXTRA_KEYS) {
        const plainQuote = await quoteCartItems([
          { size, designSlug: design.slug, brandId: 'none', fixation: fixationKey, quantity: 1 },
        ]);
        assert.equal(
          plainQuote.lines[0].unitPrice,
          variant.price,
          `${fixationKey}+${size} adds no surcharge`,
        );
      }
    }

    const mixed = await quoteCartItems([
      { size: 'S', designSlug: design.slug, brandId: 'none', fixation: 'both', quantity: 1 },
      { size: 'M', designSlug: design.slug, brandId: 'none', fixation: 'none', quantity: 2 },
    ]);
    const expectedSubtotal =
      variantBySize.get('S')!.price + BOTH_EXTRA.S + (variantBySize.get('M')!.price + 0) * 2;
    assert.equal(mixed.subtotal, expectedSubtotal, 'mixed-cart subtotal matches server calculation');
    assert.equal(mixed.total, mixed.subtotal - mixed.quantityDiscount, 'mixed-cart total');
    assert.equal(
      mixed.lines.reduce((sum, line) => sum + line.lineTotal, 0),
      mixed.subtotal,
      'line totals add up to subtotal',
    );
  });

  it('fails closed on extras rows with unmapped UUIDs instead of skipping them', async () => {
    const realFetch = globalThis.fetch;
    const bogusRow = [
      {
        fixation_id: '00000000-0000-0000-0000-000000000000',
        size_id: '00000000-0000-0000-0000-000000000000',
        extra: 1,
      },
    ];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('fixation_size_extras')) {
        return new Response(JSON.stringify(bogusRow), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return realFetch(input, init);
    }) as typeof fetch;

    try {
      await assert.rejects(
        () => createCatalogRepository('supabase').loadCatalog(),
        (error: unknown) => {
          assert.ok(error instanceof CatalogUnavailableError, 'throws CatalogUnavailableError');
          assert.match(error.message, /unmapped ids/);
          return true;
        },
      );
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('never falls back to Directus when catalog reads fail', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('simulated network failure');
    }) as typeof fetch;

    try {
      await assert.rejects(
        () => loadCatalogData(),
        (error: unknown) => {
          assert.ok(error instanceof CatalogUnavailableError, 'throws CatalogUnavailableError');
          assert.equal(error.code, 'UNAVAILABLE');
          return true;
        },
      );
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
