/**
 * Stage 8B historical import — SQL generation.
 *
 * Emits an INSERT-only, transactional SQL script:
 *  - one transaction per customer batch (single BEGIN/COMMIT),
 *  - one transaction per historical order (order row + its items together),
 *  - `request_fingerprint` / `checkout_attempt_id` forced to NULL,
 *  - no upsert, no ON CONFLICT DO UPDATE, no price recalculation.
 *
 * `buildDrillScript` emits the identical statements ending in ROLLBACK so a
 * test can prove atomicity and validity with zero persistence.
 *
 * The script is the source of truth for execution. The CLI writes it to
 * `--out-sql` for review / trusted admin channel and (only with the typed
 * confirmation phrase) can mark it ready to run. Nothing here talks to a
 * database.
 */

import type { CustomerRow, HistoricalItemRow, HistoricalOrderRow, OrderUnit } from './core';

function sqlStr(v: string | null): string {
  if (v === null) return 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}

function sqlInt(v: number | null): string {
  return v === null ? 'NULL' : String(v);
}

function sqlBool(v: boolean): string {
  return v ? 'true' : 'false';
}

function sqlUuid(v: string | null): string {
  if (v === null) return 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}

const CUSTOMER_COLUMNS = [
  'phone',
  'full_name',
  'source',
  'imported',
  'legacy_orders_count',
  'legacy_products_count',
  'legacy_city',
  'legacy_delivery',
] as const;

