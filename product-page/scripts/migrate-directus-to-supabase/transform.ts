/**
 * Pure Stage 2 transforms: Directus source rows → Supabase target DTOs.
 * No network, no secrets, no PII printing.
 */

export type Raw = Record<string, unknown>;

export const PRODUCT_MEDIA_SLOTS = [
  'materials_video',
  'edging_video',
  'fixation_video',
  'magnetic_system_video',
  'magnetic_system_default_cover',
  'magnetic_system_cover_2_0_s',
  'magnetic_system_cover_2_0_m',
  'magnetic_system_cover_2_0_l',
  'magnetic_system_cover_2_0_xl',
  'magnetic_system_cover_3_0_s',
  'magnetic_system_cover_3_0_m',
  'magnetic_system_cover_3_0_l',
  'magnetic_system_cover_3_0_xl',
  'magnetic_system_cover_4_0_s',
  'magnetic_system_cover_4_0_m',
  'magnetic_system_cover_4_0_l',
  'magnetic_system_cover_4_0_xl',
] as const;

export const CONTACT_METHODS = new Set(['phone', 'telegram', 'viber', 'whatsapp']);
export const DELIVERY_METHODS = new Set(['BRANCH', 'POSTOMAT', 'COURIER']);
export const SIZE_KEYS = new Set(['s', 'm', 'l', 'xl']);

export function isUuid(v: unknown): v is string {
  return typeof v === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function asString(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  return typeof v === 'string' ? v : String(v);
}

export function asInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function asNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function asBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1 || v === '1') return true;
  if (v === 'false' || v === 0 || v === '0') return false;
  return fallback;
}

export function relationId(v: unknown): string | null {
  if (isUuid(v)) return v;
  if (v && typeof v === 'object') {
    const id = (v as Raw).id;
    return isUuid(id) ? id : null;
  }
  return null;
}

/** Stable external URL only. Never Directus file UUID / /assets/ path. */
export function mediaUrl(v: unknown): { url: string | null; fileOnly: boolean } {
  const s = asString(v);
  if (!s) return { url: null, fileOnly: false };
  if (isUuid(s)) return { url: null, fileOnly: true };
  if (s.includes('/assets/') || s.startsWith('/files/')) return { url: null, fileOnly: true };
  if (/^https?:\/\//i.test(s)) return { url: s, fileOnly: false };
  return { url: null, fileOnly: true };
}

export function stripDirectusFileIds<T>(value: T): T {
  if (typeof value === 'string') {
    if (isUuid(value) || value.includes('/assets/')) return null as unknown as T;
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripDirectusFileIds(item)).filter((item) => item !== null) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Raw = {};
    for (const [k, v] of Object.entries(value as Raw)) {
      const key = k.toLowerCase();
      if (key === 'image' || key.endsWith('_image') || key === 'file' || key === 'filename_disk') {
        continue;
      }
      const cleaned = stripDirectusFileIds(v);
      if (cleaned !== null && cleaned !== undefined) out[k] = cleaned;
    }
    return out as T;
  }
  return value;
}

export function transformDesign(row: Raw) {
  const { url, fileOnly } = mediaUrl(row.selector_image_url);
  return {
    id: row.id as string,
    slug: asString(row.slug),
    label: asString(row.label),
    version: asString(row.version),
    sort: asInt(row.sort) ?? 0,
    status: asString(row.status) ?? 'published',
    selector_image_url: url,
    _mediaFileOnly: fileOnly,
  };
}

export function transformSize(row: Raw, shipping?: Raw | null) {
  return {
    id: row.id as string,
    code: asString(row.code),
    slug: asString(row.slug),
    label: asString(row.label),
    content_group: asString(row.content_group),
    height_cm: asNumber(row.height_cm),
    width_cm: asNumber(row.width_cm),
    depth_cm: asNumber(row.depth_cm),
    sort: asInt(row.sort) ?? 0,
    status: asString(row.status) ?? 'published',
    shipping_length_cm: shipping ? asNumber(shipping.length_cm ?? shipping.shipping_length_cm) : null,
    shipping_width_cm: shipping ? asNumber(shipping.width_cm ?? shipping.shipping_width_cm) : null,
    shipping_height_cm: shipping ? asNumber(shipping.height_cm ?? shipping.shipping_height_cm) : null,
    shipping_weight_kg: shipping ? asNumber(shipping.weight_kg ?? shipping.shipping_weight_kg) : null,
  };
}

