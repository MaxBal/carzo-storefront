/**
 * Stage 2: read-only Directus → Supabase bulk structured-data migration.
 *
 * Usage:
 *   npx tsx scripts/migrate-directus-to-supabase.ts --dry-run
 *   npx tsx scripts/migrate-directus-to-supabase.ts --apply
 *   npx tsx scripts/migrate-directus-to-supabase.ts --verify
 *
 * Env:
 *   DIRECTUS_URL, DIRECTUS_ADMIN_TOKEN (or DIRECTUS_READ_TOKEN)  — GET only
 *   SUPABASE_URL, SUPABASE_SECRET_KEY                             — apply/verify
 *
 * Never prints PII/secrets. Fail-closed on commerce inconsistency.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { normalizeCustomerPhone } from '../lib/cart/customer-phone';
import {
  assertNoSecrets,
  asInt,
  asString,
  classifyManagerNote,
  expandFixationSizeExtras,
  mediaUrl,
  PRODUCT_MEDIA_SLOTS,
  relationId,
  stripDirectusFileIds,
  transformBrand,
  transformDesign,
  transformNotification,
  transformOrder,
  transformOrderItem,
  transformProductMedia,
  transformSize,
  transformVariant,
  type Raw,
} from './migrate-directus-to-supabase/transform';

type Mode = 'dry-run' | 'apply' | 'verify';

function parseMode(argv: string[]): Mode {
  if (argv.includes('--apply')) return 'apply';
  if (argv.includes('--verify')) return 'verify';
  return 'dry-run';
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

/** GET-only Directus client. Never POST/PATCH/PUT/DELETE. */
async function directusGet<T>(path: string): Promise<T> {
  const url = requireEnv('DIRECTUS_URL').replace(/\/$/, '');
  const token = process.env.DIRECTUS_ADMIN_TOKEN?.trim() || requireEnv('DIRECTUS_READ_TOKEN');
  const res = await fetch(`${url}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Directus GET ${path} → ${res.status} ${body.slice(0, 120)}`);
  }
  return res.json() as Promise<T>;
}

async function fetchAll(collection: string): Promise<Raw[]> {
  const payload = await directusGet<{ data: Raw | Raw[] }>(`/items/${collection}?limit=-1`);
  const data = payload.data;
  if (!data) return [];
  // Directus singletons return an object; normal collections return an array.
  if (Array.isArray(data)) return data;
  return [data];
}

async function fetchOne(collection: string): Promise<Raw | null> {
  const rows = await fetchAll(collection);
  return rows[0] ?? null;
}

