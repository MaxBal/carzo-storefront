/**
 * Stage 8B historical import — pure planning core.
 *
 * No I/O, no network, no secrets, no PII printing. Everything here is
 * deterministic and unit-testable against fixtures. The CLI layer fetches
 * source/target rows and feeds them in; SQL generation lives in sql.ts.
 *
 * Hard rules encoded here:
 *  - INSERT-only for historical orders (never upsert, never the checkout RPC).
 *  - Identity collision → full payload compare → identical = skipped-identical,
 *    different = STOP. Never a silent skip, never an overwrite.
 *  - Existing customers are never overwritten; a resolvable empty-name fill is
 *    the only permitted write, and a name conflict is a STOP.
 *  - Historical prices/totals/ids/dates are preserved byte-for-byte.
 */

import { normalizeCustomerPhone } from '../../lib/cart/customer-phone';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Raw = Record<string, unknown>;

/** A customer as it exists in the Directus registry (`carzo_site_settings.customers`). */
export interface RegistryCustomer {
  phone: unknown;
  full_name?: unknown;
  source?: unknown;
  imported?: unknown;
  legacy_orders_count?: unknown;
  legacy_products_count?: unknown;
  legacy_city?: unknown;
  legacy_delivery?: unknown;
}

/** Canonical `public.customers` row shape used by the planner. */
export interface CustomerRow {
  phone: string;
  full_name: string | null;
  source: string;
  imported: boolean;
  legacy_orders_count: number | null;
  legacy_products_count: number | null;
  legacy_city: string | null;
  legacy_delivery: string | null;
}

/** Canonical `public.orders` row shape used by the planner (historical import). */
export interface HistoricalOrderRow {
  id: string;
  order_number: string;
  checkout_attempt_id: null;
  request_fingerprint: null;
  status: string;
  created_at: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string;
  customer_email: string | null;
  customer_comment: string | null;
  contact_method: string;
  delivery_method: string;
  delivery_city_ref: string | null;
  delivery_city_name: string | null;
  delivery_point_ref: string | null;
  delivery_point_number: string | null;
  delivery_point_name: string | null;
  delivery_point_address: string | null;
  delivery_point_type: string | null;
  delivery_street_ref: string | null;
  delivery_street_name: string | null;
  delivery_street_type: string | null;
  delivery_house: string | null;
  delivery_apartment: string | null;
  items_quantity: number;
  subtotal: number;
  quantity_discount: number;
  total: number;
  discount_tier_key: string | null;
  manager_note: string | null;
  loyalty_phone: string | null;
  loyalty_eligible: boolean;
  loyalty_discount_percent: number;
  loyalty_discount_amount: number;
  loyalty_phone_mismatch: boolean;
}

/** Canonical `public.order_items` row shape used by the planner. */
export interface HistoricalItemRow {
  id: string | null;
  order_id: string;
  sort: number;
  item_key: string | null;
  title: string | null;
  design_slug: string | null;
  design_label: string | null;
  size_code: string | null;
  size_label: string | null;
  brand_slug: string | null;
  brand_name: string | null;
  fixation_key: string | null;
  fixation_label: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  quantity_discount_eligible: boolean;
}

export interface CustomerConflict {
  phone: string;
  field: 'full_name';
  existing: string | null;
  incoming: string | null;
}

export interface CustomerPlan {
  toInsert: CustomerRow[];
  /** Fill of an empty `full_name` on an existing row — the only permitted update. */
  nameFills: Array<{ phone: string; from: string | null; to: string }>;
  skippedIdentical: string[];
  conflicts: CustomerConflict[];
  invalidPhones: number;
  testExcluded: string[];
  sourceDuplicates: number;
  stopped: boolean;
  stopReasons: string[];
}

export interface OrderConflict {
  identity: string;
  field: string;
  existing: unknown;
  incoming: unknown;
}

export interface OrderUnit {
  order: HistoricalOrderRow;
  items: HistoricalItemRow[];
}

export interface OrderPlan {
  toInsert: OrderUnit[];
  skippedIdentical: string[];
  conflicts: OrderConflict[];
  duplicateItemKeys: Array<{ orderNumber: string; itemKey: string }>;
  stopped: boolean;
  stopReasons: string[];
}

export interface PlanOptions {
  /** Phones excluded from import (test denylist). Matched on canonical form. */
  testPhones?: Iterable<string>;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function asString(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  return typeof v === 'string' ? v : String(v);
}

function asInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function asBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1 || v === '1') return true;
  if (v === 'false' || v === 0 || v === '0') return false;
  return fallback;
}

