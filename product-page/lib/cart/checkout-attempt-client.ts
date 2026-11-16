/**
 * Client-safe checkout attempt identity, persistence, and state machine.
 *
 * Persists the active checkout attempt in localStorage so page reloads and
 * network drops do not lose `checkoutAttemptId` while cart items remain in
 * localStorage.
 *
 * Key invariant (C-04 / C-05):
 * - Form edits (delivery branch/courier address, phone, loyalty phone, payment
 *   option) NEVER auto-rotate `checkoutAttemptId`.
 * - If a previous submit had an uncertain outcome (`in_flight` or `uncertain`),
 *   even cart edits preserve `checkoutAttemptId` until the server probes
 *   whether that attempt already created an order.
 */

export const CHECKOUT_ATTEMPT_STORAGE_KEY = 'carzo:checkout-attempt:v1';
export const CHECKOUT_ATTEMPT_TTL_MS = 24 * 60 * 60 * 1000;

export type CheckoutAttemptStatus = 'idle' | 'in_flight' | 'uncertain' | 'conflict';

export interface CheckoutAttemptRecord {
  attemptId: string;
  status: CheckoutAttemptStatus;
  cartSignature: string;
  updatedAt: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidAttemptUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export function computeCartItemsSignature(
  items: ReadonlyArray<{
    size: string;
    designSlug: string;
    brandId: string;
    fixation: string;
    quantity: number;
  }>,
): string {
  return items
    .map(item => [
      item.size.trim(),
      item.designSlug.trim(),
      item.brandId.trim(),
      item.fixation.trim(),
      String(Math.trunc(item.quantity)),
    ].join(':'))
    .sort()
    .join('|');
}

function defaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function defaultUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback RFC4122 v4 UUID if crypto.randomUUID is unavailable
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isAttemptStatus(value: unknown): value is CheckoutAttemptStatus {
  return value === 'idle' || value === 'in_flight' || value === 'uncertain' || value === 'conflict';
}

export function readPersistedCheckoutAttempt(
  storage: StorageLike | null = defaultStorage(),
  now: number = Date.now(),
): CheckoutAttemptRecord | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !isValidAttemptUuid(parsed.attemptId) ||
      !isAttemptStatus(parsed.status) ||
      typeof parsed.cartSignature !== 'string' ||
      typeof parsed.updatedAt !== 'number'
    ) {
      storage.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
      return null;
    }
    // A timeout cannot prove that an order was never committed.
    if (parsed.status === 'idle' && now - parsed.updatedAt > CHECKOUT_ATTEMPT_TTL_MS) {
      storage.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
      return null;
    }
    // If the page reloaded while a request was in flight, its outcome is uncertain.
    const status: CheckoutAttemptStatus =
      parsed.status === 'in_flight' ? 'uncertain' : parsed.status;
    const record: CheckoutAttemptRecord = {
      attemptId: parsed.attemptId,
      status,
      cartSignature: parsed.cartSignature,
      updatedAt: parsed.updatedAt,
    };
    if (parsed.status === 'in_flight') {
      writePersistedCheckoutAttempt(record, storage);
    }
    return record;
  } catch {
    return null;
  }
}

export function writePersistedCheckoutAttempt(
  record: CheckoutAttemptRecord,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(CHECKOUT_ATTEMPT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage quota / privacy errors; in-memory state still works.
  }
}

