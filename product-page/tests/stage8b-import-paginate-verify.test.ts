/**
 * Stage 8B historical import — pagination and order-consistency tests.
 *
 * Covers the two release-blocker fixes:
 *  1. customer reads must be provably complete past the PostgREST page cap
 *     (a >1000-row registry must load in full, not in a silent 1000-row subset);
 *  2. `--verify` must distinguish historical orders from live Supabase orders
 *     instead of flagging correctly created live orders as errors.
 *
 * No network, no database. Run: pnpm run test:stage8b-import
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_PAGE_SIZE,
  fetchAllPaginated,
  IncompleteReadError,
  type PageResult,
} from '../scripts/stage8b-historical-import/paginate';
import {
  checkItemArithmetic,
  checkOrderConsistency,
  checkUniqueness,
  isHistoricalOrder,
  isLiveOrder,
  type VerifyOrderRow,
} from '../scripts/stage8b-historical-import/verify';

// ---------------------------------------------------------------------------
// Fake paged server
// ---------------------------------------------------------------------------

interface FakeOptions {
  rows: Array<Record<string, unknown>>;
  /** When set, overrides the total reported to the client on every page. */
  totalOverride?: number | null;
  /** When set, the total changes after this many pages have been served. */
  moveTotalAfterPages?: number;
  /** When set, the server returns this error message instead of rows. */
  failOnPage?: number;
  /** When set, the server stops returning rows after this many rows. */
  truncateAfter?: number;
}

function makeFetcher(opts: FakeOptions) {
  let pagesServed = 0;
  const calls: Array<{ from: number; to: number }> = [];
  const fetchPage = async (from: number, to: number): Promise<PageResult<Record<string, unknown>>> => {
    calls.push({ from, to });
    pagesServed += 1;
    if (opts.failOnPage !== undefined && pagesServed === opts.failOnPage) {
      return { rows: [], error: 'connection reset', total: null };
    }
    let total = opts.totalOverride === undefined ? opts.rows.length : opts.totalOverride;
    if (opts.moveTotalAfterPages !== undefined && pagesServed > opts.moveTotalAfterPages) {
      total = (total ?? 0) + 7;
    }
    let slice = opts.rows.slice(from, to + 1);
    if (opts.truncateAfter !== undefined) {
      slice = opts.rows.slice(from, Math.min(to + 1, opts.truncateAfter));
    }
    return { rows: slice, error: null, total };
  };
  return { fetchPage, calls };
}

