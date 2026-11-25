import assert from 'node:assert/strict';
import { it } from 'node:test';
import { sendMetaEvent } from '../lib/meta/delivery';
import type { MetaOutboxRow } from '../lib/meta/types';

const row: MetaOutboxRow = { id: 'synthetic', lease_id: 'lease', destination: 'carzo', pixel_id: '111111111111111',
  event_id: 'purchase:synthetic:carzo', attempts: 1, payload: { event_name: 'Purchase', event_id: 'purchase:synthetic:carzo', event_time: 1764000000 } };

it('sends only to the fixed Graph API host, with a private header and immutable event identity', async () => {
  const result = await sendMetaEvent(row, 'PRIVATE_TOKEN', async (url, init) => {
    assert.equal(String(url), 'https://graph.facebook.com/v27.0/111111111111111/events');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer PRIVATE_TOKEN');
    assert.equal(JSON.parse(String(init?.body)).data[0].event_id, row.event_id);
    assert.equal(JSON.parse(String(init?.body)).data[0].event_time, 1764000000);
    assert.ok(init?.signal); assert.equal(init?.redirect, 'error');
    return Response.json({ events_received: 1 });
  });
  assert.deepEqual(result, { status: 'delivered', code: 'accepted' });
});

it('retries transient failures, treats credentials/payload rejection as terminal and never returns raw error messages', async () => {
  for (const [status, body, outcome] of [
    [429, {}, 'retry'], [503, {}, 'retry'], [400, { error: { code: 4 } }, 'retry'],
    [400, { error: { code: 190, message: 'PRIVATE CUSTOMER TOKEN' } }, 'failed'],
    [400, { error: { code: 100 } }, 'failed'], [200, { events_received: 0 }, 'failed'],
  ] as const) {
    const result = await sendMetaEvent(row, 'PRIVATE_TOKEN', async () => Response.json(body, { status }));
    assert.equal(result.status, outcome); assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  }
  assert.equal((await sendMetaEvent(row, 'PRIVATE_TOKEN', async () => { throw new Error('PRIVATE transport error'); })).status, 'retry');
});