export function transformBrand(row: Raw, pricing: Raw | null | undefined) {
  const errors: string[] = [];
  let logoExtra: number | null = null;
  if (pricing) {
    logoExtra = asInt(pricing.logo_extra);
    if (logoExtra === null || logoExtra < 0) errors.push('brand_pricing.logo_extra invalid');
  } else if ((asString(row.status) ?? 'published') === 'published') {
    errors.push(`brand_pricing missing for operational brand ${asString(row.slug)}`);
  }
  const { url } = mediaUrl(row.logo_image_url);
  return {
    id: row.id as string,
    slug: asString(row.slug),
    name: asString(row.name),
    flag: asString(row.flag),
    logo_image_url: url,
    logo_extra: logoExtra ?? 0,
    sort: asInt(row.sort) ?? 0,
    status: asString(row.status) ?? 'published',
    errors,
  };
}

export function expandFixationSizeExtras(
  fixationId: string,
  extraBySize: Raw | null | undefined,
  sizeIdByCode: Map<string, string>,
): { rows: Array<{ fixation_id: string; size_id: string; extra: number }>; error?: string } {
  if (!extraBySize || typeof extraBySize !== 'object') return { rows: [] };
  const rows: Array<{ fixation_id: string; size_id: string; extra: number }> = [];
  for (const [rawKey, rawVal] of Object.entries(extraBySize as Raw)) {
    const key = rawKey.trim().toLowerCase();
    if (!SIZE_KEYS.has(key)) {
      return { rows: [], error: `unknown fixation size key: ${rawKey}` };
    }
    const sizeId = sizeIdByCode.get(key);
    if (!sizeId) return { rows: [], error: `size key ${key} not resolved to sizes.id` };
    const extra = asInt(rawVal);
    if (extra === null || extra < 0) return { rows: [], error: `invalid extra for size ${key}` };
    rows.push({ fixation_id: fixationId, size_id: sizeId, extra });
  }
  return { rows };
}

export function transformVariant(row: Raw) {
  return {
    id: row.id as string,
    design_id: relationId(row.design),
    size_id: relationId(row.size),
    key: asString(row.key),
    price: asInt(row.price),
    old_price: asInt(row.old_price),
    in_stock: asBool(row.in_stock),
    quantity_discount_eligible: asBool(row.quantity_discount_eligible),
    status: asString(row.status) ?? 'published',
  };
}

export type ManagerNoteResult =
  | { kind: 'empty' }
  | { kind: 'loyalty'; loyalty: {
      loyalty_phone: string | null;
      loyalty_eligible: boolean;
      loyalty_discount_percent: number;
      loyalty_discount_amount: number;
      loyalty_phone_mismatch: boolean;
    } }
  | { kind: 'human'; text: string }
  | { kind: 'unknown_json' };

export function classifyManagerNote(raw: unknown): ManagerNoteResult {
  const text = asString(raw);
  if (!text) return { kind: 'empty' };
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return { kind: 'human', text };
  let parsed: Raw;
  try {
    parsed = JSON.parse(trimmed) as Raw;
  } catch {
    return { kind: 'human', text };
  }
  const keys = Object.keys(parsed);
  if (keys.length === 1 && keys[0] === 'loyalty' && parsed.loyalty && typeof parsed.loyalty === 'object') {
    const l = parsed.loyalty as Raw;
    return {
      kind: 'loyalty',
      loyalty: {
        loyalty_phone: asString(l.phone),
        loyalty_eligible: asBool(l.eligible),
        loyalty_discount_percent: asInt(l.discount_percent) ?? 0,
        loyalty_discount_amount: asInt(l.discount_amount) ?? 0,
        loyalty_phone_mismatch: asBool(l.phone_mismatch),
      },
    };
  }
  return { kind: 'unknown_json' };
}