const ORDER_COLUMNS = [
  'id',
  'order_number',
  'checkout_attempt_id',
  'request_fingerprint',
  'status',
  'created_at',
  'customer_id',
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

const ITEM_COLUMNS = [
  'id',
  'order_id',
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

export function customerInsertValues(row: CustomerRow): string {
  return [
    sqlStr(row.phone),
    sqlStr(row.full_name),
    sqlStr(row.source),
    sqlBool(row.imported),
    sqlInt(row.legacy_orders_count),
    sqlInt(row.legacy_products_count),
    sqlStr(row.legacy_city),
    sqlStr(row.legacy_delivery),
  ].join(', ');
}

export function orderInsertValues(row: HistoricalOrderRow): string {
  // checkout_attempt_id and request_fingerprint are hard-coded NULL for legacy.
  return [
    sqlUuid(row.id),
    sqlStr(row.order_number),
    'NULL',
    'NULL',
    sqlStr(row.status),
    sqlStr(row.created_at),
    sqlUuid(row.customer_id),
    sqlStr(row.customer_name),
    sqlStr(row.customer_phone),
    sqlStr(row.customer_email),
    sqlStr(row.customer_comment),
    sqlStr(row.contact_method),
    sqlStr(row.delivery_method),
    sqlStr(row.delivery_city_ref),
    sqlStr(row.delivery_city_name),
    sqlStr(row.delivery_point_ref),
    sqlStr(row.delivery_point_number),
    sqlStr(row.delivery_point_name),
    sqlStr(row.delivery_point_address),
    sqlStr(row.delivery_point_type),
    sqlStr(row.delivery_street_ref),
    sqlStr(row.delivery_street_name),
    sqlStr(row.delivery_street_type),
    sqlStr(row.delivery_house),
    sqlStr(row.delivery_apartment),
    sqlInt(row.items_quantity),
    sqlInt(row.subtotal),
    sqlInt(row.quantity_discount),
    sqlInt(row.total),
    sqlStr(row.discount_tier_key),
    sqlStr(row.manager_note),
    sqlStr(row.loyalty_phone),
    sqlBool(row.loyalty_eligible),
    sqlInt(row.loyalty_discount_percent),
    sqlInt(row.loyalty_discount_amount),
    sqlBool(row.loyalty_phone_mismatch),
  ].join(', ');
}

export function itemInsertValues(row: HistoricalItemRow): string {
  return [
    row.id === null ? 'DEFAULT' : sqlUuid(row.id),
    sqlUuid(row.order_id),
    sqlInt(row.sort),
    sqlStr(row.item_key),
    sqlStr(row.title),
    sqlStr(row.design_slug),
    sqlStr(row.design_label),
    sqlStr(row.size_code),
    sqlStr(row.size_label),
    sqlStr(row.brand_slug),
    sqlStr(row.brand_name),
    sqlStr(row.fixation_key),
    sqlStr(row.fixation_label),
    sqlInt(row.unit_price),
    sqlInt(row.quantity),
    sqlInt(row.line_total),
    sqlBool(row.quantity_discount_eligible),
  ].join(', ');
}

export function buildCustomerInsertSql(rows: CustomerRow[]): string {
  if (rows.length === 0) return '';
  const values = rows.map((r) => `(${customerInsertValues(r)})`).join(',\n');
  return (
    `INSERT INTO public.customers (${CUSTOMER_COLUMNS.join(', ')}) VALUES\n${values}\n` +
    `ON CONFLICT (phone) DO NOTHING;`
  );
}

export function buildNameFillSql(fills: Array<{ phone: string; to: string }>): string {
  if (fills.length === 0) return '';
  // Only ever fills an empty full_name; the WHERE clause re-asserts that so a
  // concurrent change cannot turn this into an overwrite.
  return fills
    .map(
      (f) =>
        `UPDATE public.customers SET full_name = ${sqlStr(f.to)}, updated_at = now()\n` +
        `WHERE phone = ${sqlStr(f.phone)} AND full_name IS NULL;`,
    )
    .join('\n');
}

export function buildOrderUnitSql(unit: OrderUnit): string {
  const lines: string[] = [];
  lines.push(`INSERT INTO public.orders (${ORDER_COLUMNS.join(', ')}) VALUES`);
  lines.push(`(${orderInsertValues(unit.order)});`);
  if (unit.items.length > 0) {
    const values = unit.items.map((i) => `(${itemInsertValues(i)})`).join(',\n');
    lines.push(`INSERT INTO public.order_items (${ITEM_COLUMNS.join(', ')}) VALUES`);
    lines.push(`${values};`);
  }
  return lines.join('\n');
}

export interface ScriptOptions {
  /** `commit` (real apply) or `rollback` (drill with guaranteed rollback). */
  terminal: 'commit' | 'rollback';
  /** Free-form note recorded at the top of the script. */
  note?: string;
}

export function buildImportScript(
  customers: CustomerRow[],
  nameFills: Array<{ phone: string; to: string }>,
  orderUnits: OrderUnit[],
  opts: ScriptOptions,
): string {
  const end = opts.terminal === 'rollback' ? 'ROLLBACK;' : 'COMMIT;';
  const parts: string[] = [];

  parts.push('-- ============================================================');
  parts.push('-- Stage 8B historical import (INSERT-only, no RPC, no recalc)');
  parts.push(`-- terminal: ${opts.terminal.toUpperCase()}`);
  if (opts.note) parts.push(`-- ${opts.note}`);
  parts.push('-- Generated by scripts/stage8b-historical-import');
  parts.push('-- ============================================================');
  parts.push('');
  parts.push('BEGIN;');
  parts.push('');

  if (customers.length > 0) {
    parts.push('-- ---- customers (new rows only; ON CONFLICT DO NOTHING) ----');
    parts.push(buildCustomerInsertSql(customers));
    parts.push('');
  }

  if (nameFills.length > 0) {
    parts.push('-- ---- customers (fill empty full_name only) ----');
    parts.push(buildNameFillSql(nameFills));
    parts.push('');
  }

  if (orderUnits.length > 0) {
    parts.push(`-- ---- historical orders (${orderUnits.length} unit(s)) ----`);
    for (const unit of orderUnits) {
      parts.push(`-- order ${unit.order.order_number}`);
      parts.push('-- SAVEPOINT per order unit is implicit: this whole script is one');
      parts.push('-- transaction; a failure anywhere rolls back every unit.');
      parts.push(buildOrderUnitSql(unit));
      parts.push('');
    }
  }

  parts.push(end);
  parts.push('');
  return parts.join('\n');
}

/** Per-order atomic script: each order is its own BEGIN/COMMIT (or ROLLBACK). */
export function buildPerOrderScript(
  orderUnits: OrderUnit[],
  opts: ScriptOptions,
): string {
  const end = opts.terminal === 'rollback' ? 'ROLLBACK;' : 'COMMIT;';
  const parts: string[] = [];
  parts.push('-- Stage 8B historical orders — one transaction per order unit');
  parts.push(`-- terminal per unit: ${opts.terminal.toUpperCase()}`);
  if (opts.note) parts.push(`-- ${opts.note}`);
  parts.push('');
  for (const unit of orderUnits) {
    parts.push(`-- order ${unit.order.order_number}`);
    parts.push('BEGIN;');
    parts.push(buildOrderUnitSql(unit));
    parts.push(end);
    parts.push('');
  }
  return parts.join('\n');
}
