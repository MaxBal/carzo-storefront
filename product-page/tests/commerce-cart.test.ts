import assert from 'node:assert/strict';
import { it } from 'node:test';
import { quoteCartItems } from '../lib/cart/server';
import { loadCommerceProducts } from '../lib/data/products/supabase';
import { resetSupabaseAdminClientForTests } from '../lib/supabase/server';
import { readGuestCart, writeGuestCart, addGuestCartItem } from '../lib/cart/guest-cart';
import { cartItemKey } from '../lib/cart/item-identity';
import { cape, capeItem, pillow, pillowItem, tiers } from './fixtures/commerce';
import type { CaseCartItem } from '../lib/cart/types';

const caseItem: CaseCartItem = { size: 'M', designSlug: '4-0', brandId: 'none', fixation: 'none', quantity: 1 };

it('quotes real mixed cart through SELECT-only mock PostgREST; checks published stock, current prices and shipping', async () => {
  const originalFetch = globalThis.fetch;
  const envKeys = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'CATALOG_STORE', 'VERCEL_ENV'] as const;
  const env = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  const requests: { table: string; url: URL; cache?: RequestCache }[] = [];
  const rows: Record<string, Record<string, unknown>[]> = {
    designs: [{ slug: '4-0', version: '4.0', label: '4.0', status: 'published' }],
    sizes: [{ id: 'case-m', code: 'M', slug: 'm', label: 'M', content_group: 'M', shipping_length_cm: 50, shipping_width_cm: 28, shipping_height_cm: 7, shipping_weight_kg: 2.5, status: 'published' }],
    brands: [{ slug: 'none', name: null, logo_extra: 0, status: 'published' }],
    fixations: [{ id: 'no-fixation', key: 'none', label: 'Без фіксації', extra: 0, status: 'published' }],
    fixation_size_extras: [],
    variants: [{ key: '4-0:M', price: 2249, in_stock: true, quantity_discount_eligible: true, designs: { slug: '4-0' }, sizes: { code: 'M' }, status: 'published' }],
    discount_tiers: tiers.map(tier => ({ key: tier.key, min_quantity: tier.minQuantity, amount: tier.amount, sort: tier.sort, status: 'published' })),
    site_settings: [{ checkout_payment_details: 'Synthetic payment details' }],
    products: [cape, pillow].map(product => ({ id: product.id, slug: product.slug, name: product.name, product_type: product.productType, layout_key: product.layoutKey, quantity_discount_eligible: true, status: 'published' })),
    product_variants: [cape, pillow].flatMap(product => product.variants.map(variant => ({ id: variant.id, product_id: product.id, label: variant.label, sku: variant.sku, price: variant.price, in_stock: true, attributes: variant.attributes, design_id: null, media_url: null, shipping_length_cm: variant.shippingProfile.lengthCm, shipping_width_cm: variant.shippingProfile.widthCm, shipping_height_cm: variant.shippingProfile.heightCm, shipping_weight_kg: variant.shippingProfile.weightKg, status: 'published' }))),
    product_option_groups: [cape, pillow].flatMap(product => product.optionGroups.map(group => ({ id: `${product.id}-${group.key}`, product_id: product.id, key: group.key, label: group.label, input_type: group.inputType, required: group.required, max_length: group.maxLength, price_extra: group.priceExtra, sort: 0, status: 'published' }))),
    product_option_choices: [{ group_id: `${cape.id}-logo`, key: 'audi', label: 'Audi', price_extra: 290, crm_sku: 'AUDI-ST', brand_id: null, sort: 0, status: 'published' }],
  };
  let failTable = '';
  try {
    process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.SUPABASE_SECRET_KEY = 'synthetic-only';
    process.env.CATALOG_STORE = 'supabase';
    delete process.env.VERCEL_ENV;
    resetSupabaseAdminClientForTests();
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      assert.equal(url.hostname, '127.0.0.1');
      assert.equal(init?.method ?? 'GET', 'GET', 'this mock never permits writes');
      const table = url.pathname.split('/').pop()!;
      requests.push({ table, url, cache: init?.cache });
      if (table === failTable) return new Response(JSON.stringify({ message: 'synthetic outage' }), { status: 503 });
      assert.ok(Object.hasOwn(rows, table), `unexpected table ${table}`);
      let result = rows[table];
      url.searchParams.forEach((filter, column) => {
        if (filter.startsWith('eq.')) result = result.filter(row => String(row[column]) === filter.slice(3));
        if (filter.startsWith('in.(')) {
          const values = filter.slice(4, -1).split(',').map(value => value.replace(/^"|"$/g, ''));
          result = result.filter(row => values.includes(String(row[column])));
        }
      });
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    };

    const legacy = await quoteCartItems([caseItem]);
    assert.equal(legacy.total, 2249);
    assert.equal(legacy.lines[0].itemKey, 'M:4-0:none:none');
    assert.equal(requests.some(request => request.table.startsWith('product')), false, 'cases work before new migration is applied');

    const two = await quoteCartItems([caseItem, pillowItem()]);
    assert.equal(two.quantityDiscount, 200);
    assert.equal(two.total, 2649);
    const three = await quoteCartItems([caseItem, capeItem(), pillowItem()]);
    assert.equal(three.subtotal, 4139);
    assert.equal(three.quantityDiscount, 500);
    assert.equal(three.total, 3639);
    assert.equal(three.itemsQuantity, 3);
    assert.deepEqual(three.shippingPackage, { lengthCm: 50, widthCm: 28, heightCm: 20, weightKg: 3.5 });
    assert.equal(three.lines[2].catalogItem?.selectedOptions[0].value, 'CARZO');
    const four = await quoteCartItems([{ ...caseItem, quantity: 2 }, capeItem(), pillowItem()]);
    assert.equal(four.subtotal, 6388);
    assert.equal(four.quantityDiscount, 800);
    assert.equal(four.total, 5588);
    const five = await quoteCartItems([{ ...caseItem, quantity: 2 }, capeItem(), { ...pillowItem(), quantity: 2 }]);
    assert.equal(five.subtotal, 6988);
    assert.equal(five.quantityDiscount, 1100);
    assert.equal(five.total, 5888);
    rows.products[1].quantity_discount_eligible = false;
    const ineligiblePillow = await quoteCartItems([{ ...caseItem, quantity: 2 }, capeItem(), { ...pillowItem(), quantity: 2 }]);
    assert.equal(ineligiblePillow.quantityDiscount, 500, 'ineligible units do not increase the progressive discount');
    assert.equal(ineligiblePillow.total, 6488);
    rows.products[1].quantity_discount_eligible = true;
    assert.ok(requests.every(request => request.cache === 'no-store'));
    for (const table of ['products', 'product_variants', 'product_option_groups', 'product_option_choices']) {
      assert.ok(requests.filter(request => request.table === table).every(request => request.url.searchParams.get('status') === 'eq.published'));
    }
    assert.deepEqual((await loadCommerceProducts([pillow.id])).map(product => product.id), [pillow.id]);

    const duplicated = await quoteCartItems([pillowItem(), pillowItem()]);
    assert.equal(duplicated.lines.length, 1);
    assert.equal(duplicated.lines[0].quantity, 2);
    assert.equal(duplicated.total, 1000);
    const changedText = await quoteCartItems([pillowItem(), { ...pillowItem(), personalization: { embroidery: 'OTHER' } }]);
    assert.equal(changedText.lines.length, 2, 'different embroidery must not merge');

    rows.product_variants[1].price = 700;
    assert.equal((await quoteCartItems([pillowItem()])).total, 800, 're-quote reads changed price');
    rows.product_variants[1].in_stock = false;
    await assert.rejects(quoteCartItems([pillowItem()]));
    rows.product_variants[1].in_stock = true;
    rows.product_variants[1].status = 'draft';
    await assert.rejects(quoteCartItems([pillowItem()]));
    rows.product_variants[1].status = 'published';
    rows.products[1].status = 'draft';
    await assert.rejects(quoteCartItems([pillowItem()]));
    rows.products[1].status = 'published';
    rows.product_option_choices[0].status = 'draft';
    await assert.rejects(quoteCartItems([capeItem()]));
    rows.product_option_choices[0].status = 'published';
    await assert.rejects(quoteCartItems([{ ...pillowItem(), variantId: cape.variants[0].id }]));
    await assert.rejects(quoteCartItems([{ ...pillowItem(), personalization: {} }]));
    failTable = 'product_option_choices';
    await assert.rejects(quoteCartItems([capeItem()]));
    assert.equal((await quoteCartItems([caseItem])).total, 2249, 'product outage does not block case-only carts');
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of envKeys) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; }
    resetSupabaseAdminClientForTests();
  }
});

