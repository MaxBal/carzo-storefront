export const CONTACT_METHOD_VALUES = ['phone', 'telegram', 'viber', 'whatsapp'] as const;

export type ContactMethod = (typeof CONTACT_METHOD_VALUES)[number];

export const CONTACT_METHOD_OPTIONS: ReadonlyArray<{ value: ContactMethod; label: string }> = [
  { value: 'phone', label: 'Зателефонувати' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'viber', label: 'Viber' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

const CONTACT_METHOD_LABELS = new Map(
  CONTACT_METHOD_OPTIONS.map(option => [option.value, option.label]),
);

export function contactMethodLabel(value: ContactMethod) {
  return CONTACT_METHOD_LABELS.get(value) ?? CONTACT_METHOD_OPTIONS[0].label;
}
