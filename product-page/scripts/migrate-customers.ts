/**
 * PHASE 3 admin tooling: migrate customer registry into Supabase public.customers.
 *
 * Not application runtime. Does not change CUSTOMER_STORE.
 *
 * Usage:
 *   npx tsx scripts/migrate-customers.ts --dry-run \
 *     --legacy-csv /path/to/carzo_customers_directus_final.csv \
 *     [--live-json /path/to/directus-customers-snapshot.json] \
 *     [--test-phone +380...]
 *
 *   npx tsx scripts/migrate-customers.ts --apply \
 *     --legacy-csv ... [--live-json ...] \
 *     --out-sql /tmp/customers-import.sql
 *
 * Env (apply via trusted admin channel, never commit values):
 *   DIRECTUS_URL / DIRECTUS_ADMIN_TOKEN or DIRECTUS_READ_TOKEN  (optional live fetch)
 *   SUPABASE_URL / SUPABASE_SECRET_KEY                         (optional direct apply)
 *
 * Default apply path writes SQL for review; it does NOT silently write.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

type RawRow = Record<string, unknown>;

interface ResolvedCustomer {
  phone: string;
  full_name: string | null;
  source: string;
  imported: boolean;
  legacy_orders_count: number | null;
  legacy_products_count: number | null;
  legacy_city: string | null;
  legacy_delivery: string | null;
}

export function normalizeCustomerPhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  let core: string | null = null;
  if (digits.startsWith('380') && digits.length >= 12) core = digits.slice(3, 12);
  else if (digits.startsWith('38') && digits.length >= 11) {
    core = digits.slice(2, 11).replace(/^0/, '').slice(0, 9);
  } else if (digits.startsWith('0') && digits.length >= 10) core = digits.slice(1, 10);
  else if (digits.length === 9) core = digits;
  else if (digits.length >= 9) core = digits.slice(-9);
  if (!core || !/^\d{9}$/.test(core)) return null;
  return `+380${core}`;
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function sqlStr(v: string | null): string {
  if (v === null) return 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}

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

function loadLegacyCsv(path: string): RawRow[] {
  // Minimal CSV parser: expects header with phone/full_name/source/legacy_*/imported
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const headers = splitCsvLine(lines[0]);
  const rows: RawRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const row: RawRow = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function loadLiveJson(path: string): RawRow[] {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const customers = raw?.data?.customers;
  return Array.isArray(customers) ? customers : [];
}

function classify(rows: RawRow[], origin: string, testPhones: Set<string>) {
  const byPhone = new Map<string, Array<RawRow & { origin: string }>>();
  let invalid = 0;
  let testExcluded = 0;
  for (const r of rows) {
    const phone = normalizeCustomerPhone(r.phone);
    if (!phone) {
      invalid += 1;
      continue;
    }
    if (testPhones.has(phone)) {
      testExcluded += 1;
      continue;
    }
    const rec = { ...r, origin, phone } as RawRow & { origin: string; phone: string };
    const list = byPhone.get(phone) ?? [];
    list.push(rec);
    byPhone.set(phone, list);
  }
  return { byPhone, invalid, testExcluded };
}

/**
 * Deterministic import merge:
 * - provenance text fields: live Directus > legacy CSV
 * - legacy metadata: first non-null in that same order
 * - source: first non-null provenance string
 * - imported: AND of flags (legacy import stays true)
 */
function mergeRecords(recs: Array<RawRow & { origin: string; phone: string }>): ResolvedCustomer {
  const ordered = [...recs].sort((a, b) => (a.origin === 'live' ? 0 : 1) - (b.origin === 'live' ? 0 : 1));
  const out: ResolvedCustomer = {
    phone: ordered[0].phone,
    full_name: null,
    source: 'import',
    imported: true,
    legacy_orders_count: null,
    legacy_products_count: null,
    legacy_city: null,
    legacy_delivery: null,
  };
  let imported = true;
  for (const r of ordered) {
    const name = typeof r.full_name === 'string' ? r.full_name.trim() : '';
    if (!out.full_name && name) out.full_name = name;
    const city = typeof r.legacy_city === 'string' ? r.legacy_city.trim() : '';
    if (!out.legacy_city && city) out.legacy_city = city;
    const delivery = typeof r.legacy_delivery === 'string' ? r.legacy_delivery.trim() : '';
    if (!out.legacy_delivery && delivery) out.legacy_delivery = delivery;
    if (out.legacy_orders_count === null) out.legacy_orders_count = toInt(r.legacy_orders_count);
    if (out.legacy_products_count === null) out.legacy_products_count = toInt(r.legacy_products_count);
    const source = typeof r.source === 'string' ? r.source.trim() : '';
    if (out.source === 'import' && source) out.source = source;
    const imp = r.imported;
    const impBool = typeof imp === 'boolean' ? imp : String(imp).toLowerCase() === 'true';
    imported = imported && impBool;
  }
  out.imported = imported;
  return out;
}

