/**
 * Stage 8B historical import — fixture tests for the pure planning core and
 * SQL generation. No network, no database, no writes.
 *
 * Run: pnpm run test:stage8b-import
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  diffPayload,
  planCustomers,
  planOrders,
  summarize,
  valuesEqual,
  ORDER_PAYLOAD_FIELDS,
  ITEM_PAYLOAD_FIELDS,
  type CustomerRow,
  type HistoricalItemRow,
  type HistoricalOrderRow,
  type RegistryCustomer,
} from '../scripts/stage8b-historical-import/core';
import {
  buildCustomerInsertSql,
  buildImportScript,
  buildNameFillSql,
  buildPerOrderScript,
  buildOrderUnitSql,
} from '../scripts/stage8b-historical-import/sql';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function reg(partial: Partial<RegistryCustomer> & { phone: string }): RegistryCustomer {
  return {
    full_name: null,
    source: 'import',
    imported: true,
    legacy_orders_count: null,
    legacy_products_count: null,
    legacy_city: null,
    legacy_delivery: null,
    ...partial,
  };
}

function cust(partial: Partial<CustomerRow> & { phone: string }): CustomerRow {
  return {
    full_name: null,
    source: 'site',
    imported: false,
    legacy_orders_count: null,
    legacy_products_count: null,
    legacy_city: null,
    legacy_delivery: null,
    ...partial,
  };
}

function order(partial: Partial<HistoricalOrderRow> = {}): HistoricalOrderRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    order_number: 'CZ-20261013-BD3D52',
    checkout_attempt_id: null,
    request_fingerprint: null,
    status: 'new',
    created_at: '2026-10-13T10:00:00.000Z',
    customer_id: null,
    customer_name: 'Тест',
    customer_phone: '+380501112233',
    customer_email: null,
    customer_comment: null,
    contact_method: 'phone',
    delivery_method: 'BRANCH',
    delivery_city_ref: 'city-ref',
    delivery_city_name: 'Київ',
    delivery_point_ref: 'point-ref',
    delivery_point_number: '1',
    delivery_point_name: 'Відділення',
    delivery_point_address: 'вул. Хрещатик, 1',
    delivery_point_type: 'branch',
    delivery_street_ref: null,
    delivery_street_name: null,
    delivery_street_type: null,
    delivery_house: null,
    delivery_apartment: null,
    items_quantity: 2,
    subtotal: 240000,
    quantity_discount: 12000,
    total: 228000,
    discount_tier_key: 'qty-2',
    manager_note: null,
    loyalty_phone: null,
    loyalty_eligible: false,
    loyalty_discount_percent: 0,
    loyalty_discount_amount: 0,
    loyalty_phone_mismatch: false,
    ...partial,
  };
}

function item(partial: Partial<HistoricalItemRow> = {}): HistoricalItemRow {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    order_id: '11111111-1111-4111-8111-111111111111',
    sort: 0,
    item_key: '2-0::m::none::standard',
    title: 'Килимки CARZO 2.0',
    design_slug: '2-0',
    design_label: 'CARZO 2.0',
    size_code: 'm',
    size_label: 'M',
    brand_slug: 'none',
    brand_name: null,
    fixation_key: 'standard',
    fixation_label: 'Стандарт',
    unit_price: 120000,
    quantity: 2,
    line_total: 240000,
    quantity_discount_eligible: true,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// valuesEqual / diffPayload
// ---------------------------------------------------------------------------

describe('valuesEqual', () => {
  it('treats timestamp formatting differences as equal', () => {
    assert.equal(valuesEqual('2026-10-13T10:00:00.000Z', '2026-10-13 10:00:00+00'), true);
    assert.equal(valuesEqual('2026-10-13T10:00:00Z', '2026-10-13T12:00:00+02:00'), true);
  });

  it('treats null and undefined as equal to each other', () => {
    assert.equal(valuesEqual(null, undefined), true);
    assert.equal(valuesEqual(undefined, null), true);
    assert.equal(valuesEqual(null, ''), false);
  });

  it('compares numbers and booleans strictly', () => {
    assert.equal(valuesEqual(0, 0), true);
    assert.equal(valuesEqual(0, '0'), false);
    assert.equal(valuesEqual(false, 'false'), false);
    assert.equal(valuesEqual(120000, 120000), true);
    assert.equal(valuesEqual(120000, 120001), false);
  });

  it('compares plain text exactly', () => {
    assert.equal(valuesEqual('CZ-20261013-BD3D52', 'CZ-20261013-BD3D52'), true);
    assert.equal(valuesEqual('CZ-20261013-BD3D52', 'CZ-20261013-BD3D53'), false);
    assert.equal(valuesEqual('Київ', 'Київ'), true);
    assert.equal(valuesEqual('Київ', 'Одеса'), false);
  });
});

describe('diffPayload', () => {
  it('reports every differing field', () => {
    const a = order();
    const b = order({ total: 999, status: 'done' });
    const diffs = diffPayload(a as never, b as never, ['total', 'status', 'order_number']);
    assert.equal(diffs.length, 2);
    assert.deepEqual(diffs.map((d) => d.field).sort(), ['status', 'total']);
  });

  it('is empty for identical payloads', () => {
    const a = order();
    const b = order();
    assert.equal(diffPayload(a as never, b as never, ORDER_PAYLOAD_FIELDS).length, 0);
  });
});

// ---------------------------------------------------------------------------
// Customer planning
// ---------------------------------------------------------------------------

describe('planCustomers', () => {
  it('inserts only customers absent from the target', () => {
    const plan = planCustomers(
      [reg({ phone: '+380501112233', full_name: 'Олена' }), reg({ phone: '0502223344' })],
      [cust({ phone: '+380501112233', full_name: 'Олена', source: 'site', imported: false })],
    );
    assert.equal(plan.toInsert.length, 1);
    assert.equal(plan.toInsert[0].phone, '+380502223344');
    assert.equal(plan.skippedIdentical.length, 1);
    assert.equal(plan.stopped, false);
  });

  it('normalizes phones across formats', () => {
    const plan = planCustomers(
      [
        reg({ phone: '+380 (50) 111-22-33' }),
        reg({ phone: '0501112233' }),
        reg({ phone: '501112233' }),
      ],
      [],
    );
    // Three spellings of the same subscriber → one row.
    assert.equal(plan.toInsert.length, 1);
    assert.equal(plan.toInsert[0].phone, '+380501112233');
    assert.equal(plan.sourceDuplicates, 2);
    assert.equal(plan.stopped, false);
  });

  it('never overwrites an existing customer and preserves provenance', () => {
    const existing = cust({
      phone: '+380501112233',
      full_name: 'Олена',
      source: 'legacy',
      imported: true,
      legacy_orders_count: 4,
      legacy_city: 'Київ',
    });
    const plan = planCustomers(
      [reg({ phone: '+380501112233', full_name: 'Олена', source: 'site', imported: false, legacy_city: 'Одеса' })],
      [existing],
    );
    assert.equal(plan.toInsert.length, 0);
    assert.equal(plan.nameFills.length, 0);
    assert.equal(plan.stopped, false);
    // Skipped — target untouched. Provenance fields are never rewritten.
    assert.deepEqual(plan.skippedIdentical, ['+380501112233']);
    assert.equal(existing.source, 'legacy');
    assert.equal(existing.legacy_city, 'Київ');
    assert.equal(existing.imported, true);
    assert.equal(existing.legacy_orders_count, 4);
  });

  it('fills only an empty full_name on an existing row', () => {
    const plan = planCustomers(
      [reg({ phone: '+380501112233', full_name: 'Олена' })],
      [cust({ phone: '+380501112233', full_name: null, source: 'legacy', imported: true })],
    );
    assert.equal(plan.toInsert.length, 0);
    assert.equal(plan.nameFills.length, 1);
    assert.deepEqual(plan.nameFills[0], { phone: '+380501112233', from: null, to: 'Олена' });
    assert.equal(plan.stopped, false);
  });

  it('STOPs on a name conflict (both non-null, different)', () => {
    const plan = planCustomers(
      [reg({ phone: '+380501112233', full_name: 'Олена' })],
      [cust({ phone: '+380501112233', full_name: 'Марія', source: 'legacy', imported: true })],
    );
    assert.equal(plan.stopped, true);
    assert.equal(plan.conflicts.length, 1);
    assert.equal(plan.conflicts[0].field, 'full_name');
    assert.match(plan.stopReasons[0], /customer-name-conflict/);
  });

  it('STOPs when duplicate source rows diverge', () => {
    const plan = planCustomers(
      [reg({ phone: '+380501112233', full_name: 'Олена' }), reg({ phone: '+380501112233', full_name: 'Марія' })],
      [],
    );
    assert.equal(plan.stopped, true);
    assert.match(plan.stopReasons.join(' '), /source-duplicate-divergence/);
  });

  it('excludes test phones and counts invalid phones', () => {
    const plan = planCustomers(
      [reg({ phone: '+380501112233' }), reg({ phone: 'not-a-phone' }), reg({ phone: '+380661031094' })],
      [],
      { testPhones: ['+380661031094'] },
    );
    assert.equal(plan.toInsert.length, 1);
    assert.equal(plan.invalidPhones, 1);
    assert.deepEqual(plan.testExcluded, ['+380661031094']);
    assert.equal(plan.stopped, false);
  });

  it('is idempotent: a re-run against the post-apply state inserts nothing', () => {
    const source = [reg({ phone: '+380501112233', full_name: 'Олена' }), reg({ phone: '+380502223344' })];
    const first = planCustomers(source, []);
    assert.equal(first.toInsert.length, 2);

    // Simulate the target after apply.
    const afterApply = first.toInsert.map((r) => ({ ...r }));
    const second = planCustomers(source, afterApply);
    assert.equal(second.toInsert.length, 0);
    assert.equal(second.nameFills.length, 0);
    assert.equal(second.skippedIdentical.length, 2);
    assert.equal(second.stopped, false);
  });
});

// ---------------------------------------------------------------------------
// Order planning
// ---------------------------------------------------------------------------

describe('planOrders', () => {
  it('inserts an order absent from the target together with its items', () => {
    const o = order();
    const it = item();
    const plan = planOrders([o], [it], [], []);
    assert.equal(plan.toInsert.length, 1);
    assert.equal(plan.toInsert[0].items.length, 1);
    assert.equal(plan.stopped, false);
  });

  it('skips an identical existing order (full payload compare)', () => {
    const o = order();
    const it = item();
    const plan = planOrders([o], [it], [{ ...o }], [{ ...it }]);
    assert.equal(plan.toInsert.length, 0);
    assert.deepEqual(plan.skippedIdentical, ['CZ-20261013-BD3D52']);
    assert.equal(plan.stopped, false);
  });

  it('treats timestamp formatting differences as identical', () => {
    const o = order();
    const it = item();
    const existing = order({ created_at: '2026-10-13 10:00:00+00' });
    const plan = planOrders([o], [it], [existing], [{ ...it }]);
    assert.equal(plan.stopped, false);
    assert.deepEqual(plan.skippedIdentical, ['CZ-20261013-BD3D52']);
  });

  it('STOPs when a colliding order differs on any payload field', () => {
    const o = order();
    const it = item();
    const existing = order({ total: 999999 });
    const plan = planOrders([o], [it], [existing], [{ ...it }]);
    assert.equal(plan.stopped, true);
    assert.equal(plan.toInsert.length, 0);
    assert.ok(plan.conflicts.some((c) => c.field === 'total'));
    assert.match(plan.stopReasons.join(' '), /order-payload-mismatch/);
  });

  it('STOPs when a colliding order differs on money (no recalculation allowed)', () => {
    const o = order();
    const it = item();
    const existingItem = item({ unit_price: 1, line_total: 2, quantity: 2 });
    const plan = planOrders([o], [it], [{ ...o }], [existingItem]);
    assert.equal(plan.stopped, true);
    assert.ok(plan.conflicts.some((c) => c.field === 'unit_price'));
    assert.ok(plan.conflicts.some((c) => c.field === 'line_total'));
    assert.match(plan.stopReasons.join(' '), /order-items-mismatch/);
  });

  it('STOPs when item counts differ on a colliding order', () => {
    const o = order();
    const plan = planOrders([o], [item()], [{ ...o }], []);
    assert.equal(plan.stopped, true);
    assert.ok(plan.conflicts.some((c) => c.field === 'items_count'));
  });

  it('STOPs on a duplicate item_key inside one source order — before any insert', () => {
    const o = order();
    const a = item({ id: '22222222-2222-4222-8222-222222222222' });
    const b = item({ id: '33333333-3333-4333-8333-333333333333' });
    const plan = planOrders([o], [a, b], [], []);
    assert.equal(plan.stopped, true);
    assert.equal(plan.toInsert.length, 0);
    assert.equal(plan.duplicateItemKeys.length, 1);
    assert.equal(plan.duplicateItemKeys[0].itemKey, '2-0::m::none::standard');
    assert.match(plan.stopReasons.join(' '), /duplicate-item-key/);
  });

  it('STOPs on a duplicate order_number inside the source', () => {
    const o = order();
    const o2 = order({ id: '33333333-3333-4333-8333-333333333333' });
    const plan = planOrders([o, o2], [item()], [], []);
    assert.equal(plan.stopped, true);
    assert.match(plan.stopReasons.join(' '), /source-duplicate-order-number/);
  });

  it('forces checkout_attempt_id and request_fingerprint to NULL', () => {
    const o = order();
    const plan = planOrders([o], [item()], [], []);
    const inserted = plan.toInsert[0].order;
    assert.equal(inserted.checkout_attempt_id, null);
    assert.equal(inserted.request_fingerprint, null);
  });

  it('preserves the original id, order_number, created_at and money values', () => {
    const o = order({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', total: 228000, created_at: '2026-10-13T10:00:00.000Z' });
    const plan = planOrders([o], [item({ order_id: o.id })], [], []);
    const inserted = plan.toInsert[0].order;
    assert.equal(inserted.id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    assert.equal(inserted.order_number, 'CZ-20261013-BD3D52');
    assert.equal(inserted.created_at, '2026-10-13T10:00:00.000Z');
    assert.equal(inserted.total, 228000);
    assert.equal(inserted.subtotal, 240000);
    assert.equal(inserted.quantity_discount, 12000);
  });

  it('is idempotent: replay after a successful apply yields inserted=0, skipped-identical=N', () => {
    const orders = [order(), order({ id: '33333333-3333-4333-8333-333333333333', order_number: 'CZ-20261014-AAAAAA' })];
    const items = [
      item(),
      item({ id: '44444444-4444-4444-8444-444444444444', order_id: '33333333-3333-4333-8333-333333333333', item_key: '3-0::s::none::standard' }),
    ];

    const first = planOrders(orders, items, [], []);
    assert.equal(first.toInsert.length, 2);

    const afterOrders = first.toInsert.map((u) => u.order);
    const afterItems = first.toInsert.flatMap((u) => u.items);
    const second = planOrders(orders, items, afterOrders, afterItems);

    assert.equal(second.toInsert.length, 0);
    assert.equal(second.skippedIdentical.length, 2);
    assert.equal(second.conflicts.length, 0);
    assert.equal(second.stopped, false);
  });

  it('keeps every item snapshot field on insert', () => {
    const it = item({
      title: 'Килимки CARZO 2.0',
      design_slug: '2-0',
      design_label: 'CARZO 2.0',
      size_code: 'm',
      size_label: 'M',
      brand_slug: 'bmw',
      brand_name: 'BMW',
      fixation_key: 'standard',
      fixation_label: 'Стандарт',
      unit_price: 120000,
      quantity: 2,
      line_total: 240000,
      quantity_discount_eligible: true,
    });
    const plan = planOrders([order()], [it], [], []);
    const inserted = plan.toInsert[0].items[0];
    assert.equal(inserted.unit_price, 120000);
    assert.equal(inserted.quantity, 2);
    assert.equal(inserted.line_total, 240000);
    assert.equal(inserted.brand_slug, 'bmw');
    assert.equal(inserted.quantity_discount_eligible, true);
  });
});

// ---------------------------------------------------------------------------
// summarize
// ---------------------------------------------------------------------------

describe('summarize', () => {
  it('aggregates both plans and surfaces stop reasons', () => {
    const cPlan = planCustomers([reg({ phone: '+380501112233' })], []);
    const oPlan = planOrders([order()], [item()], [], []);
    const s = summarize(cPlan, oPlan, {
      sourceCustomers: 1,
      existingCustomers: 0,
      sourceOrders: 1,
      sourceItems: 1,
      existingOrders: 0,
      existingItems: 0,
    });
    assert.equal(s.customers.to_insert, 1);
    assert.equal(s.orders.to_insert, 1);
    assert.equal(s.stopped, false);
    assert.deepEqual(s.stop_reasons, []);
  });
});

// ---------------------------------------------------------------------------
// SQL generation
// ---------------------------------------------------------------------------

describe('SQL generation', () => {
  it('customer insert uses ON CONFLICT DO NOTHING (no overwrite)', () => {
    const sql = buildCustomerInsertSql([cust({ phone: '+380501112233', full_name: 'Олена', source: 'import', imported: true, legacy_orders_count: 4, legacy_city: 'Київ' })]);
    assert.match(sql, /INSERT INTO public\.customers/);
    assert.match(sql, /ON CONFLICT \(phone\) DO NOTHING/);
    assert.ok(!/DO UPDATE/.test(sql));
    assert.match(sql, /\+380501112233/);
    assert.match(sql, /'Олена'/);
    assert.match(sql, /'legacy'|'import'/);
    assert.match(sql, /true/);
  });

  it('name fill only touches rows whose full_name is NULL', () => {
    const sql = buildNameFillSql([{ phone: '+380501112233', to: 'Олена' }]);
    assert.match(sql, /UPDATE public\.customers SET full_name = 'Олена'/);
    assert.match(sql, /WHERE phone = '\+380501112233' AND full_name IS NULL/);
  });

  it('order insert forces checkout_attempt_id and request_fingerprint to NULL', () => {
    const sql = buildOrderUnitSql({ order: order(), items: [item()] });
    assert.match(sql, /INSERT INTO public\.orders/);
    assert.match(sql, /INSERT INTO public\.order_items/);
    // Column order: id, order_number, checkout_attempt_id, request_fingerprint, ...
    assert.match(sql, /'CZ-20261013-BD3D52', NULL, NULL, 'new'/);
    assert.ok(!/request_fingerprint[^,]*[^N]/.test(sql.split('\n').find((l) => l.startsWith('(')) ?? ''));
  });

  it('order insert preserves original id and created_at', () => {
    const sql = buildOrderUnitSql({ order: order(), items: [] });
    assert.match(sql, /'11111111-1111-4111-8111-111111111111'/);
    assert.match(sql, /'2026-10-13T10:00:00\.000Z'/);
  });

  it('item insert preserves original prices and quantities', () => {
    const sql = buildOrderUnitSql({ order: order(), items: [item()] });
    assert.match(sql, /120000, 2, 240000/);
  });

  it('never emits ON CONFLICT DO UPDATE for orders or items', () => {
    const sql = buildImportScript([cust({ phone: '+380501112233' })], [], [{ order: order(), items: [item()] }], { terminal: 'commit' });
    assert.ok(!/DO UPDATE/.test(sql));
    assert.ok(!/create_order_with_items/.test(sql));
  });

  it('escapes single quotes in text values', () => {
    const sql = buildOrderUnitSql({ order: order({ customer_name: "O'Brien" }), items: [] });
    assert.match(sql, /O''Brien/);
  });

  it('commit script ends with COMMIT; drill script ends with ROLLBACK;', () => {
    const units = [{ order: order(), items: [item()] }];
    const commit = buildImportScript([], [], units, { terminal: 'commit' });
    const drill = buildPerOrderScript(units, { terminal: 'rollback' });
    assert.match(commit.trimEnd(), /COMMIT;$/);
    assert.match(drill.trimEnd(), /ROLLBACK;$/);
    assert.ok(!/COMMIT;/.test(drill));
  });

  it('drill script contains the same statements as the apply script (atomicity proof)', () => {
    const units = [{ order: order(), items: [item()] }];
    const apply = buildImportScript([], [], units, { terminal: 'commit' });
    const drill = buildPerOrderScript(units, { terminal: 'rollback' });
    // Every INSERT in the apply script must also appear in the drill script.
    const inserts = apply.split('\n').filter((l) => l.startsWith('INSERT'));
    for (const stmt of inserts) {
      assert.ok(drill.includes(stmt), `drill missing statement: ${stmt.slice(0, 60)}`);
    }
  });

  it('wraps the whole import in a single transaction', () => {
    const sql = buildImportScript([cust({ phone: '+380501112233' })], [], [{ order: order(), items: [item()] }], { terminal: 'commit' });
    assert.match(sql, /^BEGIN;/m);
    assert.match(sql, /COMMIT;/);
    const begins = sql.split('\n').filter((l) => l.trim() === 'BEGIN;').length;
    const commits = sql.split('\n').filter((l) => l.trim() === 'COMMIT;').length;
    assert.equal(begins, 1);
    assert.equal(commits, 1);
  });

  it('produces an empty script when there is nothing to do', () => {
    const sql = buildImportScript([], [], [], { terminal: 'commit' });
    assert.match(sql, /COMMIT;/);
    // Comment lines may document the INSERT-only policy; the real assertion is
    // that no SQL statement is emitted. Comments are stripped before the check
    // so the guard is exact rather than a substring false-positive.
    const statements = sql
      .split('\n')
      .map((l) => l.replace(/--.*$/, '').trim())
      .filter((l) => l.length > 0);
    assert.deepEqual(statements, ['BEGIN;', 'COMMIT;']);
  });
});

// ---------------------------------------------------------------------------
// Field-list completeness guard
// ---------------------------------------------------------------------------

describe('payload field lists', () => {
  it('order payload list covers identity, money, delivery and loyalty', () => {
    for (const f of [
      'id', 'order_number', 'created_at', 'status',
      'customer_name', 'customer_phone', 'customer_email',
      'items_quantity', 'subtotal', 'quantity_discount', 'total', 'discount_tier_key',
      'manager_note', 'loyalty_phone', 'loyalty_eligible', 'loyalty_discount_percent',
      'loyalty_discount_amount', 'loyalty_phone_mismatch',
      'checkout_attempt_id', 'request_fingerprint',
      'delivery_method', 'delivery_city_ref', 'delivery_city_name',
    ]) {
      assert.ok((ORDER_PAYLOAD_FIELDS as readonly string[]).includes(f), `missing order field ${f}`);
    }
  });

  it('item payload list covers prices and labels', () => {
    for (const f of [
      'item_key', 'title', 'design_slug', 'design_label', 'size_code', 'size_label',
      'brand_slug', 'brand_name', 'fixation_key', 'fixation_label',
      'unit_price', 'quantity', 'line_total', 'quantity_discount_eligible',
    ]) {
      assert.ok((ITEM_PAYLOAD_FIELDS as readonly string[]).includes(f), `missing item field ${f}`);
    }
  });
});
