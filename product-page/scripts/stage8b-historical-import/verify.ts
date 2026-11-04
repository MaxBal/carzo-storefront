/**
 * Stage 8B historical import — pure verification checks.
 *
 * No I/O. Every function here is a pure predicate over already-loaded rows so
 * the rules can be tested against mixed fixtures without touching a database.
 *
 * Order classification is the core of Fix 2. Two legitimate kinds of row
 * exist in `public.orders` after the Stage 9 cutover:
 *
 *   historical  — written by the Stage 8B import. Must carry
 *                 `checkout_attempt_id = NULL` and `request_fingerprint = NULL`
 *                 (they are not checkout attempts and must never become
 *                 replayable through the RPC).
 *   live        — written by `create_order_with_items` after the cutover.
 *                 Must carry a non-null `checkout_attempt_id` and a non-empty
 *                 `request_fingerprint` (the RPC enforces both; a replay with
 *                 the same attempt id returns the same order, so the attempt
 *                 id is unique).
 *
 * A row that is neither (one side set, the other not; a live row with an empty
 * fingerprint) is a consistency defect and must fail the verify. Correctly
 * created live orders must NOT be reported as errors — that was the bug.
 */

export interface VerifyOrderRow {
  id: string;
  order_number: string;
  checkout_attempt_id: string | null;
  request_fingerprint: string | null;
}

export interface OrderClassCounts {
  historical: number;
  live: number;
}

export interface OrderConsistencyViolation {
  order_number: string;
  kind:
    | 'half-populated'
    | 'live-without-attempt-id'
    | 'live-without-fingerprint'
    | 'duplicate-attempt-id';
  detail: string;
}

/** A historical import row: both replay-binding fields explicitly NULL. */
export function isHistoricalOrder(row: VerifyOrderRow): boolean {
  return row.checkout_attempt_id === null && row.request_fingerprint === null;
}

/** A live Supabase order: both replay-binding fields present and usable. */
export function isLiveOrder(row: VerifyOrderRow): boolean {
  return (
    row.checkout_attempt_id !== null &&
    row.checkout_attempt_id.trim().length > 0 &&
    row.request_fingerprint !== null &&
    row.request_fingerprint.trim().length > 0
  );
}

/**
 * Classify every order and report the consistency violations.
 *
 * Rules:
 *  - exactly one of the two fields set        -> `half-populated`
 *  - attempt id set, fingerprint missing/empty -> `live-without-fingerprint`
 *  - fingerprint set, attempt id missing/empty -> `live-without-attempt-id`
 *  - two live orders sharing an attempt id     -> `duplicate-attempt-id`
 *      (the RPC is idempotent on `checkout_attempt_id`, so a repeated checkout
 *       attempt must resolve to a single order — never two)
 */
export function checkOrderConsistency(
  rows: VerifyOrderRow[],
): { counts: OrderClassCounts; violations: OrderConsistencyViolation[] } {
  const violations: OrderConsistencyViolation[] = [];
  let historical = 0;
  let live = 0;

  const attemptIdOwners = new Map<string, string>();

  for (const row of rows) {
    const hasAttempt = row.checkout_attempt_id !== null && row.checkout_attempt_id.trim().length > 0;
    const hasFingerprint =
      row.request_fingerprint !== null && row.request_fingerprint.trim().length > 0;

    if (isHistoricalOrder(row)) {
      historical += 1;
      continue;
    }

    if (isLiveOrder(row)) {
      live += 1;
      const attempt = (row.checkout_attempt_id as string).trim();
      const owner = attemptIdOwners.get(attempt);
      if (owner !== undefined) {
        violations.push({
          order_number: row.order_number,
          kind: 'duplicate-attempt-id',
          detail: `checkout_attempt_id ${attempt} is already used by order ${owner}`,
        });
      } else {
        attemptIdOwners.set(attempt, row.order_number);
      }
      continue;
    }

    // Neither historical nor live — a consistency defect.
    if (hasAttempt && !hasFingerprint) {
      violations.push({
        order_number: row.order_number,
        kind: 'live-without-fingerprint',
        detail: 'checkout_attempt_id is set but request_fingerprint is NULL or empty',
      });
    } else if (hasFingerprint && !hasAttempt) {
      violations.push({
        order_number: row.order_number,
        kind: 'live-without-attempt-id',
        detail: 'request_fingerprint is set but checkout_attempt_id is NULL or empty',
      });
    } else {
      // Both present but not both usable: e.g. empty-string attempt id, or an
      // empty fingerprint with a whitespace-only attempt id.
      violations.push({
        order_number: row.order_number,
        kind: 'half-populated',
        detail:
          `attempt_id=${JSON.stringify(row.checkout_attempt_id)} ` +
          `fingerprint=${JSON.stringify(row.request_fingerprint)}`,
      });
    }
  }

  return { counts: { historical, live }, violations };
}

/** line_total must equal unit_price * quantity — the import never recalculates. */
export function checkItemArithmetic(
  items: Array<{ order_id: string; item_key: string | null; unit_price: number; quantity: number; line_total: number }>,
): Array<{ order_id: string; item_key: string | null; expected: number; actual: number }> {
  const bad: Array<{ order_id: string; item_key: string | null; expected: number; actual: number }> = [];
  for (const it of items) {
    const expected = it.unit_price * it.quantity;
    if (it.line_total !== expected) {
      bad.push({ order_id: it.order_id, item_key: it.item_key, expected, actual: it.line_total });
    }
  }
  return bad;
}

export interface UniquenessReport {
  duplicates: Array<{ key: string; count: number }>;
}

export function checkUniqueness(
  keys: Array<string | null | undefined>,
  label: string,
): UniquenessReport {
  const counts = new Map<string, number>();
  for (const raw of keys) {
    if (raw === null || raw === undefined) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  const duplicates: Array<{ key: string; count: number }> = [];
  for (const [key, count] of Array.from(counts.entries())) {
    if (count > 1) duplicates.push({ key: `${label}:${key}`, count });
  }
  return { duplicates };
}
