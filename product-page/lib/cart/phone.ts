/**
 * Ukraine phone formatting utilities.
 *
 * Internal state always stores subscriber digits only (max 9):
 *   "931234567"
 *
 * Display format (without country code prefix):
 *   "(93) 123-45-67"
 *
 * The visual prefix "🇺🇦 +380" is rendered by the PhoneInput component,
 * not included in the formatted value.
 */

/** Extract subscriber digits (max 9) from any phone-like string. */
export function normalizeSubscriberDigits(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('380')) digits = digits.slice(3);
  else if (digits.startsWith('38')) digits = digits.slice(2).replace(/^0/, '');
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 9);
}

/** Format subscriber digits for display: "931234567" → "(93) 123-45-67". */
export function formatSubscriberPhone(digits: string): string {
  const op = digits.slice(0, 2);
  const p1 = digits.slice(2, 5);
  const p2 = digits.slice(5, 7);
  const p3 = digits.slice(7, 9);

  let result = '';
  if (op) result += `(${op}`;
  if (op.length === 2) result += ')';
  if (p1) result += ` ${p1}`;
  if (p2) result += `-${p2}`;
  if (p3) result += `-${p3}`;
  return result;
}

/** Build a full international phone string for API/validation. */
export function buildFullPhone(digits: string): string {
  return digits ? `+380${digits}` : '';
}

/** Count digit characters in a string up to a given index. */
export function countDigitsBefore(text: string, index: number): number {
  let count = 0;
  for (let i = 0; i < Math.min(index, text.length); i++) {
    if (/\d/.test(text[i])) count++;
  }
  return count;
}

/** Find the string index after the Nth digit in a formatted string. */
export function indexAfterNthDigit(formatted: string, n: number): number {
  if (n <= 0) return 0;
  let digitCount = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      digitCount++;
      if (digitCount === n) return i + 1;
    }
  }
  return formatted.length;
}