/** Trimmed non-empty string, or null. Never produces '' . */
function clean(v: unknown): string | null {
  const s = asString(v);
  if (s === null) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

/**
 * Value equality for payload comparison.
 *
 * Strict across the type boundary: `0` is NOT `'0'`, `false` is NOT `'false'`.
 * A string where a number/boolean belongs is an anomaly the import must surface
 * as a divergence, not silently accept — this tool's job is to STOP, not to
 * coerce. Timestamps are the one exception: they are compared on the instant
 * (not text formatting), so `2026-10-13T10:00:00.000Z` equals
 * `2026-10-13 10:00:00+00` — that is formatting, not value drift.
 */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a === null || a === undefined) && (b === null || b === undefined);
  }
  if (typeof a === 'number' || typeof b === 'number') {
    return typeof a === 'number' && typeof b === 'number' && a === b;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return typeof a === 'boolean' && typeof b === 'boolean' && a === b;
  }
  // Timestamp-tolerant compare when both sides look like instants.
  const ta = toInstant(a);
  const tb = toInstant(b);
  if (ta !== null && tb !== null) return ta === tb;
  return String(a) === String(b);
}

function toInstant(v: unknown): number | null {
  if (v instanceof Date) return v.getTime();
  if (typeof v !== 'string') return null;
  const s = v.trim();
  // Require a date-like prefix so plain text is never coerced.
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

// ---------------------------------------------------------------------------
// Field lists for full-payload equality (§4.2 of the 8B plan)
// ---------------------------------------------------------------------------

export const ORDER_PAYLOAD_FIELDS = [
  'id',
  'order_number',
  'checkout_attempt_id',
  'request_fingerprint',
  'status',
  'created_at',
  'customer_name',
  'customer_phone',
  'customer_email',
  'customer_comment',
  'contact_method',
  'delivery_method',
  'delivery_city_ref',
  'delivery_city_name',
  'delivery_point_ref',
  'delivery_point_number',
  'delivery_point_name',
  'delivery_point_address',
  'delivery_point_type',
  'delivery_street_ref',
  'delivery_street_name',
  'delivery_street_type',
  'delivery_house',
  'delivery_apartment',
  'items_quantity',
  'subtotal',
  'quantity_discount',
  'total',
  'discount_tier_key',
  'manager_note',
  'loyalty_phone',
  'loyalty_eligible',
  'loyalty_discount_percent',
  'loyalty_discount_amount',
  'loyalty_phone_mismatch',
] as const;

export const ITEM_PAYLOAD_FIELDS = [
  'id',
  'sort',
  'item_key',
  'title',
  'design_slug',
  'design_label',
  'size_code',
  'size_label',
  'brand_slug',
  'brand_name',
  'fixation_key',
  'fixation_label',
  'unit_price',
  'quantity',
  'line_total',
  'quantity_discount_eligible',
] as const;

export function diffPayload(
  a: Raw,
  b: Raw,
  fields: readonly string[],
): Array<{ field: string; a: unknown; b: unknown }> {
  const out: Array<{ field: string; a: unknown; b: unknown }> = [];
  for (const f of fields) {
    const va = (a as Raw)[f] ?? null;
    const vb = (b as Raw)[f] ?? null;
    if (!valuesEqual(va, vb)) out.push({ field: f, a: va, b: vb });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Customer planning (§4.4 + §5 of the 8B plan)
// ---------------------------------------------------------------------------

function normalizeRegistryCustomer(raw: RegistryCustomer): CustomerRow | null {
  const phone = normalizeCustomerPhone(raw.phone);
  if (!phone) return null;
  return {
    phone,
    full_name: clean(raw.full_name),
    source: clean(raw.source) ?? 'import',
    imported: asBool(raw.imported, true),
    legacy_orders_count: asInt(raw.legacy_orders_count),
    legacy_products_count: asInt(raw.legacy_products_count),
    legacy_city: clean(raw.legacy_city),
    legacy_delivery: clean(raw.legacy_delivery),
  };
}

/**
 * Plan the customer transfer. Existing rows are authoritative: they are never
 * overwritten. The single permitted write is filling an empty `full_name`.
 * A name conflict (both non-null, different) is a STOP.
 */
export function planCustomers(
  source: RegistryCustomer[],
  existing: CustomerRow[],
  opts: PlanOptions = {},
): CustomerPlan {
  const testPhones = new Set<string>();
  for (const p of Array.from(opts.testPhones ?? [])) {
    const n = normalizeCustomerPhone(p);
    if (n) testPhones.add(n);
  }

  const plan: CustomerPlan = {
    toInsert: [],
    nameFills: [],
    skippedIdentical: [],
    conflicts: [],
    invalidPhones: 0,
    testExcluded: [],
    sourceDuplicates: 0,
    stopped: false,
    stopReasons: [],
  };

  const existingByPhone = new Map<string, CustomerRow>();
  for (const row of existing) existingByPhone.set(row.phone, row);

  // Deterministic source de-duplication: first occurrence wins, later ones are
  // compared against it and a divergence inside the source is a STOP.
  const sourceByPhone = new Map<string, CustomerRow>();
  for (const raw of source) {
    const row = normalizeRegistryCustomer(raw);
    if (!row) {
      plan.invalidPhones += 1;
      continue;
    }
    if (testPhones.has(row.phone)) {
      if (!plan.testExcluded.includes(row.phone)) plan.testExcluded.push(row.phone);
      continue;
    }
    const prior = sourceByPhone.get(row.phone);
    if (prior) {
      plan.sourceDuplicates += 1;
      const diffs = diffPayload(
        prior as unknown as Raw,
        row as unknown as Raw,
        ['full_name', 'source', 'imported', 'legacy_orders_count', 'legacy_products_count', 'legacy_city', 'legacy_delivery'],
      );
      if (diffs.length > 0) {
        plan.conflicts.push({
          phone: row.phone,
          field: 'full_name',
          existing: prior.full_name,
          incoming: row.full_name,
        });
        plan.stopped = true;
        plan.stopReasons.push(
          `source-duplicate-divergence ${row.phone} fields=${diffs.map((d) => d.field).join(',')}`,
        );
      }
      continue;
    }
    sourceByPhone.set(row.phone, row);
  }

  for (const [phone, incoming] of Array.from(sourceByPhone)) {
    const target = existingByPhone.get(phone);
    if (!target) {
      plan.toInsert.push(incoming);
      continue;
    }
    // Existing customer: never overwritten. Only an empty-name fill is allowed.
    if (target.full_name === null && incoming.full_name !== null) {
      plan.nameFills.push({ phone, from: null, to: incoming.full_name });
      continue;
    }
    if (
      target.full_name !== null &&
      incoming.full_name !== null &&
      target.full_name !== incoming.full_name
    ) {
      plan.conflicts.push({
        phone,
        field: 'full_name',
        existing: target.full_name,
        incoming: incoming.full_name,
      });
      plan.stopped = true;
      plan.stopReasons.push(`customer-name-conflict ${phone}`);
      continue;
    }
    plan.skippedIdentical.push(phone);
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Order planning (§4 of the 8B plan)
// ---------------------------------------------------------------------------

function itemsForOrder(
  items: HistoricalItemRow[],
  orderId: string,
): HistoricalItemRow[] {
  return items.filter((i) => i.order_id === orderId);
}

/**
 * Plan the historical order transfer. INSERT-only. Identity collision triggers
 * a full payload compare; equal → skipped-identical, different → STOP.
 */
export function planOrders(
  sourceOrders: HistoricalOrderRow[],
  sourceItems: HistoricalItemRow[],
  existingOrders: HistoricalOrderRow[],
  existingItems: HistoricalItemRow[],
): OrderPlan {
  const plan: OrderPlan = {
    toInsert: [],
    skippedIdentical: [],
    conflicts: [],
    duplicateItemKeys: [],
    stopped: false,
    stopReasons: [],
  };

  const existingById = new Map<string, HistoricalOrderRow>();
  const existingByNumber = new Map<string, HistoricalOrderRow>();
  for (const o of existingOrders) {
    existingById.set(o.id, o);
    existingByNumber.set(o.order_number, o);
  }
  const existingItemsByOrder = new Map<string, HistoricalItemRow[]>();
  for (const it of existingItems) {
    const list = existingItemsByOrder.get(it.order_id) ?? [];
    list.push(it);
    existingItemsByOrder.set(it.order_id, list);
  }

  // Source-side duplicate identity detection (order_number and id).
  const seenNumbers = new Set<string>();
  const seenIds = new Set<string>();

  for (const order of sourceOrders) {
    // Duplicate item_key inside one source order → STOP before any insert.
    // The whole order is withheld from toInsert: a partially-sane unit must
    // never reach the SQL generator.
    const ownItems = itemsForOrder(sourceItems, order.id);
    const keys = new Set<string>();
    let duplicateKeyInOrder = false;
    for (const it of ownItems) {
      const k = it.item_key ?? '';
      if (keys.has(k)) {
        plan.duplicateItemKeys.push({ orderNumber: order.order_number, itemKey: k });
        plan.stopped = true;
        duplicateKeyInOrder = true;
        plan.stopReasons.push(`duplicate-item-key ${order.order_number} key=${k}`);
      }
      keys.add(k);
    }
    if (duplicateKeyInOrder) continue;

    if (seenNumbers.has(order.order_number)) {
      plan.stopped = true;
      plan.stopReasons.push(`source-duplicate-order-number ${order.order_number}`);
      continue;
    }
    if (seenIds.has(order.id)) {
      plan.stopped = true;
      plan.stopReasons.push(`source-duplicate-order-id ${order.id}`);
      continue;
    }
    seenNumbers.add(order.order_number);
    seenIds.add(order.id);

    // Identity collision: same id OR same order_number already in target.
    const hitById = existingById.get(order.id);
    const hitByNumber = existingByNumber.get(order.order_number);
    const hit = hitById ?? hitByNumber;

    if (!hit) {
      plan.toInsert.push({ order, items: ownItems });
      continue;
    }

    // Full payload compare on the order.
    const orderDiffs = diffPayload(
      hit as unknown as Raw,
      order as unknown as Raw,
      ORDER_PAYLOAD_FIELDS,
    );
    if (orderDiffs.length > 0) {
      for (const d of orderDiffs) {
        plan.conflicts.push({
          identity: order.order_number,
          field: d.field,
          existing: d.a,
          incoming: d.b,
        });
      }
      plan.stopped = true;
      plan.stopReasons.push(
        `order-payload-mismatch ${order.order_number} fields=${orderDiffs.map((d) => d.field).join(',')}`,
      );
      continue;
    }

    // Full payload compare on items (matched by item_key).
    const existingOwn = existingItemsByOrder.get(hit.id) ?? [];
    const existingByKey = new Map<string, HistoricalItemRow>();
    for (const it of existingOwn) existingByKey.set(it.item_key ?? '', it);

    let itemsMismatch = false;
    if (existingOwn.length !== ownItems.length) {
      itemsMismatch = true;
      plan.conflicts.push({
        identity: order.order_number,
        field: 'items_count',
        existing: existingOwn.length,
        incoming: ownItems.length,
      });
    }
    for (const it of ownItems) {
      const match = existingByKey.get(it.item_key ?? '');
      if (!match) {
        itemsMismatch = true;
        plan.conflicts.push({
          identity: order.order_number,
          field: `item.${it.item_key ?? '?'}`,
          existing: null,
          incoming: 'present',
        });
        continue;
      }
      // Item identity is (order_id, item_key); every snapshot field including
      // the original item UUID must match, per 8B §4.2 (ids are preserved).
      const itemDiffs = diffPayload(
        match as unknown as Raw,
        it as unknown as Raw,
        ITEM_PAYLOAD_FIELDS,
      );
      if (itemDiffs.length > 0) {
        itemsMismatch = true;
        for (const d of itemDiffs) {
          plan.conflicts.push({
            identity: `${order.order_number}/${it.item_key ?? '?'}`,
            field: d.field,
            existing: d.a,
            incoming: d.b,
          });
        }
      }
    }
    if (itemsMismatch) {
      plan.stopped = true;
      plan.stopReasons.push(`order-items-mismatch ${order.order_number}`);
      continue;
    }

    plan.skippedIdentical.push(order.order_number);
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Plan summary (safe to print — no PII beyond masked phones / order numbers)
// ---------------------------------------------------------------------------

export interface PlanSummary {
  customers: {
    source_rows: number;
    existing_rows: number;
    to_insert: number;
    name_fills: number;
    skipped_identical: number;
    conflicts: number;
    invalid_phones: number;
    test_excluded: number;
    source_duplicates: number;
  };
  orders: {
    source_orders: number;
    source_items: number;
    existing_orders: number;
    existing_items: number;
    to_insert: number;
    skipped_identical: number;
    conflicts: number;
    duplicate_item_keys: number;
  };
  stopped: boolean;
  stop_reasons: string[];
}

export function summarize(
  customerPlan: CustomerPlan,
  orderPlan: OrderPlan,
  counts: {
    sourceCustomers: number;
    existingCustomers: number;
    sourceOrders: number;
    sourceItems: number;
    existingOrders: number;
    existingItems: number;
  },
): PlanSummary {
  return {
    customers: {
      source_rows: counts.sourceCustomers,
      existing_rows: counts.existingCustomers,
      to_insert: customerPlan.toInsert.length,
      name_fills: customerPlan.nameFills.length,
      skipped_identical: customerPlan.skippedIdentical.length,
      conflicts: customerPlan.conflicts.length,
      invalid_phones: customerPlan.invalidPhones,
      test_excluded: customerPlan.testExcluded.length,
      source_duplicates: customerPlan.sourceDuplicates,
    },
    orders: {
      source_orders: counts.sourceOrders,
      source_items: counts.sourceItems,
      existing_orders: counts.existingOrders,
      existing_items: counts.existingItems,
      to_insert: orderPlan.toInsert.length,
      skipped_identical: orderPlan.skippedIdentical.length,
      conflicts: orderPlan.conflicts.length,
      duplicate_item_keys: orderPlan.duplicateItemKeys.length,
    },
    stopped: customerPlan.stopped || orderPlan.stopped,
    stop_reasons: [...customerPlan.stopReasons, ...orderPlan.stopReasons],
  };
}
