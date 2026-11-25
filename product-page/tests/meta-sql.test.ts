import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createSupabaseOrderRepository } from '../lib/data/orders/supabase';
import { resetSupabaseAdminClientForTests } from '../lib/supabase/server';
import { buildMetaPurchaseDrafts } from '../lib/meta/purchase';
import { metaContext, metaDestinations, metaOrder } from './fixtures/meta';

it('atomically saves order+events, keeps RPC compatibility, rejects public access and recovers leases/retries without changing identity', { timeout: 60000 }, async () => {
  const db = new PGlite();
  const oldFetch = globalThis.fetch;
  const savedEnv = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY, VERCEL_ENV: process.env.VERCEL_ENV };
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
    const dir = resolve(process.cwd(), '../supabase/migrations');
    for (const file of (await readdir(dir)).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(resolve(dir, file), 'utf8'));
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query('select * from public.meta_event_outbox'));
    await assert.rejects(db.query("select public.claim_meta_events(array['carzo'],10)"));
    await db.exec('RESET ROLE');
    assert.equal((await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where oid='public.meta_event_outbox'::regclass")).rows[0].relrowsecurity, true);
    const security = await db.query<{ prosecdef: boolean; proconfig: string[] }>("select prosecdef,proconfig from pg_proc where proname in ('create_order_with_meta','claim_meta_events','finish_meta_event','cancel_meta_events','purge_meta_events')");
    assert.equal(security.rows.length, 5); assert.ok(security.rows.every(row => !row.prosecdef && row.proconfig.some(value => value.includes('pg_catalog'))));
    await db.exec('SET ROLE service_role');
    process.env.SUPABASE_URL = 'http://127.0.0.1:54321'; process.env.SUPABASE_SECRET_KEY = 'synthetic'; delete process.env.VERCEL_ENV;
    resetSupabaseAdminClientForTests();
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input)); assert.equal(url.origin, 'http://127.0.0.1:54321');
      const rpc = url.pathname.split('/').pop(); assert.ok(['create_order_with_meta','create_order_with_items'].includes(rpc!));
      const params = JSON.parse(String(init?.body)); const keys = Object.keys(params);
      try {
        const result = await db.query<{ result: unknown }>(`select public.${rpc}(${keys.map((key,index) => `${key} => $${index+1}`).join(',')}) as result`,
          keys.map(key => typeof params[key] === 'object' && params[key] !== null ? JSON.stringify(params[key]) : params[key]));
        return Response.json(result.rows[0].result);
      } catch (error) { return Response.json({ message: error instanceof Error ? error.message : 'Synthetic SQL error' }, { status: 400 }); }
    };
    const repository = createSupabaseOrderRepository(); const order = metaOrder();
    const drafts = buildMetaPurchaseDrafts(order, metaContext, metaDestinations);
    order.meta = { consentId: metaContext.consentId, events: drafts };
    const created = await repository.createOrder(order);
    assert.equal(created.created, true); assert.equal(created.metaEvents?.length, 2);
    assert.deepEqual(created.metaEvents?.map(event => event.data.value), [2880, 1920]);
    const replay = await repository.createOrder(order);
    assert.equal(replay.created, false); assert.deepEqual(replay.metaEvents, created.metaEvents);
    assert.equal((await db.query<{ count: number }>('select count(*)::int as count from public.meta_event_outbox')).rows[0].count, 2);
    const before = (await db.query<{ count: number }>('select count(*)::int as count from public.orders')).rows[0].count;
    await assert.rejects(repository.createOrder({ ...order, checkoutAttemptId: '80000000-0000-4000-8000-000000000002', meta: { consentId: metaContext.consentId, events: [drafts[0], drafts[0]] } }));
    assert.equal((await db.query<{ count: number }>('select count(*)::int as count from public.orders')).rows[0].count, before, 'outbox failure rolls the order transaction back');
    const legacy = await repository.createOrder({ ...order, checkoutAttemptId: '80000000-0000-4000-8000-000000000003', meta: undefined });
    assert.equal(legacy.created, true); assert.equal(legacy.metaEvents, undefined);
    const claimed = (await db.query<{ id: string; lease_id: string; event_id: string; payload: Record<string, unknown> }>("select * from public.claim_meta_events(array['carzo','partner'],10)")).rows;
    assert.equal(claimed.length, 2);
    assert.equal((await db.query("select * from public.claim_meta_events(array['carzo','partner'],10)")).rows.length, 0);
    const first = claimed[0];
    await db.query("update public.meta_event_outbox set locked_until=now()-interval '1 second' where id=$1", [first.id]);
    const reclaimed = (await db.query<typeof first>("select * from public.claim_meta_events(array['carzo','partner'],10)")).rows[0];
    assert.notEqual(reclaimed.lease_id, first.lease_id); assert.equal(reclaimed.event_id, first.event_id);
    await db.query("select public.finish_meta_event($1,$2,'delivered','accepted')", [first.id, first.lease_id]);
    assert.equal((await db.query<{ status: string }>('select status from public.meta_event_outbox where id=$1',[first.id])).rows[0].status, 'processing');
    await db.query("select public.finish_meta_event($1,$2,'retry','transport')", [reclaimed.id, reclaimed.lease_id]);
    await db.query("update public.meta_event_outbox set next_attempt_at=now()-interval '1 second' where id=$1", [first.id]);
    const retry = (await db.query<typeof first>("select * from public.claim_meta_events(array['carzo','partner'],10)")).rows[0];
    assert.deepEqual(retry.payload, first.payload, 'retry preserves payload, event_id and event_time');
    await db.query("select public.finish_meta_event($1,$2,'delivered','accepted')", [retry.id, retry.lease_id]);
    assert.deepEqual((await db.query<{ payload: unknown }>('select payload from public.meta_event_outbox where id=$1',[first.id])).rows[0].payload, {});
    await db.query('select public.cancel_meta_events($1)', [metaContext.consentId]);
    const afterCancel = (await repository.createOrder(order)).metaEvents!;
    assert.equal(afterCancel.length, 1); assert.equal(afterCancel[0].eventId, first.event_id);
    await db.query("update public.meta_event_outbox set created_at=now()-interval '31 days' where id=$1", [first.id]);
    await db.exec('select public.purge_meta_events()');
    assert.equal((await db.query<{ count: number }>('select count(*)::int as count from public.orders')).rows[0].count, before + 1);
  } finally {
    globalThis.fetch = oldFetch; resetSupabaseAdminClientForTests();
    for (const [key,value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[key]; else process.env[key]=value; }
    await db.close();
  }
});
