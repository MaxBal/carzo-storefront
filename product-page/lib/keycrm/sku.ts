/**
 * keyCRM SKU mapping tables.
 * SKUs verified against the live keyCRM catalog (GET /offers) on 2026-11-06.
 * Unknown combinations resolve to null — the payload builder must fail closed.
 */

/** contact_method (site enum) → option text of keyCRM select field "Cпосіб зв'язку". */
export const CONTACT_METHOD_LABELS: Record<string, string> = {
  phone: 'Зателефонувати',
  telegram: 'Telegram',
  viber: 'Viber',
  whatsapp: 'WhatsApp',
};

/** `${sizeCode}:${designSlug}` → base case SKU. */
const CASE_SKUS: Record<string, string> = {
  'S:2-0': 'S2.0',
  'S:3-0': 'S3.0',
  'S:4-0': 'S4.0',
  'M:2-0': 'M2.0',
  'M:3-0': 'M3.0',
  'M:4-0': 'M4.0',
  'L:2-0': 'L2.0',
  'L:3-0': 'L3.0',
  'L:4-0': 'L4.0',
  'XL:2-0': 'XL2.0',
  'XL:3-0': 'XL3.0',
  'XL:4-0': 'XL4.0',
};

/** Paid fixation "дно+стінка" (`both`) → SKU per case size. */
const PAID_FIXATION_SKUS: Record<string, string> = {
  S: 'FIX-S-DW',
  M: 'FIX-M-DW',
  L: 'FIX-L-DW',
  XL: 'FIX-XL-DW',
};

/** brand_slug (site) → badge SKU. Explicit table: slugs are not derivable (rr, alfa, bmw-m …). */
const BADGE_SKUS: Record<string, string> = {
  audi: 'AUDI-ST',
  bmw: 'BMW-ST',
  toyota: 'TOYOTA-ST',
  tesla: 'TESLA-ST',
  kia: 'KIA-ST',
  rr: 'RANGEROVER-ST',
  renault: 'RENAULT-ST',
  alfa: 'ALFAROMEO-ST',
  volvo: 'VOLVO-ST',
  'bmw-m': 'BMWM-ST',
  ford: 'FORD-ST',
  honda: 'HONDA-ST',
  hyundai: 'HYUNDAI-ST',
  jeep: 'JEEP-ST',
  'land-rover': 'LANDROVER-ST',
  lexus: 'LEXUS-ST',
  mazda: 'MAZDA-ST',
  mercedes: 'MERCEDES-ST',
  mitsubishi: 'MITSUBISHI-ST',
  nissan: 'NISSAN-ST',
  peugeot: 'PEUGEOT-ST',
  porsche: 'PORSCHE-ST',
  's-line': 'SLINE-ST',
  subaru: 'SUBARU-ST',
  volkswagen: 'VOLKSWAGEN-ST',
};

/** Free fixation keys — never separate keyCRM positions. */
export const FREE_FIXATION_KEYS = ['none', 'bottom', 'wall'] as const;
/** Paid fixation key on the site. */
export const PAID_FIXATION_KEY = 'both';

export function caseSku(sizeCode: string, designSlug: string): string | null {
  return CASE_SKUS[`${String(sizeCode).toUpperCase()}:${designSlug}`] ?? null;
}

/**
 * SKU of the paid fixation add-on line, or null for free fixations.
 * Returns null for unknown sizes too — the builder must fail closed on that.
 */
export function paidFixationSku(fixationKey: string, sizeCode: string): string | null {
  if (fixationKey !== PAID_FIXATION_KEY) return null;
  return PAID_FIXATION_SKUS[String(sizeCode).toUpperCase()] ?? null;
}

/** Badge SKU for a brand slug, or null for "none"/unknown. */
export function badgeSku(brandSlug: string): string | null {
  if (!brandSlug || brandSlug === 'none') return null;
  return BADGE_SKUS[brandSlug] ?? null;
}

export function contactMethodLabel(contactMethod: string): string | null {
  return CONTACT_METHOD_LABELS[contactMethod] ?? null;
}