export function buildUpsertSql(rows: ResolvedCustomer[]): string {
  const values = rows
    .map(
      (r) =>
        `(${sqlStr(r.phone)}, ${sqlStr(r.full_name)}, ${sqlStr(r.source)}, ${r.imported ? 'true' : 'false'}, ${r.legacy_orders_count ?? 'NULL'}, ${r.legacy_products_count ?? 'NULL'}, ${sqlStr(r.legacy_city)}, ${sqlStr(r.legacy_delivery)})`,
    )
    .join(',\n');
  return `INSERT INTO public.customers (
  phone, full_name, source, imported,
  legacy_orders_count, legacy_products_count, legacy_city, legacy_delivery
) VALUES
${values}
ON CONFLICT (phone) DO UPDATE SET
  full_name = CASE
    WHEN EXCLUDED.full_name IS NOT NULL AND EXCLUDED.full_name <> '' THEN EXCLUDED.full_name
    ELSE customers.full_name
  END,
  updated_at = now();`;
}

async function maybeFetchLive(): Promise<RawRow[]> {
  const url = process.env.DIRECTUS_URL?.replace(/\/$/, '');
  const token = process.env.DIRECTUS_ADMIN_TOKEN || process.env.DIRECTUS_READ_TOKEN;
  if (!url || !token) return [];
  const res = await fetch(`${url}/items/carzo_site_settings?fields=customers`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Directus fetch failed: ${res.status}`);
  const body = (await res.json()) as { data?: { customers?: RawRow[] } };
  return body.data?.customers ?? [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = Boolean(args['dry-run']) || !args.apply;
  const apply = Boolean(args.apply);
  if (apply && dryRun && args['dry-run']) {
    // explicit both: prefer --apply only when --apply set without requiring dry-run
  }
  const legacyPath = String(args['legacy-csv'] || '');
  const livePath = args['live-json'] ? String(args['live-json']) : '';
  const outSql = args['out-sql'] ? String(args['out-sql']) : '';
  const testPhones = new Set(
    String(args['test-phone'] || '+380661031094')
      .split(',')
      .map((p) => normalizeCustomerPhone(p))
      .filter(Boolean) as string[],
  );

  const legacy = legacyPath ? loadLegacyCsv(legacyPath) : [];
  let live: RawRow[] = livePath ? loadLiveJson(livePath) : [];
  if (!livePath) {
    try {
      live = await maybeFetchLive();
    } catch {
      live = [];
    }
  }

  const a = classify(legacy, 'legacy', testPhones);
  const b = classify(live, 'live', testPhones);
  const byPhone = new Map(a.byPhone);
  for (const [phone, recs] of b.byPhone) {
    const merged = byPhone.get(phone) ?? [];
    byPhone.set(phone, [...merged, ...recs]);
  }

  let mergeGroups = 0;
  const resolved: ResolvedCustomer[] = [];
  for (const [, recs] of byPhone) {
    if (recs.length > 1) mergeGroups += 1;
    resolved.push(mergeRecords(recs));
  }

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    legacy_raw: legacy.length,
    live_raw: live.length,
    invalid_phone: a.invalid + b.invalid,
    test_excluded: a.testExcluded + b.testExcluded,
    duplicate_merge_groups: mergeGroups,
    unresolved_conflicts: 0,
    unique_ready: resolved.length,
    source_dist: resolved.reduce<Record<string, number>>((acc, r) => {
      acc[r.source] = (acc[r.source] ?? 0) + 1;
      return acc;
    }, {}),
    imported_true: resolved.filter((r) => r.imported).length,
    imported_false: resolved.filter((r) => !r.imported).length,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!apply) return;

  const sql = buildUpsertSql(resolved);
  if (outSql) {
    writeFileSync(outSql, sql);
    console.error(`Wrote SQL (${resolved.length} rows) -> ${outSql}`);
    console.error('sha256=' + createHash('sha256').update(sql).digest('hex'));
    return;
  }
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
    throw new Error(
      'Direct apply path is intentionally not enabled in PHASE 3 tooling. Use --out-sql and a trusted admin channel.',
    );
  }
  throw new Error('Provide --out-sql to emit import SQL.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
