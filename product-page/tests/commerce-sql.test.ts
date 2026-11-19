import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createSupabaseOrderRepository } from '../lib/data/orders/supabase';
import { resetSupabaseAdminClientForTests } from '../lib/supabase/server';
import type { OrderSnapshot } from '../lib/data/orders/types';
import { quoteCatalogItem } from '../lib/commerce/pricing';
import { cape, pillow, capeItem, pillowItem } from './fixtures/commerce';

it('replays every migration locally, preserves historical orders, stores mixed configurations atomically and restricts grants', { timeout: 60000 }, async () => {
  const db = new PGlite();
  const oldFetch = globalThis.fetch;
  const savedEnv = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY, VERCEL: process.env.VERCEL, VERCEL_ENV: process.env.VERCEL_ENV };
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
    const dir = resolve(process.cwd(), '../supabase/migrations');
    const files = (await readdir(dir)).filter(file => file.endsWith('.sql')).sort();
    const migration = files.find(file => file.endsWith('_multi_product_commerce_foundation.sql'))!;
    assert.ok(migration);
    for (const file of files.filter(file => file !== migration)) await db.exec(await readFile(resolve(dir, file), 'utf8'));

    process.env.SUPABASE_URL = 'http://127.0.0.1:5454';
    process.env.SUPABASE_SECRET_KEY = 'synthetic-local-only';
    delete process.env.VERCEL; delete process.env.VERCEL_ENV;
    resetSupabaseAdminClientForTests();
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert.equal(url.origin, 'http://127.0.0.1:5454');
      assert.equal(url.pathname, '/rest/v1/rpc/create_order_with_items');
      assert.equal(init?.method, 'POST');
      const params = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const keys = Object.keys(params);
      const sql = `select public.create_order_with_items(${keys.map((key, i) => `${key} => $${i + 1}`).join(', ')}) as result`;
      try {
        const result = await db.query<{ result: unknown }>(sql, keys.map(key => typeof params[key] === 'object' && params[key] !== null ? JSON.stringify(params[key]) : params[key]));
        return Response.json(result.rows[0].result);
      } catch (error) {
        return Response.json({ message: error instanceof Error ? error.message : 'local SQL error' }, { status: 400 });
      }
    };
    const repository = createSupabaseOrderRepository();
    const legacyItem: OrderSnapshot['items'][number] = { sort: 1, itemKey: 'M:4-0:none:none', title: 'Synthetic case', designSlug: '4-0', designLabel: '4.0', sizeCode: 'M', sizeLabel: 'M', brandSlug: 'none', brandName: 'Без логотипа', fixationKey: 'none', fixationLabel: 'без фіксації', unitPrice: 2249, quantity: 1, lineTotal: 2249, quantityDiscountEligible: true };
    const oldSnapshot: OrderSnapshot = {
      checkoutAttemptId: '30000000-0000-4000-8000-000000000001', requestFingerprint: 'synthetic-legacy-fingerprint',
      customerName: 'Synthetic buyer', customerPhone: '+380000000000', customerComment: null, contactMethod: 'phone', paymentOption: 'prepayment_200',
      deliveryMethod: 'BRANCH', deliveryCityRef: null, deliveryCityName: 'Synthetic city', deliveryPointRef: null, deliveryPointNumber: '1', deliveryPointName: 'Synthetic branch', deliveryPointAddress: 'Synthetic address', deliveryPointType: 'branch', deliveryStreetRef: null, deliveryStreetName: null, deliveryStreetType: null, deliveryHouse: null, deliveryApartment: null,
      itemsQuantity: 1, subtotal: 2249, quantityDiscount: 0, total: 2249, discountTierKey: null, managerNote: null,
      loyalty: { loyaltyPhone: null, eligible: false, discountPercent: 0, discountAmount: 0, phoneMismatch: false }, items: [legacyItem],
    };
    const original = await repository.createOrder(oldSnapshot);
    const beforeOrder = (await db.query('select to_jsonb(o) as data from public.orders o where id=$1', [original.id])).rows;
    const beforeItems = (await db.query('select to_jsonb(i) as data from public.order_items i where order_id=$1', [original.id])).rows;

    await db.exec(await readFile(resolve(dir, migration), 'utf8'));
    assert.deepEqual((await db.query('select to_jsonb(o) as data from public.orders o where id=$1', [original.id])).rows, beforeOrder);
    assert.deepEqual((await db.query("select to_jsonb(i)-'catalog_item' as data from public.order_items i where order_id=$1", [original.id])).rows, beforeItems);
    assert.equal((await repository.createOrder(oldSnapshot)).created, false);

    for (const role of ['anon', 'authenticated']) {
      const result = await db.query<{ allowed: boolean }>(`select has_table_privilege($1, 'public.products', 'SELECT') as allowed`, [role]);
      assert.equal(result.rows[0].allowed, false);
      const rpc = await db.query<{ allowed: boolean }>(`select has_function_privilege($1, oid, 'EXECUTE') as allowed from pg_proc where proname='create_order_with_items'`, [role]);
      assert.ok(rpc.rows.every(row => row.allowed === false));
    }
    assert.equal((await db.query<{ allowed: boolean }>("select has_table_privilege('service_role','public.products','UPDATE') as allowed")).rows[0].allowed, false);
    const rls = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where oid in ('public.products'::regclass,'public.product_variants'::regclass,'public.product_option_groups'::regclass,'public.product_option_choices'::regclass)");
    assert.equal(rls.rows.length, 4); assert.ok(rls.rows.every(row => row.relrowsecurity));
    const rpcSecurity = await db.query<{ prosecdef: boolean; proconfig: string[] }>("select prosecdef, proconfig from pg_proc where proname='create_order_with_items'");
    assert.equal(rpcSecurity.rows[0].prosecdef, false);
    assert.ok(rpcSecurity.rows[0].proconfig.some(value => value.includes('pg_catalog')));

    await db.query('insert into public.products(id,slug,name,product_type) values($1,$2,$3,$4)', [cape.id, 'synthetic-cape', 'Synthetic cape', 'seat-back-cover']);
    await assert.rejects(db.query("insert into public.product_variants(product_id,label,status) values($1,'Missing data','published')", [cape.id]));
    await db.exec('SET ROLE service_role');
    assert.equal((await db.query('select id from public.products')).rows.length, 1);
    await assert.rejects(db.query("update public.products set name='Forbidden'"));

    const extra = [quoteCatalogItem(capeItem(), cape), quoteCatalogItem(pillowItem(), pillow)].map((line, i) => ({ ...legacyItem, sort: i + 2, itemKey: line.itemKey, title: line.title,
      designSlug: null, designLabel: '', sizeCode: null, sizeLabel: '', brandSlug: null, brandName: '', fixationKey: null, fixationLabel: '',
      unitPrice: line.unitPrice, lineTotal: line.lineTotal, catalogItem: line.catalogItem }));
    const mixed = { ...oldSnapshot, checkoutAttemptId: '30000000-0000-4000-8000-000000000002', requestFingerprint: 'synthetic-mixed-fingerprint', itemsQuantity: 3, subtotal: 4139, quantityDiscount: 500, total: 3639, discountTierKey: 'three', items: [legacyItem, ...extra] };
    const order = await repository.createOrder(mixed);
    assert.equal(order.created, true); assert.equal(order.total, 3639);
    const stored = await db.query<{ catalog_item: unknown; size_code: string | null }>('select catalog_item,size_code from public.order_items where order_id=$1 order by sort', [order.id]);
    assert.equal(stored.rows[0].catalog_item, null);
    assert.deepEqual(stored.rows[1].catalog_item, extra[0].catalogItem);
    assert.deepEqual(stored.rows[2].catalog_item, extra[1].catalogItem);
    assert.equal(stored.rows[1].size_code, null); assert.equal(stored.rows[2].size_code, null);
    const replay = await repository.createOrder({ ...mixed, total: 1 });
    assert.equal(replay.created, false); assert.equal(replay.total, 3639);
    await assert.rejects(repository.createOrder({ ...mixed, requestFingerprint: 'changed-options' }), error => (error as { code: string }).code === 'REPLAY_MISMATCH');
    const count = (await db.query<{ count: number }>('select count(*)::int as count from public.orders')).rows[0].count;
    await assert.rejects(repository.createOrder({ ...mixed, checkoutAttemptId: '30000000-0000-4000-8000-000000000003', items: [legacyItem, { ...extra[0], catalogItem: {} as never }, extra[1]] }));
    assert.equal((await db.query<{ count: number }>('select count(*)::int as count from public.orders')).rows[0].count, count);
  } finally {
    globalThis.fetch = oldFetch; resetSupabaseAdminClientForTests();
    for (const [key, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await db.close();
  }
});