export function transformOrder(row: Raw, customerId: string | null) {
  const note = classifyManagerNote(row.manager_note);
  const contact = asString(row.contact_method);
  const delivery = asString(row.delivery_method);
  const errors: string[] = [];
  if (!contact || !CONTACT_METHODS.has(contact)) errors.push(`unsupported contact_method`);
  if (!delivery || !DELIVERY_METHODS.has(delivery)) errors.push(`unsupported delivery_method`);

  const base = {
    id: row.id as string,
    order_number: asString(row.order_number),
    status: asString(row.status) ?? 'new',
    created_at: asString(row.created_at) ?? asString(row.date_created),
    checkout_attempt_id: null as string | null,
    customer_id: customerId,
    customer_name: asString(row.customer_name),
    customer_phone: asString(row.customer_phone),
    customer_email: asString(row.customer_email),
    customer_comment: asString(row.customer_comment),
    contact_method: contact,
    delivery_method: delivery,
    delivery_city_ref: asString(row.delivery_city_ref),
    delivery_city_name: asString(row.delivery_city_name),
    delivery_point_ref: asString(row.delivery_point_ref),
    delivery_point_number: asString(row.delivery_point_number),
    delivery_point_name: asString(row.delivery_point_name),
    delivery_point_address: asString(row.delivery_point_address),
    delivery_point_type: asString(row.delivery_point_type),
    delivery_street_ref: asString(row.delivery_street_ref),
    delivery_street_name: asString(row.delivery_street_name),
    delivery_street_type: asString(row.delivery_street_type),
    delivery_house: asString(row.delivery_house),
    delivery_apartment: asString(row.delivery_apartment),
    items_quantity: asInt(row.items_quantity) ?? 0,
    subtotal: asInt(row.subtotal) ?? 0,
    quantity_discount: asInt(row.quantity_discount) ?? 0,
    total: asInt(row.total) ?? 0,
    discount_tier_key: asString(row.discount_tier_key),
    manager_note: null as string | null,
    loyalty_phone: null as string | null,
    loyalty_eligible: false,
    loyalty_discount_percent: 0,
    loyalty_discount_amount: 0,
    loyalty_phone_mismatch: false,
    errors,
  };

  if (note.kind === 'loyalty') {
    Object.assign(base, note.loyalty);
  } else if (note.kind === 'human') {
    base.manager_note = note.text;
  } else if (note.kind === 'unknown_json') {
    base.errors.push('unknown manager_note JSON');
  }
  return base;
}

export function transformOrderItem(row: Raw) {
  return {
    id: isUuid(row.id) ? (row.id as string) : null,
    order_id: relationId(row.order),
    sort: asInt(row.sort) ?? 0,
    item_key: asString(row.item_key),
    title: asString(row.title),
    design_slug: asString(row.design_slug),
    design_label: asString(row.design_label),
    size_code: asString(row.size_code),
    size_label: asString(row.size_label),
    brand_slug: asString(row.brand_slug),
    brand_name: asString(row.brand_name),
    fixation_key: asString(row.fixation_key),
    fixation_label: asString(row.fixation_label),
    unit_price: asInt(row.unit_price) ?? 0,
    quantity: asInt(row.quantity) ?? 1,
    line_total: asInt(row.line_total) ?? 0,
    quantity_discount_eligible: asBool(row.quantity_discount_eligible),
  };
}

export function transformProductMedia(mediaSettings: Raw) {
  const rows: Array<{ slot: string; media_url: string | null; fileOnly: boolean }> = [];
  for (const slot of PRODUCT_MEDIA_SLOTS) {
    const { url, fileOnly } = mediaUrl((mediaSettings as Raw)[`${slot}_url`]);
    if (url) rows.push({ slot, media_url: url, fileOnly: false });
    else rows.push({ slot, media_url: null, fileOnly });
  }
  return rows;
}

export function transformNotification(
  base: Raw,
  telegramBot: Raw | null,
) {
  const botChats = asString(telegramBot?.chat_ids);
  const legacyChats = asString(base.telegram_chat_ids);
  return {
    id: isUuid(base.id) ? (base.id as string) : null,
    channel: asString(base.channel) ?? 'telegram',
    subject_template: asString(base.subject_template),
    message_template: asString(base.message_template),
    telegram_chat_ids: botChats || legacyChats || null,
    // never include bot_token or directus_user_ids
  };
}

export function assertNoSecrets(dto: unknown, secrets: string[]): string[] {
  const hits: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (typeof v === 'string') {
      for (const s of secrets) {
        if (s && v.includes(s)) hits.push(path);
      }
      return;
    }
    if (Array.isArray(v)) v.forEach((item, i) => walk(item, `${path}[${i}]`));
    else if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v as Raw)) walk(val, `${path}.${k}`);
    }
  };
  walk(dto, '$');
  return hits;
}
