/**
 * Canonical customer phone normalization (shared by store adapters and tooling).
 * Canonical DB form: +380XXXXXXXXX (prefix +380 and exactly 9 digits).
 * Pure module — safe outside the Next.js server runtime.
 *
 * Strict digit-length rules only — formatting symbols are ignored.
 * Never silently truncate extra digits (no slice(-9) fallback).
 */

export function normalizeCustomerPhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string' || !raw.trim()) return null;

  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  let core: string | null = null;

  // International canonical: 380 + 9 subscriber digits (12 digits total).
  if (digits.length === 12 && digits.startsWith('380')) {
    core = digits.slice(3);
  } else if (digits.length === 10 && digits.startsWith('0')) {
    // Ukrainian local: 0 + 9 subscriber digits.
    core = digits.slice(1);
  } else if (digits.length === 9) {
    // Subscriber form.
    core = digits;
  }

  if (!core || !/^\d{9}$/.test(core)) return null;
  return `+380${core}`;
}

/** Last-2-digit mask for diagnostics. Never log a full phone. */
export function maskPhone(phone: string): string {
  const canonical = normalizeCustomerPhone(phone) ?? phone;
  if (canonical.length < 5) return '***';
  return `${canonical.slice(0, 3)}***${canonical.slice(-2)}`;
}
