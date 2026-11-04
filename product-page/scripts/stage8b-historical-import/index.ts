/**
 * Stage 8B historical import CLI.
 *
 *   npx tsx scripts/stage8b-historical-import/index.ts --audit
 *   npx tsx scripts/stage8b-historical-import/index.ts --dry-run [--out-sql /tmp/plan.sql]
 *   npx tsx scripts/stage8b-historical-import/index.ts --verify
 *   npx tsx scripts/stage8b-historical-import/index.ts --apply --out-sql /tmp/apply.sql \
 *        --confirm-apply STAGE8B-HISTORICAL-IMPORT
 *
 * Env:
 *   DIRECTUS_URL, DIRECTUS_ADMIN_TOKEN | DIRECTUS_READ_TOKEN   — GET only
 *   SUPABASE_URL, SUPABASE_SECRET_KEY                          — SELECT only in
 *     audit/dry-run/verify. `--apply` never writes through PostgREST; it emits a
 *     transactional SQL script for a trusted admin channel (see --out-sql).
 *
 * Safety:
 *   - Directus access is GET-only. No PATCH/POST/DELETE, ever.
 *   - No Telegram messages, no Nova Poshta calls, no cache purges.
 *   - Historical orders are INSERT-only with request_fingerprint /
 *     checkout_attempt_id forced to NULL. The checkout RPC is never used.
 *   - Identity collision → full payload compare → identical = skipped-identical,
 *     different = STOP (the script is not emitted).
 *   - `--apply` requires the exact confirmation phrase AND refuses to run when
 *     STAGE8B_ALLOW_APPLY is not set to `1`. In Stage 9 preparation the real
 *     apply is forbidden; only --dry-run / --audit / --verify and ROLLBACK
 *     drills are permitted.
 */

import { readFileSync, writeFileSync } from 'node:fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  planCustomers,
  planOrders,
  summarize,
  type CustomerRow,
  type HistoricalItemRow,
  type HistoricalOrderRow,
  type RegistryCustomer,
} from './core';
import { fetchAllPaginated, type PageFetcher } from './paginate';
import { buildImportScript, buildPerOrderScript } from './sql';
import {
  checkItemArithmetic,
  checkOrderConsistency,
  checkUniqueness,
  type VerifyOrderRow,
} from './verify';
import {
  asBool,
  asInt,
  asString,
  classifyManagerNote,
  isUuid,
  relationId,
  transformOrder,
  transformOrderItem,
  type Raw,
} from '../migrate-directus-to-supabase/transform';

const CONFIRM_PHRASE = 'STAGE8B-HISTORICAL-IMPORT';

type Mode = 'audit' | 'dry-run' | 'verify' | 'apply';

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function parseMode(args: Record<string, string | boolean>): Mode {
  if (args.apply) return 'apply';
  if (args.verify) return 'verify';
  if (args.audit) return 'audit';
  return 'dry-run';
}

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

// ---------------------------------------------------------------------------
// Source: Directus (GET only)
// ---------------------------------------------------------------------------

async function directusGet<T>(path: string): Promise<T> {
  const url = requireEnv('DIRECTUS_URL').replace(/\/$/, '');
  const token = process.env.DIRECTUS_ADMIN_TOKEN?.trim() || requireEnv('DIRECTUS_READ_TOKEN');
  const res = await fetch(`${url}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Directus GET ${path} → ${res.status} ${body.slice(0, 120)}`);
  }
  return res.json() as Promise<T>;
}

async function fetchDirectusCustomers(): Promise<RegistryCustomer[]> {
  // Source of record for this import: the JSON registry on carzo_site_settings.
  const payload = await directusGet<{ data?: { customers?: unknown } }>(
    '/items/carzo_site_settings?fields=customers',
  );
  const raw = payload.data?.customers;
  return Array.isArray(raw) ? (raw as RegistryCustomer[]) : [];
}

async function fetchDirectusOrders(): Promise<Raw[]> {
  const payload = await directusGet<{ data?: Raw[] }>('/items/carzo_orders?limit=-1');
  return Array.isArray(payload.data) ? payload.data : [];
}

async function fetchDirectusOrderItems(): Promise<Raw[]> {
  const payload = await directusGet<{ data?: Raw[] }>('/items/carzo_order_items?limit=-1');
  return Array.isArray(payload.data) ? payload.data : [];
}

// ---------------------------------------------------------------------------
// Target: Supabase (SELECT only in every mode)
// ---------------------------------------------------------------------------