export function clearPersistedCheckoutAttempt(
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

export interface CheckoutAttemptOutcomeInput {
  ok: boolean;
  code?: string;
  replayed?: boolean;
}

/**
 * Deterministic client-side state machine for checkout attempts.
 */
export function createCheckoutAttemptTracker(options?: {
  storage?: StorageLike | null;
  now?: () => number;
  uuid?: () => string;
}) {
  const storage = options?.storage !== undefined ? options.storage : defaultStorage();
  const now = options?.now ?? (() => Date.now());
  const uuid = options?.uuid ?? defaultUuid;

  let current: CheckoutAttemptRecord | null = readPersistedCheckoutAttempt(storage, now());

  function persist(next: CheckoutAttemptRecord | null) {
    current = next;
    if (next) {
      writePersistedCheckoutAttempt(next, storage);
    } else {
      clearPersistedCheckoutAttempt(storage);
    }
  }

  return {
    getState(): CheckoutAttemptRecord | null {
      return current ? { ...current } : null;
    },

    /**
     * Synchronize with storage (e.g. after mount or cross-tab storage event).
     */
    hydrate(cartSignature: string): CheckoutAttemptRecord | null {
      const stored = readPersistedCheckoutAttempt(storage, now());
      if (!stored) {
        // A storage event/removal must not erase an unresolved local attempt.
        if (current && current.status !== 'idle') return { ...current };
        current = null;
        return null;
      }
      if (stored.status === 'idle' && stored.cartSignature !== cartSignature) {
        persist(null);
        return null;
      }
      current = stored;
      return { ...current };
    },

    /**
     * Returns the current checkoutAttemptId or generates a new one if none exists.
     */
    getAttemptId(cartSignature: string): string {
      if (current) {
        return current.attemptId;
      }
      const stored = readPersistedCheckoutAttempt(storage, now());
      if (stored) {
        if (stored.status === 'idle' && stored.cartSignature !== cartSignature) {
          persist(null);
        } else {
          current = stored;
          return current.attemptId;
        }
      }
      const next: CheckoutAttemptRecord = {
        attemptId: uuid(),
        status: 'idle',
        cartSignature,
        updatedAt: now(),
      };
      persist(next);
      return next.attemptId;
    },

    /**
     * Form field edits (branch, courier address, phone, loyaltyPhone, paymentOption)
     * must NEVER rotate checkoutAttemptId.
     */
    onFormEdited(): void {
      // Intentionally preserves `current` across all statuses.
    },

    /**
     * Cart composition or quantity changed.
     * - If `idle` (no request in flight or uncertain), invalidate the attempt ID
     *   so the new cart gets a fresh UUID on submit.
     * - If `in_flight` or `uncertain`, preserve the attempt ID so the next submit
     *   first checks on the server whether the uncertain attempt already created an order.
     */
    onCartChanged(nextCartSignature: string): void {
      if (!nextCartSignature) {
        if (current?.status === 'idle') {
          persist(null);
        }
        return;
      }
      if (!current) return;
      if (current.cartSignature === nextCartSignature) return;
      if (current.status === 'idle') {
        persist(null);
      }
    },

    /**
     * Marks the attempt as `in_flight` before calling `createOrder`.
     * Returns `{ allowed: false }` if a submit is already in flight (double-click guard).
     */
    beginSubmit(cartSignature: string): { allowed: boolean; attemptId: string } {
      if (current?.status === 'in_flight' || current?.status === 'conflict') {
        return { allowed: false, attemptId: current.attemptId };
      }
      const attemptId = this.getAttemptId(cartSignature);
      const next: CheckoutAttemptRecord = {
        attemptId,
        status: 'in_flight',
        cartSignature: current?.cartSignature ?? cartSignature,
        updatedAt: now(),
      };
      persist(next);
      return { allowed: true, attemptId };
    },

    /**
     * Transitions the attempt state based on the server response or network failure.
     */
    resolveOutcome(outcome: CheckoutAttemptOutcomeInput, currentCartSignature: string): void {
      if (outcome.ok) {
        // Order created or replayed — clear attempt state completely.
        persist(null);
        return;
      }

      if (outcome.code === 'ATTEMPT_REUSED') {
        // The server confirmed an existing order. Never turn this into a new purchase.
        if (current) persist({ ...current, status: 'conflict', updatedAt: now() });
        return;
      }

      if (
        outcome.code === 'INVALID' ||
        outcome.code === 'UNAVAILABLE' ||
        outcome.code === 'MAINTENANCE' ||
        outcome.code === 'PRICE_CHANGED' ||
        outcome.code === 'LOYALTY_CHANGED'
      ) {
        // A rejection of this request does not prove that a previous request
        // never committed (maintenance/validation may run before the replay probe).
        if (current) {
          persist({
            attemptId: current.attemptId,
            status: 'uncertain',
            cartSignature: currentCartSignature,
            updatedAt: now(),
          });
        }
        return;
      }

      // Network drop / timeout / FAILED / LOYALTY_UNAVAILABLE:
      // Server outcome is unknown — keep the same attemptId in `uncertain` status!
      if (current) {
        persist({
          attemptId: current.attemptId,
          status: 'uncertain',
          cartSignature: current.cartSignature,
          updatedAt: now(),
        });
      }
    },

    reset(): void {
      persist(null);
    },
  };
}
