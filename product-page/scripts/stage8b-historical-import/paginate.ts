/**
 * Stage 8B historical import — paginated target reads.
 *
 * PostgREST caps a single response (1000 rows by default on this project).
 * `customers` holds 5,994 rows and must be read in full before any import
 * decision: an import planned against a truncated registry would look like
 * "these phones are new" and wrongly insert duplicates.
 *
 * This module is the only place that knows how paging works, and it is
 * deliberately paranoid:
 *  - the reported total (`count: 'exact'`) is authoritative and is checked
 *    against the number of rows actually collected;
 *  - a total that changes mid-read means the dataset moved → refuse;
 *  - a short page before the total is reached means the read was truncated
 *    → refuse;
 *  - when no total is reported, a result that lands exactly on a page
 *    boundary is treated as possibly truncated → refuse.
 *
 * Nothing here writes. An incomplete read is an error, never a quiet subset.
 */

export interface PageResult<T> {
  rows: T[];
  /** Non-null error message when the page fetch failed. */
  error: string | null;
  /**
   * Total matching rows reported by the server for the query, or null when
   * the server did not report a count.
   */
  total: number | null;
}

export type PageFetcher<T> = (from: number, to: number) => Promise<PageResult<T>>;

export class IncompleteReadError extends Error {
  readonly code = 'INCOMPLETE_READ' as const;

  constructor(message: string) {
    super(message);
    this.name = 'IncompleteReadError';
  }
}

/** Default PostgREST page size; large enough to be fast, small enough to page. */
export const DEFAULT_PAGE_SIZE = 1000;

/**
 * Fetch every row of a table through a range-paged query, refusing to return
 * anything that is not provably complete.
 */
export async function fetchAllPaginated<T>(
  label: string,
  fetchPage: PageFetcher<T>,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new IncompleteReadError(`${label}: invalid page size ${pageSize}`);
  }

  const all: T[] = [];
  let from = 0;
  let expectedTotal: number | null = null;

  for (;;) {
    const page = await fetchPage(from, from + pageSize - 1);

    if (page.error) {
      throw new IncompleteReadError(`${label} SELECT: ${page.error}`);
    }
    if (page.total !== null) {
      if (!Number.isInteger(page.total) || page.total < 0) {
        throw new IncompleteReadError(`${label}: server reported an invalid total ${page.total}`);
      }
      if (expectedTotal === null) {
        expectedTotal = page.total;
      } else if (expectedTotal !== page.total) {
        throw new IncompleteReadError(
          `${label}: row count changed during pagination (${expectedTotal} -> ${page.total}); ` +
          'refusing to plan against a moving dataset',
        );
      }
    }

    all.push(...page.rows);

    // Short page = the server had nothing more for this range.
    if (page.rows.length < pageSize) break;

    from += pageSize;

    // Even on a full page, stop as soon as the authoritative total is reached.
    if (expectedTotal !== null && all.length >= expectedTotal) break;
  }

  if (expectedTotal !== null) {
    if (all.length !== expectedTotal) {
      throw new IncompleteReadError(
        `${label}: incomplete selection — collected ${all.length} of ${expectedTotal} rows`,
      );
    }
    return all;
  }

  // No total was reported. A result that is an exact multiple of the page
  // size cannot be distinguished from a truncated read, so it is refused.
  if (all.length > 0 && all.length % pageSize === 0) {
    throw new IncompleteReadError(
      `${label}: server reported no total and the result (${all.length} rows) falls exactly on a ` +
      'page boundary — cannot prove the read is complete; refusing to continue',
    );
  }
  return all;
}