function supabase(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

const CUSTOMER_COLUMNS =
  'phone, full_name, source, imported, legacy_orders_count, legacy_products_count, legacy_city, legacy_delivery';

/**
 * Range-paged SELECT. `count: 'exact'` gives the authoritative total so
 * `fetchAllPaginated` can prove the read is complete — a single uncapped
 * PostgREST call would silently return at most 1000 of the 5,994 customers
 * and the import would then plan against a truncated registry.
 *
 * Row typing is asserted on the way out: PostgREST hands back untyped JSON,
 * and these column lists are the contract with the schema.
 */
function pagedSelect<T>(
  db: SupabaseClient,
  table: string,
  columns: string,
): PageFetcher<T> {
  return async (from, to) => {
    const { data, error, count } = await db
      .from(table)
      .select(columns, { count: 'exact' })
      .range(from, to);
    return {
      rows: ((data ?? []) as unknown) as T[],
      error: error ? error.message : null,
      total: typeof count === 'number' ? count : null,
    };
  };
}

async function fetchTarget(db: SupabaseClient) {
  const customers = await fetchAllPaginated<CustomerRow>(
    'customers',
    pagedSelect<CustomerRow>(db, 'customers', CUSTOMER_COLUMNS),
  );
  const orders = await fetchAllPaginated<HistoricalOrderRow>(
    'orders',
    pagedSelect<HistoricalOrderRow>(db, 'orders', '*'),
  );
  const items = await fetchAllPaginated<HistoricalItemRow>(
    'order_items',
    pagedSelect<HistoricalItemRow>(db, 'order_items', '*'),
  );
  return { customers, orders, items };
}

// ---------------------------------------------------------------------------
// Source transforms (reuse Stage 2 pure transforms)
// ---------------------------------------------------------------------------

function toHistoricalOrder(row: Raw): HistoricalOrderRow {
  const t = transformOrder(row, null);
  if (t.errors.length) {
    throw new Error(`BLOCKED: order ${asString(row.order_number)}: ${t.errors.join('; ')}`);
  }
  // transformOrder only records an error for unsupported enums; a missing enum
  // is rejected above. These two are non-null in the target schema.
  if (!t.contact_method || !t.delivery_method) {
    throw new Error(`BLOCKED: order ${asString(row.order_number)}: missing contact/delivery method`);
  }
  const note = classifyManagerNote(row.manager_note);
  return {
    id: t.id,
    order_number: t.order_number ?? '',
    checkout_attempt_id: null,
    request_fingerprint: null,
    status: t.status,
    created_at: t.created_at ?? '',
    customer_id: null,
    customer_name: t.customer_name,
    customer_phone: t.customer_phone ?? '',
    customer_email: t.customer_email,
    customer_comment: t.customer_comment,
    contact_method: t.contact_method,
    delivery_method: t.delivery_method,
    delivery_city_ref: t.delivery_city_ref,
    delivery_city_name: t.delivery_city_name,
    delivery_point_ref: t.delivery_point_ref,
    delivery_point_number: t.delivery_point_number,
    delivery_point_name: t.delivery_point_name,
    delivery_point_address: t.delivery_point_address,
    delivery_point_type: t.delivery_point_type,
    delivery_street_ref: t.delivery_street_ref,
    delivery_street_name: t.delivery_street_name,
    delivery_street_type: t.delivery_street_type,
    delivery_house: t.delivery_house,
    delivery_apartment: t.delivery_apartment,
    items_quantity: t.items_quantity,
    subtotal: t.subtotal,
    quantity_discount: t.quantity_discount,
    total: t.total,
    discount_tier_key: t.discount_tier_key,
    manager_note: note.kind === 'human' ? note.text : null,
    loyalty_phone: t.loyalty_phone,
    loyalty_eligible: t.loyalty_eligible,
    loyalty_discount_percent: t.loyalty_discount_percent,
    loyalty_discount_amount: t.loyalty_discount_amount,
    loyalty_phone_mismatch: t.loyalty_phone_mismatch,
  };
}

function toHistoricalItem(row: Raw): HistoricalItemRow {
  const t = transformOrderItem(row);
  return {
    id: t.id,
    order_id: t.order_id ?? '',
    sort: t.sort,
    item_key: t.item_key,
    title: t.title,
    design_slug: t.design_slug,
    design_label: t.design_label,
    size_code: t.size_code,
    size_label: t.size_label,
    brand_slug: t.brand_slug,
    brand_name: t.brand_name,
    fixation_key: t.fixation_key,
    fixation_label: t.fixation_label,
    unit_price: t.unit_price,
    quantity: t.quantity,
    line_total: t.line_total,
    quantity_discount_eligible: t.quantity_discount_eligible,
  };
}

// ---------------------------------------------------------------------------
// Verify (read-only integrity checks)
// ---------------------------------------------------------------------------

async function runVerify(db: SupabaseClient) {
  const target = await fetchTarget(db);

  const orderNumbers = new Map<string, number>();
  for (const o of target.orders) {
    orderNumbers.set(o.order_number, (orderNumbers.get(o.order_number) ?? 0) + 1);
  }
  const dupOrderNumbers = Array.from(orderNumbers.entries()).filter(([, n]) => n > 1);

  const phones = new Map<string, number>();
  for (const c of target.customers) {
    phones.set(c.phone, (phones.get(c.phone) ?? 0) + 1);
  }
  const dupPhones = Array.from(phones.entries()).filter(([, n]) => n > 1);

  const itemKeys = new Map<string, number>();
  for (const it of target.items) {
    const k = `${it.order_id}::${it.item_key ?? ''}`;
    itemKeys.set(k, (itemKeys.get(k) ?? 0) + 1);
  }
  const dupItemKeys = Array.from(itemKeys.entries()).filter(([, n]) => n > 1);

  const orderIds = new Set(target.orders.map((o) => o.id));
  const orphanItems = target.items.filter((i) => !orderIds.has(i.order_id));

  const customerIds = new Set(target.customers.map((c) => (c as unknown as { id?: string }).id ?? ''));
  const linkedOrders = target.orders.filter((o) => o.customer_id !== null);
  const badLinks = linkedOrders.filter((o) => o.customer_id && !customerIds.has(o.customer_id));

  // Fix 2: historical and live orders have *different* valid shapes. A live
  // Supabase order created by the RPC correctly carries both binding fields —
  // that is not a violation. Only a half-populated or duplicate-attempt row is.
  const consistency = checkOrderConsistency(target.orders as unknown as VerifyOrderRow[]);

  const badArithmetic = checkItemArithmetic(target.items);

  const dupAttemptIds = checkUniqueness(
    target.orders.map((o) => o.checkout_attempt_id),
    'checkout_attempt_id',
  );

  const report = {
    counts: {
      customers: target.customers.length,
      orders: target.orders.length,
      order_items: target.items.length,
    },
    order_classes: consistency.counts,
    duplicate_order_numbers: dupOrderNumbers.length,
    duplicate_phones: dupPhones.length,
    duplicate_item_keys: dupItemKeys.length,
    duplicate_checkout_attempt_ids: dupAttemptIds.duplicates.length,
    orphan_items: orphanItems.length,
    bad_customer_links: badLinks.length,
    order_consistency_violations: consistency.violations.length,
    order_consistency_detail: consistency.violations.map((v) => `${v.order_number}: ${v.kind}`),
    item_arithmetic_violations: badArithmetic.length,
    pages_expected: 3,
  };

  log(JSON.stringify(report, null, 2));

  const failures: string[] = [];
  if (dupOrderNumbers.length) failures.push('duplicate order_number');
  if (dupPhones.length) failures.push('duplicate phone');
  if (dupItemKeys.length) failures.push('duplicate (order_id,item_key)');
  if (dupAttemptIds.duplicates.length) failures.push('duplicate checkout_attempt_id');
  if (orphanItems.length) failures.push('orphan order_items');
  if (badLinks.length) failures.push('bad customer_id links');
  if (consistency.violations.length) failures.push('order consistency violations (see order_consistency_detail)');
  if (badArithmetic.length) failures.push('item arithmetic mismatch');

  if (failures.length) {
    log(`VERIFY FAIL: ${failures.join('; ')}`);
    process.exitCode = 1;
    return;
  }
  log(
    `VERIFY PASS — ${consistency.counts.historical} historical order(s), ` +
    `${consistency.counts.live} live Supabase order(s)`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = parseMode(args);
  log(`mode=${mode}`);
  log('Directus access: GET only');

  const testPhones = new Set(
    String(args['test-phone'] ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean),
  );

  const db = supabase();

  if (mode === 'verify') {
    await runVerify(db);
    return;
  }

  // ---- source snapshot (GET only) ----
  const registry = await fetchDirectusCustomers();
  log(`source customers (registry): ${registry.length}`);

  const rawOrders = await fetchDirectusOrders();
  const rawItems = await fetchDirectusOrderItems();
  log(`source orders: ${rawOrders.length}`);
  log(`source order_items: ${rawItems.length}`);

  // ---- target snapshot (SELECT only) ----
  const target = await fetchTarget(db);
  log(`target customers: ${target.customers.length}`);
  log(`target orders: ${target.orders.length}`);
  log(`target order_items: ${target.items.length}`);

  if (mode === 'audit') {
    const audit = {
      source: {
        registry_customers: registry.length,
        orders: rawOrders.length,
        order_items: rawItems.length,
      },
      target: {
        customers: target.customers.length,
        orders: target.orders.length,
        order_items: target.items.length,
      },
      delta_hint: {
        customers_upper_bound: registry.length,
        orders_upper_bound: rawOrders.length,
        note: 'exact delta requires --dry-run (identity + payload compare)',
      },
    };
    log(JSON.stringify(audit, null, 2));
    log('AUDIT done (read-only)');
    return;
  }

  // ---- transform source → target DTO shape ----
  const sourceOrders: HistoricalOrderRow[] = rawOrders.map(toHistoricalOrder);
  const sourceItems: HistoricalItemRow[] = rawItems.map(toHistoricalItem);

  // Hard guard: source ids must be uuid-compatible or the plan stops.
  for (const o of sourceOrders) {
    if (!isUuid(o.id)) throw new Error(`BLOCKED: order id not uuid-compatible: ${o.id}`);
    if (!o.order_number) throw new Error(`BLOCKED: order missing order_number: ${o.id}`);
    if (!o.created_at) throw new Error(`BLOCKED: order missing created_at: ${o.order_number}`);
  }

  // ---- plan ----
  const customerPlan = planCustomers(registry, target.customers, { testPhones });
  const orderPlan = planOrders(sourceOrders, sourceItems, target.orders, target.items);
  const summary = summarize(customerPlan, orderPlan, {
    sourceCustomers: registry.length,
    existingCustomers: target.customers.length,
    sourceOrders: sourceOrders.length,
    sourceItems: sourceItems.length,
    existingOrders: target.orders.length,
    existingItems: target.items.length,
  });

  log(JSON.stringify(summary, null, 2));

  if (summary.stopped) {
    log('STOP: plan contains conflicts — nothing will be written.');
    for (const r of summary.stop_reasons) log(`  STOP ${r}`);
    process.exitCode = 2;
    return;
  }

  const script = buildImportScript(
    customerPlan.toInsert,
    customerPlan.nameFills,
    orderPlan.toInsert,
    {
      terminal: 'commit',
      note: `mode=${mode}; customers insert=${customerPlan.toInsert.length} fills=${customerPlan.nameFills.length}; orders insert=${orderPlan.toInsert.length} skipped-identical=${orderPlan.skippedIdentical.length}`,
    },
  );
  const drill = buildPerOrderScript(orderPlan.toInsert, {
    terminal: 'rollback',
    note: 'DRILL — guaranteed ROLLBACK, proves atomicity with zero persistence',
  });

  const outSql = typeof args['out-sql'] === 'string' ? args['out-sql'] : '';
  if (outSql) {
    writeFileSync(outSql, script);
    log(`wrote apply script -> ${outSql}`);
    writeFileSync(outSql.replace(/\.sql$/, '') + '.drill.sql', drill);
    log(`wrote rollback drill script -> ${outSql.replace(/\.sql$/, '')}.drill.sql`);
  }

  if (mode === 'dry-run') {
    log('DRY-RUN PASS — no writes performed.');
    return;
  }

  // ---- apply ----
  const confirm = typeof args['confirm-apply'] === 'string' ? args['confirm-apply'] : '';
  if (confirm !== CONFIRM_PHRASE) {
    log(`APPLY REFUSED: --confirm-apply must be exactly "${CONFIRM_PHRASE}"`);
    process.exitCode = 3;
    return;
  }
  if (process.env.STAGE8B_ALLOW_APPLY !== '1') {
    log('APPLY REFUSED: STAGE8B_ALLOW_APPLY is not "1".');
    log('Stage 9 preparation forbids a real apply. Emit the script and run it');
    log('through the trusted admin channel inside the Stage 8B window.');
    process.exitCode = 3;
    return;
  }
  if (!outSql) {
    log('APPLY REFUSED: --out-sql is required (the script is the audit trail).');
    process.exitCode = 3;
    return;
  }

  // Two-step confirmation: the phrase was already typed; require an explicit
  // second acknowledgement immediately before execution is authorised.
  const ack = typeof args['ack-write'] === 'string' ? args['ack-write'] : '';
  if (ack !== 'I-UNDERSTAND-THIS-WRITES-HISTORY') {
    log('APPLY REFUSED: --ack-write must be exactly "I-UNDERSTAND-THIS-WRITES-HISTORY".');
    process.exitCode = 3;
    return;
  }

  log('APPLY AUTHORISED — script is ready at the path above.');
  log('Execution is intentionally NOT performed by this tool.');
  log('Run the emitted .sql through the trusted admin channel (psql / SQL editor)');
  log('inside the Stage 8B window, after the G4 gate. The .drill.sql may be run');
  log('first at any time: it always ends in ROLLBACK.');
  log('Never re-run with a fresh plan after a partial apply — re-run --dry-run.');
}

main().catch((err) => {
  log(`ERROR ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

// Re-exported for tests.
export { asBool, asInt, asString, relationId };
