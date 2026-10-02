/**
 * Canonical customer phone normalization (shared by store adapters and tooling).
 * Canonical DB form: +380XXXXXXXXX (prefix +380 and exactly 9 digits).
 * Pure module — safe outside the Next.js server runtime.
 */

export function normalizeCustomerPhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  let core: string | null = null;
  if (digits.startsWith('380')) {
    core = digits.slice(3, 12);
  } else if (digits.startsWith('38') && digits.length >= 11) {
    core = digits.slice(2, 11).replace(/^0/, '');
  } else if (digits.startsWith('0') && digits.length >= 10) {
    core = digits.slice(1, 10);
  } else if (digits.length === 9) {
    core = digits;
  } else if (digits.length >= 9) {
    core = digits.slice(-9);
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