function makeRows(n: number): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < n; i += 1) {
    rows.push({ phone: `+38050${String(i).padStart(7, '0')}`, full_name: `c${i}` });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Fix 1 — pagination
// ---------------------------------------------------------------------------

describe('fetchAllPaginated (Fix 1 — complete reads past the page cap)', () => {
  it('loads all 5994 customers across 6 pages, not just the first 1000', async () => {
    const rows = makeRows(5994);
    const { fetchPage, calls } = makeFetcher({ rows });
    const all = await fetchAllPaginated('customers', fetchPage);
    assert.equal(all.length, 5994);
    assert.equal(all[0].phone, '+380500000000');
    assert.equal(all[5993].phone, '+380500005993');
    // 5994 / 1000 = 6 pages (the last one short).
    assert.equal(calls.length, 6);
    assert.deepEqual(calls.map((c) => c.from), [0, 1000, 2000, 3000, 4000, 5000]);
  });

  it('uses range paging with an inclusive upper bound', async () => {
    const rows = makeRows(2500);
    const { fetchPage, calls } = makeFetcher({ rows });
    await fetchAllPaginated('customers', fetchPage);
    assert.deepEqual(calls[0], { from: 0, to: 999 });
    assert.deepEqual(calls[1], { from: 1000, to: 1999 });
    assert.deepEqual(calls[2], { from: 2000, to: 2999 });
  });

  it('returns exactly the rows on the boundary (1000, 2000, 3000…)', async () => {
    for (const n of [1000, 2000, 3000]) {
      const { fetchPage } = makeFetcher({ rows: makeRows(n) });
      const all = await fetchAllPaginated('customers', fetchPage);
      assert.equal(all.length, n, `expected ${n} rows`);
    }
  });

  it('refuses an incomplete read: collected < reported total', async () => {
    const rows = makeRows(5994);
    const { fetchPage } = makeFetcher({ rows, truncateAfter: 1000 });
    await assert.rejects(
      () => fetchAllPaginated('customers', fetchPage),
      (err: unknown) => {
        assert.ok(err instanceof IncompleteReadError);
        assert.match((err as Error).message, /incomplete selection — collected 1000 of 5994/);
        return true;
      },
    );
  });

  it('refuses when the reported total changes mid-read', async () => {
    const rows = makeRows(2500);
    const { fetchPage } = makeFetcher({ rows, moveTotalAfterPages: 1 });
    await assert.rejects(
      () => fetchAllPaginated('customers', fetchPage),
      (err: unknown) => {
        assert.ok(err instanceof IncompleteReadError);
        assert.match((err as Error).message, /row count changed during pagination/);
        return true;
      },
    );
  });

  it('propagates a page error instead of returning a partial set', async () => {
    const rows = makeRows(5994);
    const { fetchPage } = makeFetcher({ rows, failOnPage: 3 });
    await assert.rejects(
      () => fetchAllPaginated('customers', fetchPage),
      (err: unknown) => {
        assert.ok(err instanceof IncompleteReadError);
        assert.match((err as Error).message, /connection reset/);
        return true;
      },
    );
  });

  it('refuses a boundary-sized result when no total is reported', async () => {
    // 2000 rows and no count: cannot prove there is not a third page.
    const rows = makeRows(2000);
    const { fetchPage } = makeFetcher({ rows, totalOverride: null });
    await assert.rejects(
      () => fetchAllPaginated('customers', fetchPage),
      (err: unknown) => {
        assert.ok(err instanceof IncompleteReadError);
        assert.match((err as Error).message, /falls exactly on a page boundary/);
        return true;
      },
    );
  });

  it('accepts a non-boundary result when no total is reported', async () => {
    const rows = makeRows(1500);
    const { fetchPage } = makeFetcher({ rows, totalOverride: null });
    const all = await fetchAllPaginated('customers', fetchPage);
    assert.equal(all.length, 1500);
  });

  it('handles an empty table', async () => {
    const { fetchPage } = makeFetcher({ rows: [] });
    const all = await fetchAllPaginated('customers', fetchPage);
    assert.equal(all.length, 0);
  });

  it('rejects an invalid page size', async () => {
    const { fetchPage } = makeFetcher({ rows: makeRows(10) });
    await assert.rejects(
      () => fetchAllPaginated('customers', fetchPage, 0),
      (err: unknown) => {
        assert.ok(err instanceof IncompleteReadError);
        assert.match((err as Error).message, /invalid page size/);
        return true;
      },
    );
  });

  it('never yields a subset when the registry is larger than one page', async () => {
    // Regression guard for the exact defect: a single uncapped SELECT would
    // return at most DEFAULT_PAGE_SIZE rows and the plan would then treat the
    // other 4994 phones as "new".
    const rows = makeRows(5994);
    const { fetchPage } = makeFetcher({ rows });
    const all = await fetchAllPaginated('customers', fetchPage);
    assert.ok(all.length > DEFAULT_PAGE_SIZE);
    assert.equal(all.length, rows.length);
    assert.equal(new Set(all.map((r) => r.phone)).size, 5994, 'no duplicate or lost phones');
  });
});

// ---------------------------------------------------------------------------
// Fix 2 — order consistency
// ---------------------------------------------------------------------------

function order(partial: Partial<VerifyOrderRow> & { order_number: string }): VerifyOrderRow {
  return {
    id: `id-${partial.order_number}`,
    checkout_attempt_id: null,
    request_fingerprint: null,
    ...partial,
  };
}

describe('checkOrderConsistency (Fix 2 — historical vs live orders)', () => {
  it('classifies a historical import row (both fields NULL)', () => {
    const row = order({ order_number: 'CZ-20261013-BD3D52' });
    assert.equal(isHistoricalOrder(row), true);
    assert.equal(isLiveOrder(row), false);
    const { counts, violations } = checkOrderConsistency([row]);
    assert.deepEqual(counts, { historical: 1, live: 0 });
    assert.deepEqual(violations, []);
  });

  it('classifies a live Supabase order (both fields present) — not an error', () => {
    const row = order({
      order_number: 'CZ-20261104-ABCDEF',
      checkout_attempt_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      request_fingerprint: 'fp-abc123',
    });
    assert.equal(isLiveOrder(row), true);
    assert.equal(isHistoricalOrder(row), false);
    const { counts, violations } = checkOrderConsistency([row]);
    assert.deepEqual(counts, { historical: 0, live: 1 });
    assert.deepEqual(violations, [], 'a correctly created live order must NOT be a violation');
  });

  it('accepts a mixed base of historical and live orders', () => {
    const rows = [
      order({ order_number: 'CZ-20261013-BD3D52' }),
      order({ order_number: 'CZ-20261014-AAAAAA' }),
      order({
        order_number: 'CZ-20261104-ABCDEF',
        checkout_attempt_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        request_fingerprint: 'fp-1',
      }),
      order({
        order_number: 'CZ-20261104-ABCDFG',
        checkout_attempt_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        request_fingerprint: 'fp-2',
      }),
    ];
    const { counts, violations } = checkOrderConsistency(rows);
    assert.deepEqual(counts, { historical: 2, live: 2 });
    assert.deepEqual(violations, []);
  });

  it('flags a half-populated row (attempt id set, fingerprint NULL)', () => {
    const row = order({
      order_number: 'CZ-X',
      checkout_attempt_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      request_fingerprint: null,
    });
    const { counts, violations } = checkOrderConsistency([row]);
    assert.deepEqual(counts, { historical: 0, live: 0 });
    assert.equal(violations.length, 1);
    assert.equal(violations[0].kind, 'live-without-fingerprint');
  });

  it('flags a half-populated row (fingerprint set, attempt id NULL)', () => {
    const row = order({
      order_number: 'CZ-X',
      checkout_attempt_id: null,
      request_fingerprint: 'fp-abc',
    });
    const { violations } = checkOrderConsistency([row]);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].kind, 'live-without-attempt-id');
  });

  it('flags a live row with an empty fingerprint', () => {
    const row = order({
      order_number: 'CZ-X',
      checkout_attempt_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      request_fingerprint: '   ',
    });
    const { violations } = checkOrderConsistency([row]);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].kind, 'live-without-fingerprint');
  });

  it('flags a live row with an empty attempt id', () => {
    const row = order({
      order_number: 'CZ-X',
      checkout_attempt_id: '',
      request_fingerprint: 'fp-abc',
    });
    const { violations } = checkOrderConsistency([row]);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].kind, 'live-without-attempt-id');
  });

  it('flags a repeated checkout attempt that produced two orders', () => {
    // The RPC is idempotent on checkout_attempt_id: a replay must return the
    // same order. Two rows sharing an attempt id is a defect.
    const rows = [
      order({
        order_number: 'CZ-1',
        checkout_attempt_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        request_fingerprint: 'fp-1',
      }),
      order({
        order_number: 'CZ-2',
        checkout_attempt_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        request_fingerprint: 'fp-2',
      }),
    ];
    const { counts, violations } = checkOrderConsistency(rows);
    assert.deepEqual(counts, { historical: 0, live: 2 });
    assert.equal(violations.length, 1);
    assert.equal(violations[0].kind, 'duplicate-attempt-id');
  });

  it('accepts a repeated checkout attempt that resolved to one order (idempotent replay)', () => {
    // Simulates: attempt -> created:true, retry with same attempt -> created:false
    // (the same row). Exactly one row must exist and it must be valid live.
    const rows = [
      order({
        order_number: 'CZ-1',
        checkout_attempt_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        request_fingerprint: 'fp-1',
      }),
    ];
    const { counts, violations } = checkOrderConsistency(rows);
    assert.deepEqual(counts, { historical: 0, live: 1 });
    assert.deepEqual(violations, []);
  });

  it('does not treat whitespace-only attempt ids as valid identity', () => {
    const rows = [
      order({
        order_number: 'CZ-1',
        checkout_attempt_id: '   ',
        request_fingerprint: 'fp-1',
      }),
    ];
    const { violations } = checkOrderConsistency(rows);
    assert.equal(violations.length, 1);
  });

  it('handles an empty order set', () => {
    const { counts, violations } = checkOrderConsistency([]);
    assert.deepEqual(counts, { historical: 0, live: 0 });
    assert.deepEqual(violations, []);
  });
});

describe('checkItemArithmetic', () => {
  it('passes when line_total = unit_price * quantity', () => {
    const bad = checkItemArithmetic([
      { order_id: 'o1', item_key: 'k', unit_price: 120000, quantity: 2, line_total: 240000 },
    ]);
    assert.deepEqual(bad, []);
  });

  it('flags a recalculated price (the import must never do this)', () => {
    const bad = checkItemArithmetic([
      { order_id: 'o1', item_key: 'k', unit_price: 120000, quantity: 2, line_total: 239999 },
    ]);
    assert.equal(bad.length, 1);
    assert.equal(bad[0].expected, 240000);
    assert.equal(bad[0].actual, 239999);
  });
});

describe('checkUniqueness', () => {
  it('reports duplicate keys and ignores nulls', () => {
    const report = checkUniqueness(['a', 'b', 'a', null, undefined], 'k');
    assert.equal(report.duplicates.length, 1);
    assert.deepEqual(report.duplicates[0], { key: 'k:a', count: 2 });
  });

  it('reports nothing for unique keys', () => {
    const report = checkUniqueness(['a', 'b', 'c'], 'k');
    assert.deepEqual(report.duplicates, []);
  });
});