function supabase(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

const SOURCE_COLLECTIONS = [
  'carzo_designs', 'carzo_sizes', 'carzo_brands', 'carzo_brand_pricing', 'carzo_variants',
  'carzo_fixations', 'carzo_size_shipping', 'carzo_discount_tiers', 'carzo_gallery_images',
  'carzo_content_sets', 'carzo_content_sections', 'carzo_faq_items', 'carzo_rich_sections',
  'carzo_rich_section_images', 'carzo_benefit_modals', 'carzo_logo_settings', 'carzo_media_settings',
  'carzo_site_settings', 'carzo_pages', 'carzo_page_blocks', 'carzo_orders', 'carzo_order_items',
  'carzo_notification_settings', 'carzo_telegram_bot_settings',
] as const;

async function upsert(
  db: SupabaseClient,
  table: string,
  rows: Raw[],
  onConflict: string,
) {
  if (!rows.length) return 0;
  const { error, count } = await db.from(table).upsert(rows, { onConflict, count: 'exact' });
  if (error) throw new Error(`upsert ${table}: ${error.message}`);
  return count ?? rows.length;
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  log(`mode=${mode}`);
  log('Directus access: GET only');

  // --- source snapshot ---
  const src: Record<string, Raw[]> = {};
  for (const c of SOURCE_COLLECTIONS) {
    src[c] = await fetchAll(c);
    log(`source ${c}: ${src[c].length}`);
  }
  const logoPlacements = await fetchAll('carzo_logo_placements');
  if (logoPlacements.length > 0) throw new Error('BLOCKED: carzo_logo_placements non-empty');
  log('carzo_logo_placements: 0 (not migrated)');

  // --- transforms ---
  const designs = src.carzo_designs.map((row) => {
    const t = transformDesign(row);
    const { _mediaFileOnly, ...dto } = t as typeof t & { _mediaFileOnly?: boolean };
    return dto;
  });
  const sizeShippingBySize = new Map<string, Raw>();
  for (const s of src.carzo_size_shipping) {
    const id = relationId(s.size) ?? asString(s.size);
    if (id) sizeShippingBySize.set(id, s);
  }
  const sizes = src.carzo_sizes.map((r) => transformSize(r, sizeShippingBySize.get(r.id as string) ?? null));
  const sizeIdByCode = new Map<string, string>();
  for (const s of sizes) {
    if (s.code) sizeIdByCode.set(s.code.toLowerCase(), s.id);
    if (s.slug) sizeIdByCode.set(s.slug.toLowerCase(), s.id);
  }

  const pricingByBrand = new Map<string, Raw[]>();
  for (const p of src.carzo_brand_pricing) {
    const id = relationId(p.brand) ?? asString(p.brand);
    if (!id) continue;
    const list = pricingByBrand.get(id) ?? [];
    list.push(p);
    pricingByBrand.set(id, list);
  }
  const brands: Raw[] = [];
  const brandErrors: string[] = [];
  for (const b of src.carzo_brands) {
    const list = pricingByBrand.get(b.id as string) ?? [];
    if (list.length > 1) {
      brandErrors.push(`duplicate brand_pricing for ${asString(b.slug)}`);
      continue;
    }
    const t = transformBrand(b, list[0] ?? null);
    if (t.errors.length) brandErrors.push(...t.errors);
    const { errors: _errors, ...dto } = t;
    brands.push(dto);
  }
  if (brandErrors.length) {
    for (const e of brandErrors) log(`BRAND_ERROR ${e}`);
    throw new Error('BLOCKED: brand pricing ambiguous');
  }

  const fixations: Raw[] = [];
  const fixationExtras: Raw[] = [];
  for (const f of src.carzo_fixations) {
    fixations.push({
      id: f.id,
      key: asString(f.key),
      label: asString(f.label),
      extra: asInt(f.extra) ?? 0,
      sort: asInt(f.sort) ?? 0,
      status: asString(f.status) ?? 'published',
    });
    const expanded = expandFixationSizeExtras(
      f.id as string,
      (f.extra_by_size ?? null) as Raw | null,
      sizeIdByCode,
    );
    if (expanded.error) throw new Error(`BLOCKED: ${expanded.error}`);
    fixationExtras.push(...expanded.rows);
  }

  const variants = src.carzo_variants.map(transformVariant);
  for (const v of variants) {
    if (!v.design_id || !v.size_id) throw new Error('BLOCKED: variant missing design/size');
    if (v.price === null || v.price < 0) throw new Error('BLOCKED: variant price invalid');
  }

  const discountTiers = src.carzo_discount_tiers.map((r) => ({
    id: r.id,
    key: asString(r.key),
    min_quantity: asInt(r.min_quantity) ?? 1,
    amount: asInt(r.amount) ?? 0,
    sort: asInt(r.sort) ?? 0,
    status: asString(r.status) ?? 'published',
  }));

  const galleryImages: Raw[] = [];
  for (const g of src.carzo_gallery_images) {
    const { url, fileOnly } = mediaUrl(g.external_url);
    if (!url) {
      if (fileOnly) throw new Error(`BLOCKED: gallery ${asString(g.key)} file-only media_url`);
      throw new Error(`BLOCKED: gallery ${asString(g.key)} missing media_url`);
    }
    galleryImages.push({
      id: g.id,
      key: asString(g.key),
      design_id: relationId(g.design),
      size_id: relationId(g.size),
      media_url: url,
      alt: asString(g.alt),
      sort: asInt(g.sort) ?? 0,
      status: asString(g.status) ?? 'published',
    });
  }

  const contentSets = src.carzo_content_sets.map((r) => ({
    id: r.id,
    key: asString(r.key),
    kind: asString(r.kind),
    design_id: relationId(r.design),
    size_id: relationId(r.size),
    size_group: asString(r.size_group),
    title: asString(r.title),
    content_tab_label: asString(r.content_tab_label),
    faq_tab_label: asString(r.faq_tab_label),
    info_box: stripDirectusFileIds(r.info_box ?? null),
    status: asString(r.status) ?? 'published',
  }));

  const contentSections = src.carzo_content_sections.map((r) => {
    const { url } = mediaUrl(r.external_url);
    return {
      id: r.id,
      key: asString(r.key),
      content_set_id: relationId(r.content_set),
      title: asString(r.title),
      text: asString(r.text),
      media_url: url,
      image_placeholder: asString(r.image_placeholder),
      sort: asInt(r.sort) ?? 0,
      status: asString(r.status) ?? 'published',
    };
  });

  const faqItems = src.carzo_faq_items.map((r) => ({
    id: r.id,
    key: asString(r.key),
    faq_group: asString(r.faq_group),
    question: asString(r.question),
    answer: asString(r.answer),
    sort: asInt(r.sort) ?? 0,
    status: asString(r.status) ?? 'published',
  }));

  const richSections = src.carzo_rich_sections.map((r) => ({
    id: r.id,
    key: asString(r.key),
    title: asString(r.title),
    subtitle: asString(r.subtitle),
    description: asString(r.description),
    additional_title: asString(r.additional_title),
    additional_text: asString(r.additional_text),
    additional_list: stripDirectusFileIds(r.additional_list ?? null),
    sort: asInt(r.sort) ?? 0,
    status: asString(r.status) ?? 'published',
  }));

  const richSectionImages = src.carzo_rich_section_images.map((r) => {
    const { url } = mediaUrl(r.external_url);
    return {
      id: r.id,
      key: asString(r.key),
      section_id: relationId(r.section),
      design_id: relationId(r.design),
      media_url: url,
      alt: asString(r.alt),
      status: asString(r.status) ?? 'published',
    };
  });

  const benefitModals = src.carzo_benefit_modals.map((r) => ({
    id: r.id,
    key: asString(r.key),
    title: asString(r.title),
    card_label: asString(r.card_label),
    subtitle: asString(r.subtitle),
    content: stripDirectusFileIds(r.content ?? null),
    sort: asInt(r.sort) ?? 0,
    status: asString(r.status) ?? 'published',
  }));

  const logoSettingsSrc = src.carzo_logo_settings[0] ?? null;
  const logoSettings = logoSettingsSrc
    ? [{
        id: logoSettingsSrc.id,
        title: asString(logoSettingsSrc.title),
        info_text: asString(logoSettingsSrc.info_text),
        specs: stripDirectusFileIds(logoSettingsSrc.specs ?? null),
        fallback_image_url: mediaUrl(logoSettingsSrc.fallback_image_url).url,
        placement_video_url: mediaUrl(logoSettingsSrc.logo_placement_video_url).url,
        status: asString(logoSettingsSrc.status) ?? 'published',
      }]
    : [];

  const mediaSettings = src.carzo_media_settings[0] ?? {};
  const productMedia = transformProductMedia(mediaSettings).filter((r) => r.media_url);
  const productMediaGaps = PRODUCT_MEDIA_SLOTS.length - productMedia.length;

  // site settings split
  const site = src.carzo_site_settings[0] ?? {};
  const siteFlag = mediaUrl(site.site_flag_url).url;
  const siteSettings = [{
    id: site.id,
    site_flag_url: siteFlag,
    checkout_payment_details: asString(site.checkout_payment_details),
    rich_signoff: asString(site.rich_signoff),
    design_info_text: asString(site.design_info_text),
    feature_magnetic_text: asString(site.feature_magnetic_text),
    feature_material_flag: asString(site.feature_material_flag),
    feature_material_text: asString(site.feature_material_text),
    status: asString(site.status) ?? 'published',
    // loyalty_discount_percent omitted → DB default 5
  }];

  const pick = (keys: string[]) =>
    Object.fromEntries(keys.map((k) => [k, stripDirectusFileIds(site[k] ?? null)]));

  const homepageSettings = [{
    id: site.id,
    ...pick([
      'homepage_hero_eyebrow', 'homepage_hero_title', 'homepage_hero_lead',
      'homepage_hero_material_tag', 'homepage_hero_products',
      'homepage_badges_eyebrow', 'homepage_badges_title', 'homepage_badges_description',
      'homepage_badges_size_label', 'homepage_badges_features', 'homepage_badges_video_url',
      'homepage_quality_eyebrow', 'homepage_quality_title', 'homepage_quality_stats',
      'homepage_logo_video_url',
    ]),
    status: asString(site.status) ?? 'published',
  }];

  const aboutSettings = [{
    id: site.id,
    ...pick([
      'about_hero_eyebrow', 'about_hero_title', 'about_hero_paragraph_1', 'about_hero_paragraph_2',
      'about_process_blocks',
      'about_principles_eyebrow', 'about_principles_title', 'about_principles_items',
      'about_development_title', 'about_development_text', 'about_statement_text',
    ]),
    about_process_image_1_url: mediaUrl(site.about_process_image_1_url).url,
    about_process_image_2_url: mediaUrl(site.about_process_image_2_url).url,
    about_process_image_3_url: mediaUrl(site.about_process_image_3_url).url,
    status: asString(site.status) ?? 'published',
  }];

  const reviewSettings = [{
    id: site.id,
    reviews_enabled: site.reviews_enabled ?? false,
    reviews_title: asString(site.reviews_title),
    reviews_description_line_1: asString(site.reviews_description_line_1),
    reviews_description_line_2: asString(site.reviews_description_line_2),
    reviews_cta_label: asString(site.reviews_cta_label),
    reviews_instagram_handle: asString(site.reviews_instagram_handle),
    reviews_items: stripDirectusFileIds(site.reviews_items ?? null),
    reviews_screenshots: stripDirectusFileIds(site.reviews_screenshots ?? null),
    reviews_modal_title: asString(site.reviews_modal_title),
    reviews_modal_description: asString(site.reviews_modal_description),
    status: asString(site.status) ?? 'published',
  }];

  const videoReviewSettings = [{
    id: site.id,
    ...pick([
      'video_reviews_enabled', 'video_reviews_title', 'video_reviews',
      'video_reviews_social_badge_url', 'video_reviews_social_handle',
      'video_reviews_social_text', 'video_reviews_social_verified',
      'video_reviews_stat_1_value', 'video_reviews_stat_1_text',
      'video_reviews_stat_2_value', 'video_reviews_stat_2_text',
      'video_reviews_stat_3_value', 'video_reviews_stat_3_text',
    ]),
    status: asString(site.status) ?? 'published',
  }];

  const carMatSettings = [{
    id: site.id,
    car_mat_designs: stripDirectusFileIds(site.car_mat_designs ?? null),
    car_mat_modal_title: asString(site.car_mat_modal_title),
    car_mat_modal_description: asString(site.car_mat_modal_description),
    car_mat_promo_video_url: mediaUrl(site.car_mat_promo_video_url).url,
    car_mat_promo_cover_url: mediaUrl(site.car_mat_promo_cover_url).url,
    status: asString(site.status) ?? 'published',
  }];

  const pages = src.carzo_pages.map((r) => {
    const { url } = mediaUrl(r.seo_image_url);
    return {
      id: r.id,
      key: asString(r.key),
      slug: asString(r.slug),
      title: asString(r.title),
      page_type: asString(r.page_type),
      status: asString(r.status) ?? 'published',
      no_index: r.no_index ?? false,
      show_header: r.show_header ?? true,
      show_footer: r.show_footer ?? true,
      seo_title: asString(r.seo_title),
      seo_description: asString(r.seo_description),
      seo_image_url: url,
    };
  });

  const pageBlocks = src.carzo_page_blocks.map((r) => {
    const { url } = mediaUrl(r.image_url);
    return {
      id: r.id,
      key: asString(r.key),
      page_id: relationId(r.page),
      block_type: asString(r.block_type),
      title: asString(r.title),
      eyebrow: asString(r.eyebrow),
      subtitle: asString(r.subtitle),
      body: asString(r.body),
      items: stripDirectusFileIds(r.items ?? null),
      image_url: url,
      image_alt: asString(r.image_alt),
      image_position: asString(r.image_position),
      theme: asString(r.theme),
      primary_label: asString(r.primary_label),
      primary_url: asString(r.primary_url),
      secondary_label: asString(r.secondary_label),
      secondary_url: asString(r.secondary_url),
      anchor: asString(r.anchor),
      sort: asInt(r.sort) ?? 0,
      status: asString(r.status) ?? 'published',
    };
  });

  const notifBase = src.carzo_notification_settings[0] ?? {};
  const telegramBot = src.carzo_telegram_bot_settings[0] ?? null;
  const notificationSettings = [transformNotification(notifBase, telegramBot)];

  // orders + customer link (lookup only, never mutate customers)
  let linked = 0, unlinked = 0, invalidForLink = 0;
  const orders: Raw[] = [];
  const orderNotes = { loyalty: 0, human: 0, empty: 0, unknown: 0 };

  let customerPhoneMap: Map<string, string> | null = null;
  if (mode !== 'dry-run') {
    // built at apply time from Supabase customers
  }

  for (const o of src.carzo_orders) {
    const note = classifyManagerNote(o.manager_note);
    if (note.kind === 'loyalty') orderNotes.loyalty += 1;
    else if (note.kind === 'human') orderNotes.human += 1;
    else if (note.kind === 'empty') orderNotes.empty += 1;
    else orderNotes.unknown += 1;
    if (note.kind === 'unknown_json') {
      throw new Error('BLOCKED: unknown manager_note JSON');
    }

    const rawPhone = asString(o.customer_phone);
    const norm = rawPhone ? normalizeCustomerPhone(rawPhone) : null;
    if (!rawPhone) invalidForLink += 1;
    else if (!norm) invalidForLink += 1;

    const t = transformOrder(o, null);
    if (t.errors.length) {
      for (const e of t.errors) log(`ORDER_ERROR ${e}`);
      throw new Error('BLOCKED: unsupported order enum');
    }
    orders.push(t);
  }

  const orderItems = src.carzo_order_items.map(transformOrderItem);
  for (const item of orderItems) {
    if (!item.order_id) throw new Error('BLOCKED: orphan order_item');
  }

  // secret / file-uuid leak checks on non-PII DTOs
  const nonPii = { designs, sizes, brands, productMedia, notificationSettings, pages, pageBlocks };
  const secretHits = assertNoSecrets(nonPii, [
    process.env.DIRECTUS_ADMIN_TOKEN ?? '',
    process.env.DIRECTUS_READ_TOKEN ?? '',
    process.env.TELEGRAM_BOT_TOKEN ?? '',
  ]);
  if (secretHits.length) throw new Error(`BLOCKED: secret leak at ${secretHits.join(',')}`);

  log(`manager_note: loyalty=${orderNotes.loyalty} human=${orderNotes.human} empty=${orderNotes.empty} unknown=${orderNotes.unknown}`);
  log(`product_media rows=${productMedia.length}/${PRODUCT_MEDIA_SLOTS.length} gaps=${productMediaGaps}`);
  log(`orders=${orders.length} items=${orderItems.length}`);

  if (mode === 'dry-run') {
    log('DRY-RUN PASS');
    return;
  }

  const db = supabase();

  if (mode === 'verify') {
    const { count: customers } = await db.from('customers').select('*', { count: 'exact', head: true });
    log(`customers=${customers}`);
    if (customers !== 5994) throw new Error('BLOCKED: customers changed');
    for (const table of ['designs', 'sizes', 'brands', 'orders', 'order_items']) {
      const { count } = await db.from(table).select('*', { count: 'exact', head: true });
      log(`target ${table}: ${count}`);
    }
    log('VERIFY done');
    return;
  }

  // apply — load order
  log('apply: loading…');
  await upsert(db, 'designs', designs, 'id');
  await upsert(db, 'sizes', sizes, 'id');
  await upsert(db, 'brands', brands, 'id');
  await upsert(db, 'fixations', fixations, 'id');
  await upsert(db, 'fixation_size_extras', fixationExtras, 'fixation_id,size_id');
  await upsert(db, 'discount_tiers', discountTiers, 'id');
  await upsert(db, 'variants', variants, 'id');
  await upsert(db, 'content_sets', contentSets, 'id');
  await upsert(db, 'content_sections', contentSections, 'id');
  await upsert(db, 'faq_items', faqItems, 'id');
  await upsert(db, 'rich_sections', richSections, 'id');
  await upsert(db, 'rich_section_images', richSectionImages, 'id');
  await upsert(db, 'gallery_images', galleryImages, 'id');
  await upsert(db, 'benefit_modals', benefitModals, 'id');
  await upsert(db, 'logo_settings', logoSettings, 'id');
  await upsert(db, 'product_media', productMedia.map((r) => ({ slot: r.slot, media_url: r.media_url })), 'slot');
  await upsert(db, 'site_settings', siteSettings, 'id');
  await upsert(db, 'homepage_settings', homepageSettings, 'id');
  await upsert(db, 'about_settings', aboutSettings, 'id');
  await upsert(db, 'review_settings', reviewSettings, 'id');
  await upsert(db, 'video_review_settings', videoReviewSettings, 'id');
  await upsert(db, 'car_mat_settings', carMatSettings, 'id');
  await upsert(db, 'pages', pages, 'id');
  await upsert(db, 'page_blocks', pageBlocks, 'id');
  await upsert(db, 'notification_settings', notificationSettings, 'id');

  // customer_id link via normalized phone
  const { data: custRows } = await db.from('customers').select('id, phone').limit(20000);
  customerPhoneMap = new Map();
  for (const c of custRows ?? []) {
    if (c.phone) customerPhoneMap.set(c.phone, c.id as string);
  }
  for (const o of orders) {
    const norm = o.customer_phone ? normalizeCustomerPhone(o.customer_phone) : null;
    const id = norm ? customerPhoneMap.get(norm) : undefined;
    if (id) {
      o.customer_id = id;
      linked += 1;
    } else {
      unlinked += 1;
    }
    delete (o as Raw).errors;
  }

  await upsert(db, 'orders', orders, 'id');
  await upsert(db, 'order_items', orderItems.filter((i) => i.id), 'id');

  log(`customer_id linked=${linked} unlinked=${unlinked} invalid_for_link=${invalidForLink}`);
  log('APPLY done — run --verify');
}

main().catch((err) => {
  log(`ERROR ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
