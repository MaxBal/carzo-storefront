import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

it('recovery always purges but never calls an unconfigured, empty, premature or foreign endpoint', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema cron; create schema vault; create schema net;
      create table cron.jobs(name text, schedule text, command text);
      create function cron.schedule(text,text,text) returns int language sql as
        'insert into cron.jobs values ($1,$2,$3); select 1';
      create table vault.decrypted_secrets(name text, decrypted_secret text);
      create table public.meta_event_outbox(status text, attempts int default 0,
        expires_at timestamptz default now()+interval '24 hours', next_attempt_at timestamptz default now(), locked_until timestamptz);
      create table public.purges(id int);
      create function public.purge_meta_events() returns void language sql as 'insert into public.purges values (1)';
      create table net.requests(url text, headers jsonb, body jsonb, timeout_ms int);
      create function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds int)
        returns bigint language sql as 'insert into net.requests values ($1,$2,$3,$4); select 1::bigint';
    `);
    await db.exec(await readFile(resolve(process.cwd(), '../supabase/operations/meta-recovery-scheduler.sql'), 'utf8'));
    const job = (await db.query<{ command: string; schedule: string }>('select command,schedule from cron.jobs')).rows[0];
    assert.equal(job.schedule, '* * * * *');
    const tick = () => db.exec(job.command);
    const requests = async () => (await db.query<{ count: number }>('select count(*)::int as count from net.requests')).rows[0].count;
    await tick(); assert.equal(await requests(), 0);
    await db.exec("insert into public.meta_event_outbox(status) values ('pending')");
    await tick(); assert.equal(await requests(), 0);
    await db.exec("insert into vault.decrypted_secrets values ('carzo_meta_worker_url','https://foreign.test/api/meta/deliver'),('carzo_meta_delivery_secret',repeat('x',32))");
    await tick(); assert.equal(await requests(), 0);
    await db.exec("update vault.decrypted_secrets set decrypted_secret='https://carzo.com.ua/api/meta/deliver' where name='carzo_meta_worker_url'; update vault.decrypted_secrets set decrypted_secret='short' where name='carzo_meta_delivery_secret'");
    await tick(); assert.equal(await requests(), 0);
    await db.exec("update vault.decrypted_secrets set decrypted_secret=repeat('x',32) where name='carzo_meta_delivery_secret'; update public.meta_event_outbox set next_attempt_at=now()+interval '1 hour'");
    await tick(); assert.equal(await requests(), 0);
    await db.exec("update public.meta_event_outbox set next_attempt_at=now(), status='processing', locked_until=now()+interval '3 minutes'");
    await tick(); assert.equal(await requests(), 0);
    await db.exec("update public.meta_event_outbox set locked_until=now()-interval '1 second'");
    await tick(); assert.equal(await requests(), 1);
    const request = (await db.query<{ headers: Record<string,string>; body: unknown; timeout_ms: number }>('select headers,body,timeout_ms from net.requests')).rows[0];
    assert.equal(request.headers.Authorization, `Bearer ${'x'.repeat(32)}`);
    assert.deepEqual(request.body, {}); assert.equal(request.timeout_ms, 100000);
    assert.equal((await db.query<{ count: number }>('select count(*)::int as count from public.purges')).rows[0].count, 7);
  } finally { await db.close(); }
});
