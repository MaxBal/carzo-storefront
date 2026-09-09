export interface LoyaltyCheckResult {
  eligible: boolean;
  discountPercent: number;
}

const TEST_LOYALTY_PHONE = '380661031094';
const LOYALTY_DISCOUNT_PERCENT = 5;

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `38${digits}`;
  if (digits.length === 12 && digits.startsWith('380')) return digits;
  if (digits.length === 13 && digits.startsWith('380')) return digits;
  return digits;
}

export async function checkLoyaltyDiscount(phone: string): Promise<LoyaltyCheckResult> {
  const normalized = normalizePhone(phone);
  if (normalized === TEST_LOYALTY_PHONE) {
    return { eligible: true, discountPercent: LOYALTY_DISCOUNT_PERCENT };
  }
  return { eligible: false, discountPercent: 0 };
}
