/**
 * Checkout transaction boundary after a successful order write.
 *
 * Order persistence is the business transaction. Once Directus accepted the
 * order, checkout MUST return success - notification and customer upsert are
 * best-effort follow-ups. A follow-up failure must never surface as a client
 * checkout failure (that invites duplicate submits).
 */

export interface PostOrderSideEffectsInput {
  notify: () => Promise<void>;
  upsertCustomer: () => Promise<void>;
  logError: (message: string, detail: string) => void;
}

/** Truncate and drop control chars so error logs stay operational, not PII dumps. */
export function safeErrorDetail(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'unknown error';
  let cleaned = '';
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    cleaned += code < 32 || code === 127 ? ' ' : ch;
  }
  return cleaned.slice(0, 200);
}

export async function runPostOrderSideEffects(
  input: PostOrderSideEffectsInput,
): Promise<void> {
  try {
    await input.notify();
  } catch (error) {
    input.logError(
      'Order notification failed after successful order write',
      safeErrorDetail(error),
    );
  }

  try {
    await input.upsertCustomer();
  } catch (error) {
    input.logError(
      'Customer upsert failed after successful order write',
      safeErrorDetail(error),
    );
  }
}

/**
 * Follow-ups belong to a newly committed order only.
 *
 * A replayed attempt reports `created:false` and must not notify again or
 * re-upsert the customer — otherwise a retry would double-message the
 * recipients. Gating here instead of at the call site keeps that rule
 * structural.
 */
export async function runPostOrderSideEffectsOnCreate(
  created: boolean,
  input: PostOrderSideEffectsInput,
): Promise<void> {
  if (!created) return;
  await runPostOrderSideEffects(input);
}