it('restores mixed guest cart under existing key and keeps different personalizations separate', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } } });
  try {
    storage.set('carzo:guest-cart:v1', JSON.stringify([caseItem]));
    assert.deepEqual(readGuestCart(), [caseItem]);
    writeGuestCart([caseItem, capeItem(), pillowItem()]);
    assert.deepEqual(readGuestCart(), [caseItem, capeItem(), pillowItem()]);
    addGuestCartItem(pillowItem());
    assert.equal(readGuestCart()[2].quantity, 2);
    addGuestCartItem({ ...pillowItem(), personalization: { embroidery: 'SECOND' } });
    assert.equal(readGuestCart().length, 4);
    assert.notEqual(cartItemKey(readGuestCart()[2]), cartItemKey(readGuestCart()[3]));
    addGuestCartItem({ ...pillowItem(), personalization: { embroidery: ' CARZO ' } }, 100);
    assert.equal(readGuestCart().length, 4, 'normalization happens before comparing configurations');
    assert.equal(readGuestCart()[2].quantity, 20, 'quantity cap preserves the item instead of dropping it');
    storage.set('carzo:guest-cart:v1', JSON.stringify([caseItem, { ...pillowItem(), unitPrice: 1 }]));
    assert.deepEqual(readGuestCart(), [caseItem], 'untrusted prices are not restored');
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
