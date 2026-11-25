import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { it } from 'node:test';
import { allocateDiscount, buildMetaPurchaseDrafts } from '../lib/meta/purchase';
import { metaContext, metaDestinations, metaOrder } from './fixtures/meta';

it('splits a mixed purchase and quantity discount between owners without sharing other items or free text', () => {
  const events = buildMetaPurchaseDrafts(metaOrder(), metaContext, metaDestinations);
  assert.deepEqual(events.map(item => item.custom_data.value), [2880, 1920]);
  assert.deepEqual(events[0].custom_data.content_ids, ['case:4-0:l']);
  assert.deepEqual(events[1].custom_data.content_ids, ['SYNTHETIC-PILLOW']);
  const payload = JSON.stringify(events);
  assert.equal(payload.includes('PRIVATE'), false);
  assert.equal(payload.includes('+380000000000'), false);
  assert.equal(events[0].user_data.ph?.[0], createHash('sha256').update('380000000000').digest('hex'));
  assert.notEqual(events[0].user_data.ph?.[0], createHash('sha256').update('380000000001').digest('hex'));
  assert.equal(events[0].user_data.fbc, metaContext.fbc);
  assert.equal(events[0].custom_data.currency, 'UAH');
});

it('allocates loyalty after quantity savings and keeps the exact saved total with deterministic rounding', () => {
  const order = metaOrder();
  order.loyalty.discountAmount = 240; order.total = 4560;
  assert.deepEqual(buildMetaPurchaseDrafts(order, metaContext, metaDestinations).map(item => item.custom_data.value), [2736, 1824]);
  assert.deepEqual(allocateDiscount(2, [1, 1, 1]), [1, 1, 0]);
  order.items[1].quantityDiscountEligible = false;
  assert.deepEqual(buildMetaPurchaseDrafts(order, metaContext, metaDestinations).map(item => item.custom_data.value), [2660, 1900]);
  order.total = 1;
  assert.throws(() => buildMetaPurchaseDrafts(order, metaContext, metaDestinations));
});

it('does not invent a destination for unknown product types or send the deposit as order value', () => {
  const order = metaOrder();
  const events = buildMetaPurchaseDrafts(order, metaContext, [metaDestinations[0]]);
  assert.equal(events.length, 1);
  assert.equal(events[0].custom_data.value, 2880);
  assert.notEqual(events[0].custom_data.value, 200);
  assert.deepEqual(buildMetaPurchaseDrafts(order, metaContext, []), []);
});
