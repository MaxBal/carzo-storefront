export const UKRAINE_PHONE_MASK_PREFIX = '+38 (0';
export const UKRAINE_PHONE_PATTERN = '\\+38 \\(0[0-9]{2}\\) [0-9]{3}-[0-9]{2}-[0-9]{2}';

export function formatUkrainePhoneInput(value: string) {
  const digits = value.replace(/\D/g, '');
  let subscriberDigits = digits;

  if (digits.startsWith('380')) subscriberDigits = digits.slice(3);
  else if (digits.startsWith('38')) subscriberDigits = digits.slice(2).replace(/^0/, '');
  else if (digits.startsWith('0')) subscriberDigits = digits.slice(1);

  subscriberDigits = subscriberDigits.slice(0, 9);
  const operator = subscriberDigits.slice(0, 2);
  const first = subscriberDigits.slice(2, 5);
  const second = subscriberDigits.slice(5, 7);
  const third = subscriberDigits.slice(7, 9);

  let formatted = `${UKRAINE_PHONE_MASK_PREFIX}${operator}`;
  if (subscriberDigits.length >= 2) formatted += ')';
  if (first) formatted += ` ${first}`;
  if (second) formatted += `-${second}`;
  if (third) formatted += `-${third}`;
  return formatted;
}
