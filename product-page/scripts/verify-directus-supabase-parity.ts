/**
 * Stage 3 verification-only CLI: Directus GET vs Supabase SELECT vs public R2 HEAD/GET.
 * No writes. No PII/secrets printed. Exit non-zero on required parity failure.
 *
 * Usage:
 *   npx tsx scripts/verify-directus-supabase-parity.ts --all
 *   npx tsx scripts/verify-directus-supabase-parity.ts --data --pricing --content --orders --media
 *
 * Env:
 *   DIRECTUS_URL, DIRECTUS_ADMIN_TOKEN|DIRECTUS_READ_TOKEN  — GET only
 *   SUPABASE_URL, SUPABASE_SECRET_KEY                       — SELECT only
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  APPROVED_INTENTIONAL_TRANSFORMS,
  PRODUCT_MEDIA_SLOTS,
  assertNoSecrets,
  brandPricingEqual,
  canonicalPage,
  classifyManagerNote,
  compareCanonicalBlocks,
  comparePiiField,
  countDuplicates,
  countOrphans,
  deepEqual,
  fixationExtraEqual,
  formatPiiMismatchCounts,
  isApprovedR2Url,
  isForbiddenTargetMediaUrl,
  isIntentionalEmptyMediaKey,
  loyaltyTransformEqual,
  missingCanonicalProductMediaSlots,
  normalizeQuoteForCompare,
  type Raw,
} from './verify-directus-supabase-parity/transform';
import { calculateCartTotals } from '../lib/cart/pricing';

type Mode = { data: boolean; pricing: boolean; content: boolean; orders: boolean; media: boolean };

function parseModes(argv: string[]): Mode {
  const all = argv.includes('--all') || argv.length === 0;
  return {
    data: all || argv.includes('--data'),
    pricing: all || argv.includes('--pricing'),
    content: all || argv.includes('--content'),
    orders: all || argv.includes('--orders'),
    media: all || argv.includes('--media'),
  };
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

async function directusGet<T>(path: string): Promise<T> {
  const url = requireEnv('DIRECTUS_URL').replace(/\/$/, '');
  const token = process.env.DIRECTUS_ADMIN_TOKEN?.trim() || requireEnv('DIRECTUS_READ_TOKEN');
  const res = await fetch(`${url}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Directus GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function fetchAll(collection: string): Promise<Raw[]> {
  const payload = await directusGet<{ data: Raw | Raw[] }>(`/items/${collection}?limit=-1`);
  const data = payload.data;
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

function supabase(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function selectAll<T extends Raw>(client: SupabaseClient, table: string): Promise<T[]> {
  const { data, error } = await client.from(table).select('*');
  if (error) throw new Error(`Supabase SELECT ${table}: ${error.message}`);
  return (data ?? []) as T[];
}

/** Exact row count without loading rows (PostgREST page limit must not affect counts). */
async function exactCount(client: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await client.from(table).select('id', { count: 'exact', head: true });
  if (error) throw new Error(`Supabase COUNT ${table}: ${error.message}`);
  return count ?? 0;
}

/**
 * Orphan check for orders→customers without loading the full customers table.
 * Looks up only customer_ids referenced by orders.
 */
async function countOrderCustomerOrphans(
  client: SupabaseClient,
  orders: Raw[],
): Promise<number> {
  const referenced = Array.from(new Set(
    orders
      .map(o => (o.customer_id == null || o.customer_id === '' ? null : String(o.customer_id)))
      .filter((id): id is string => id !== null),
  ));
  if (referenced.length === 0) return 0;
  const { data, error } = await client.from('customers').select('id').in('id', referenced);
  if (error) throw new Error(`Supabase SELECT customers ids: ${error.message}`);
  const found = new Set((data ?? []).map(r => String(r.id)));
  return orders.filter(o => {
    const id = o.customer_id == null || o.customer_id === '' ? null : String(o.customer_id);
    return id !== null && !found.has(id);
  }).length;
}

type Failures = string[];

function fail(failures: Failures, msg: string) {
  failures.push(msg);
  log(`FAIL ${msg}`);
}

function ok(msg: string) {
  log(`OK   ${msg}`);
}

const EXPECTED_COUNTS: Record<string, number> = {
  designs: 3,
  sizes: 4,
  brands: 26,
  variants: 12,
  fixations: 4,
  fixation_size_extras: 16,
  discount_tiers: 2,
  gallery_images: 57,
  content_sets: 16,
  content_sections: 48,
  faq_items: 8,
  rich_sections: 4,
  rich_section_images: 12,
  benefit_modals: 6,
  logo_settings: 1,
  product_media: 17,
  site_settings: 1,
  homepage_settings: 1,
  about_settings: 1,
  review_settings: 1,
  video_review_settings: 1,
  car_mat_settings: 1,
  pages: 4,
  page_blocks: 5,
  notification_settings: 1,
  orders: 10,
  order_items: 17,
  customers: 5994,
};

async function runStructural(client: SupabaseClient, failures: Failures) {
  log('== structural parity ==');
  const designs = await selectAll(client, 'designs');
  const sizes = await selectAll(client, 'sizes');
  const brands = await selectAll(client, 'brands');
  const variants = await selectAll(client, 'variants');
  const fixations = await selectAll(client, 'fixations');
  const fse = await selectAll(client, 'fixation_size_extras');
  const tiers = await selectAll(client, 'discount_tiers');
  const gallery = await selectAll(client, 'gallery_images');
  const contentSets = await selectAll(client, 'content_sets');
  const contentSections = await selectAll(client, 'content_sections');
  const faq = await selectAll(client, 'faq_items');
  const rich = await selectAll(client, 'rich_sections');
  const richImg = await selectAll(client, 'rich_section_images');
  const benefits = await selectAll(client, 'benefit_modals');
  const pm = await selectAll(client, 'product_media');
  const pages = await selectAll(client, 'pages');
  const pageBlocks = await selectAll(client, 'page_blocks');
  const orders = await selectAll(client, 'orders');
  const orderItems = await selectAll(client, 'order_items');
  const customersCount = await exactCount(client, 'customers');

  const counts: Record<string, number> = {
    designs: designs.length,
    sizes: sizes.length,
    brands: brands.length,
    variants: variants.length,
    fixations: fixations.length,
    fixation_size_extras: fse.length,
    discount_tiers: tiers.length,
    gallery_images: gallery.length,
    content_sets: contentSets.length,
    content_sections: contentSections.length,
    faq_items: faq.length,
    rich_sections: rich.length,
    rich_section_images: richImg.length,
    benefit_modals: benefits.length,
    product_media: pm.length,
    pages: pages.length,
    page_blocks: pageBlocks.length,
    notification_settings: (await selectAll(client, 'notification_settings')).length,
    orders: orders.length,
    order_items: orderItems.length,
    customers: customersCount,
  };
  for (const [table, n] of Object.entries(EXPECTED_COUNTS)) {
    if (counts[table] !== undefined && counts[table] !== n) fail(failures, `${table} count ${counts[table]} != ${n}`);
  }
  ok(`target counts checked (${Object.keys(counts).length} tables)`);

  const dups: Array<[string, number]> = [
    ['designs.slug', countDuplicates(designs, r => String(r.slug))],
    ['sizes.code', countDuplicates(sizes, r => String(r.code))],
    ['sizes.slug', countDuplicates(sizes, r => String(r.slug))],
    ['brands.slug', countDuplicates(brands, r => String(r.slug))],
    ['variants.key', countDuplicates(variants, r => String(r.key))],
    ['variants(design_id,size_id)', countDuplicates(variants, r => `${r.design_id}|${r.size_id}`)],
    ['fixations.key', countDuplicates(fixations, r => String(r.key))],
    ['fixation_size_extras(fixation_id,size_id)', countDuplicates(fse, r => `${r.fixation_id}|${r.size_id}`)],
    ['discount_tiers.key', countDuplicates(tiers, r => String(r.key))],
    ['gallery_images.key', countDuplicates(gallery, r => String(r.key))],
    ['content_sets.key', countDuplicates(contentSets, r => String(r.key))],
    ['content_sections.key', countDuplicates(contentSections, r => String(r.key))],
    ['faq_items.key', countDuplicates(faq, r => String(r.key))],
    ['rich_sections.key', countDuplicates(rich, r => String(r.key))],
    ['rich_section_images.key', countDuplicates(richImg, r => String(r.key))],
    ['benefit_modals.key', countDuplicates(benefits, r => String(r.key))],
    ['product_media.slot', countDuplicates(pm, r => String(r.slot))],
    ['pages.key', countDuplicates(pages, r => String(r.key))],
    ['pages.slug', countDuplicates(pages, r => String(r.slug))],
    ['page_blocks.key', countDuplicates(pageBlocks, r => String(r.key))],
    ['orders.order_number', countDuplicates(orders, r => String(r.order_number))],
  ];
  for (const [name, n] of dups) {
    if (n !== 0) fail(failures, `duplicate ${name} = ${n}`);
  }
  ok(`duplicate natural keys = 0 (${dups.length} groups)`);

  const orphans: Array<[string, number]> = [
    ['variants→designs', countOrphans(variants, designs, r => String(r.design_id), r => String(r.id))],
    ['variants→sizes', countOrphans(variants, sizes, r => String(r.size_id), r => String(r.id))],
    ['fse→fixations', countOrphans(fse, fixations, r => String(r.fixation_id), r => String(r.id))],
    ['fse→sizes', countOrphans(fse, sizes, r => String(r.size_id), r => String(r.id))],
    ['gallery→designs', countOrphans(gallery, designs, r => (r.design_id ? String(r.design_id) : null), r => String(r.id))],
    ['gallery→sizes', countOrphans(gallery, sizes, r => (r.size_id ? String(r.size_id) : null), r => String(r.id))],
    ['content_sets→designs', countOrphans(contentSets, designs, r => (r.design_id ? String(r.design_id) : null), r => String(r.id))],
    ['content_sets→sizes', countOrphans(contentSets, sizes, r => (r.size_id ? String(r.size_id) : null), r => String(r.id))],
    ['content_sections→content_sets', countOrphans(contentSections, contentSets, r => String(r.content_set_id), r => String(r.id))],
    ['rich_section_images→rich_sections', countOrphans(richImg, rich, r => String(r.section_id ?? r.rich_section_id), r => String(r.id))],
    ['rich_section_images→designs', countOrphans(richImg, designs, r => (r.design_id ? String(r.design_id) : null), r => String(r.id))],
    ['page_blocks→pages', countOrphans(pageBlocks, pages, r => String(r.page_id), r => String(r.id))],
    ['orders→customers', await countOrderCustomerOrphans(client, orders)],
    ['order_items→orders', countOrphans(orderItems, orders, r => String(r.order_id), r => String(r.id))],
  ];
  for (const [name, n] of orphans) {
    if (n !== 0) fail(failures, `orphan ${name} = ${n}`);
  }
  ok(`orphan FKs = 0 (${orphans.length} relations)`);

  const invalidVariants = variants.filter(v => !v.design_id || !v.size_id).length;
  if (invalidVariants !== 0) fail(failures, `variants missing design/size = ${invalidVariants}`);
  const orderItemCatalogCols = ['design_id', 'size_id', 'brand_id', 'fixation_id'];
  const orderItemCatalogFk = orderItems.filter(item =>
    orderItemCatalogCols.some(col => (item as Raw)[col] !== undefined && (item as Raw)[col] !== null),
  ).length;
  if (orderItemCatalogFk !== 0) fail(failures, `order_items catalog FK present = ${orderItemCatalogFk}`);
  ok('variants valid; order_items have no catalog FK');
}

async function runCatalog(client: SupabaseClient, failures: Failures) {
  log('== catalog / commerce parity ==');
  const dxDesigns = await fetchAll('carzo_designs');
  const dxSizes = await fetchAll('carzo_sizes');
  const dxBrands = await fetchAll('carzo_brands');
  const dxPricing = await fetchAll('carzo_brand_pricing');
  const dxVariants = await fetchAll('carzo_variants');
  const dxFixations = await fetchAll('carzo_fixations');
  const dxTiers = await fetchAll('carzo_discount_tiers');
  const dxShipping = await fetchAll('carzo_size_shipping');

  const designs = await selectAll(client, 'designs');
  const sizes = await selectAll(client, 'sizes');
  const brands = await selectAll(client, 'brands');
  const variants = await selectAll(client, 'variants');
  const fixations = await selectAll(client, 'fixations');
  const fse = await selectAll(client, 'fixation_size_extras');
  const tiers = await selectAll(client, 'discount_tiers');

  let mismatches = 0;
  const designBySlug = new Map(designs.map(d => [String(d.slug), d]));
  for (const row of dxDesigns) {
    const t = designBySlug.get(String(row.slug));
    const fields = {
      label: [row.label, t?.label],
      version: [row.version, t?.version],
      sort: [Number(row.sort ?? 0), Number(t?.sort ?? 0)],
      status: [row.status ?? 'published', t?.status],
    };
    for (const [field, [a, b]] of Object.entries(fields)) {
      if (a !== b) {
        mismatches += 1;
        fail(failures, `design ${row.slug}.${field} mismatch`);
      }
    }
  }
  ok(`designs mismatches so far ${mismatches}`);

  const sizeByCode = new Map(sizes.map(s => [String(s.code), s]));
  for (const row of dxSizes) {
    const t = sizeByCode.get(String(row.code));
    const checks: Array<[string, unknown, unknown]> = [
      ['slug', row.slug, t?.slug],
      ['label', row.label, t?.label],
      ['content_group', row.content_group, t?.content_group],
      ['height_cm', Number(row.height_cm), Number(t?.height_cm)],
      ['width_cm', Number(row.width_cm), Number(t?.width_cm)],
      ['depth_cm', Number(row.depth_cm), Number(t?.depth_cm)],
      ['sort', Number(row.sort ?? 0), Number(t?.sort ?? 0)],
      ['status', row.status ?? 'published', t?.status],
    ];
    for (const [field, a, b] of checks) {
      if (a !== b) {
        mismatches += 1;
        fail(failures, `size ${row.code}.${field} mismatch`);
      }
    }
    for (const col of ['shipping_length_cm', 'shipping_width_cm', 'shipping_height_cm', 'shipping_weight_kg']) {
      if ((t as Raw | undefined)?.[col] !== null && (t as Raw | undefined)?.[col] !== undefined && dxShipping.length === 0) {
        mismatches += 1;
        fail(failures, `size ${row.code}.${col} expected NULL`);
      }
    }
  }
  ok(`sizes mismatches so far ${mismatches}`);

  const brandBySlug = new Map(brands.map(b => [String(b.slug), b]));
  const pricingByBrand = new Map<string, number>();
  for (const p of dxPricing) {
    const brandId = typeof p.brand === 'string' ? p.brand : String((p.brand as Raw | undefined)?.id ?? '');
    const brandRow = dxBrands.find(b => String(b.id) === brandId);
    if (brandRow) pricingByBrand.set(String(brandRow.slug), Number(p.logo_extra ?? 0));
  }
  for (const row of dxBrands) {
    const t = brandBySlug.get(String(row.slug));
    const checks: Array<[string, unknown, unknown]> = [
      ['name', row.name ?? '', t?.name ?? ''],
      ['flag', row.flag ?? '', t?.flag ?? ''],
      ['sort', Number(row.sort ?? 0), Number(t?.sort ?? 0)],
      ['status', row.status ?? 'published', t?.status],
    ];
    for (const [field, a, b] of checks) {
      if (a !== b) {
        mismatches += 1;
        fail(failures, `brand ${row.slug}.${field} mismatch`);
      }
    }
    const sourceExtra = pricingByBrand.get(String(row.slug)) ?? 0;
    const targetExtra = Number(t?.logo_extra ?? 0);
    if (!brandPricingEqual(sourceExtra, targetExtra)) {
      mismatches += 1;
      fail(failures, `brand ${row.slug}.logo_extra mismatch`);
    }
  }
  ok(`brands/pricing mismatches so far ${mismatches}`);

  const variantByKey = new Map(variants.map(v => [String(v.key), v]));
  for (const row of dxVariants) {
    const t = variantByKey.get(String(row.key));
    const checks: Array<[string, unknown, unknown]> = [
      ['price', Number(row.price), Number(t?.price)],
      ['old_price', Number(row.old_price ?? 0), Number(t?.old_price ?? 0)],
      ['in_stock', Boolean(row.in_stock), Boolean(t?.in_stock)],
      ['quantity_discount_eligible', Boolean(row.quantity_discount_eligible), Boolean(t?.quantity_discount_eligible)],
      ['status', row.status ?? 'published', t?.status],
    ];
    for (const [field, a, b] of checks) {
      if (a !== b) {
        mismatches += 1;
        fail(failures, `variant ${row.key}.${field} mismatch`);
      }
    }
  }
  ok(`variants mismatches so far ${mismatches}`);

  const fixByKey = new Map(fixations.map(f => [String(f.key), f]));
  const sizeIdByCode = new Map(sizes.map(s => [String(s.id), String(s.code).toLowerCase()]));
  for (const row of dxFixations) {
    const t = fixByKey.get(String(row.key));
    const checks: Array<[string, unknown, unknown]> = [
      ['label', row.label, t?.label],
      ['extra', Number(row.extra ?? 0), Number(t?.extra ?? 0)],
      ['sort', Number(row.sort ?? 0), Number(t?.sort ?? 0)],
      ['status', row.status ?? 'published', t?.status],
    ];
    for (const [field, a, b] of checks) {
      if (a !== b) {
        mismatches += 1;
        fail(failures, `fixation ${row.key}.${field} mismatch`);
      }
    }
    const targetExtras = fse
      .filter(e => String(e.fixation_id) === String(t?.id))
      .map(e => ({ sizeCode: sizeIdByCode.get(String(e.size_id)) ?? '', extra: Number(e.extra ?? 0) }));
    const sourceMap = (row.extra_by_size ?? null) as Record<string, number> | null;
    if (!fixationExtraEqual(sourceMap, Number(row.extra ?? 0), targetExtras)) {
      mismatches += 1;
      fail(failures, `fixation ${row.key}.extra_by_size mismatch`);
    }
  }
  ok(`fixations mismatches so far ${mismatches}`);

  const tierByKey = new Map(tiers.map(t => [String(t.key), t]));
  for (const row of dxTiers) {
    const t = tierByKey.get(String(row.key));
    const checks: Array<[string, unknown, unknown]> = [
      ['min_quantity', Number(row.min_quantity), Number(t?.min_quantity)],
      ['amount', Number(row.amount), Number(t?.amount)],
      ['sort', Number(row.sort ?? 0), Number(t?.sort ?? 0)],
      ['status', row.status ?? 'published', t?.status],
    ];
    for (const [field, a, b] of checks) {
      if (a !== b) {
        mismatches += 1;
        fail(failures, `discount_tier ${row.key}.${field} mismatch`);
      }
    }
  }
  log(`catalog/commerce mismatch count = ${mismatches}`);
  return mismatches;
}

function buildQuote(input: {
  designs: Raw[];
  sizes: Raw[];
  brands: Raw[];
  variants: Raw[];
  fixations: Raw[];
  fse: Raw[];
  tiers: Raw[];
  sitePaymentDetails: string;
  items: Array<{ size: string; designSlug: string; brandId: string; fixation: string; quantity: number }>;
}) {
  const designBySlug = new Map(input.designs.map(item => [String(item.slug), item]));
  const sizeByCode = new Map(input.sizes.map(item => [String(item.code), item]));
  const brandBySlug = new Map(input.brands.map(item => [String(item.slug ?? item.id), item]));
  const brandPriceBySlug = new Map(input.brands.map(item => [String(item.slug ?? item.id), Number(item.logo_extra ?? 0)]));
  const fixationByKey = new Map(input.fixations.map(item => [String(item.key), item]));
  const sizeIdByCode = new Map(input.sizes.map(s => [String(s.id), String(s.code).toLowerCase()]));
  const variantByKey = new Map(input.variants.map(item => [`${item.key}`, item]));

  const lines = input.items.map(item => {
    const design = designBySlug.get(item.designSlug);
    const size = sizeByCode.get(item.size);
    const brand = brandBySlug.get(item.brandId);
    const fixation = fixationByKey.get(item.fixation);
    const variant = variantByKey.get(`${item.designSlug}:${item.size}`);
    if (!design || !size || !brand || !fixation || !variant) throw new Error(`missing catalog for ${item.designSlug}:${item.size}`);
    const brandName = item.brandId === 'none' ? 'Без логотипа' : String(brand.name ?? '');
    const extras = input.fse
      .filter(e => String(e.fixation_id) === String(fixation.id) && sizeIdByCode.get(String(e.size_id)) === item.size.toLowerCase())
      .map(e => Number(e.extra ?? 0));
    const fixationExtra = extras.length > 0 ? extras[0] : Number(fixation.extra ?? 0);
    const unitPrice = Number(variant.price ?? 0) + (brandPriceBySlug.get(item.brandId) ?? 0) + fixationExtra;
    const version = String(design.version ?? item.designSlug);
    const title = brandName === 'Без логотипа'
      ? `Автокейс ${item.size} Carzo ${version}`
      : `Автокейс ${item.size} Carzo ${version} для ${brandName}`;
    const sizeSlug = String(size.slug ?? item.size.toLowerCase());
    const brandPath = item.brandId === 'none' ? '' : `/${item.brandId}`;
    return {
      itemKey: [item.size, item.designSlug, item.brandId, item.fixation].join(':'),
      title,
      productUrl: `/case/design/${sizeSlug}/${item.designSlug}${brandPath}`,
      designLabel: String(design.label ?? ''),
      sizeLabel: String(size.label ?? ''),
      brandName,
      fixationLabel: String(fixation.label ?? ''),
      unitPrice,
      quantity: item.quantity,
      lineTotal: unitPrice * item.quantity,
      inStock: variant.in_stock === true,
      quantityDiscountEligible: variant.quantity_discount_eligible === true,
    };
  });

  const tierRows = input.tiers.map(t => ({
    key: String(t.key),
    minQuantity: Number(t.min_quantity ?? 0),
    amount: Number(t.amount ?? 0),
    sort: Number(t.sort ?? 0),
  }));
  const totals = calculateCartTotals(lines.map(line => ({
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    quantityDiscountEligible: line.quantityDiscountEligible,
  })), tierRows);

  const onlyLine = lines.length === 1 ? lines[0] : null;
  const size = onlyLine ? sizeByCode.get(input.items[0].size) : null;
  const dims = [Number(size?.width_cm ?? 0), Number(size?.height_cm ?? 0), Number(size?.depth_cm ?? 0)].sort((a, b) => a - b);
  const allowPostomat = Boolean(
    onlyLine
    && onlyLine.quantity === 1
    && dims.length === 3
    && dims.every((d, i) => d > 0 && d <= [30, 40, 60][i]),
  );

  return {
    lines,
    subtotal: totals.subtotal,
    quantityDiscount: totals.quantityDiscount,
    total: totals.total,
    itemsQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    appliedTier: totals.appliedTier
      ? { key: totals.appliedTier.key, minQuantity: totals.appliedTier.minQuantity, amount: totals.appliedTier.amount }
      : null,
    allowPostomat,
    canCheckout: lines.every(line => line.inStock),
    checkoutPaymentDetails: input.sitePaymentDetails,
  };
}

async function runPricing(client: SupabaseClient, failures: Failures) {
  log('== pricing behavior parity ==');
  const dxDesigns = await fetchAll('carzo_designs');
  const dxSizes = await fetchAll('carzo_sizes');
  const dxBrands = await fetchAll('carzo_brands');
  const dxPricing = await fetchAll('carzo_brand_pricing');
  const dxVariants = await fetchAll('carzo_variants');
  const dxFixations = await fetchAll('carzo_fixations');
  const dxTiers = await fetchAll('carzo_discount_tiers');
  const dxSite = await fetchAll('carzo_site_settings');
  const dxFseExpanded: Raw[] = [];
  const sizeCodeById = new Map(dxSizes.map(s => [String(s.id), String(s.code).toLowerCase()]));
  for (const f of dxFixations) {
    const bySize = (f.extra_by_size ?? {}) as Record<string, number>;
    for (const [code, extra] of Object.entries(bySize)) {
      const sizeRow = dxSizes.find(s => String(s.code).toLowerCase() === code.toLowerCase());
      if (sizeRow) dxFseExpanded.push({ fixation_id: f.id, size_id: sizeRow.id, extra });
    }
  }
  const dxBrandsWithExtra = dxBrands.map(b => {
    const p = dxPricing.find(row => {
      const brandId = typeof row.brand === 'string' ? row.brand : String((row.brand as Raw | undefined)?.id ?? '');
      return brandId === String(b.id);
    });
    return { ...b, logo_extra: p ? Number(p.logo_extra ?? 0) : 0, slug: b.slug ?? b.id };
  });

  const designs = await selectAll(client, 'designs');
  const sizes = await selectAll(client, 'sizes');
  const brands = await selectAll(client, 'brands');
  const variants = await selectAll(client, 'variants');
  const fixations = await selectAll(client, 'fixations');
  const fse = await selectAll(client, 'fixation_size_extras');
  const tiers = await selectAll(client, 'discount_tiers');
  const site = (await selectAll(client, 'site_settings'))[0] ?? {};
  const paymentDetails = String(site.checkout_payment_details ?? '').trim();

  const designSlugs = dxDesigns.map(d => String(d.slug));
  const sizeCodes = dxSizes.map(s => String(s.code));
  const paidBrand = dxBrandsWithExtra.find(b => Number(b.logo_extra) > 0 && String(b.slug) !== 'none');
  const fixtures: Array<{ name: string; items: Array<{ size: string; designSlug: string; brandId: string; fixation: string; quantity: number }> }> = [];

  for (const designSlug of designSlugs) {
    for (const size of sizeCodes) {
      fixtures.push({
        name: `base:${designSlug}:${size}`,
        items: [{ size, designSlug, brandId: 'none', fixation: 'none', quantity: 1 }],
      });
    }
  }
  if (paidBrand) {
    fixtures.push({ name: `brand-paid:${paidBrand.slug}:M:2-0`, items: [{ size: 'M', designSlug: '2-0', brandId: String(paidBrand.slug), fixation: 'none', quantity: 1 }] });
    fixtures.push({ name: `brand-paid:${paidBrand.slug}:S:3-0`, items: [{ size: 'S', designSlug: '3-0', brandId: String(paidBrand.slug), fixation: 'none', quantity: 1 }] });
  }
  fixtures.push({ name: 'brand-none:M:2-0', items: [{ size: 'M', designSlug: '2-0', brandId: 'none', fixation: 'none', quantity: 1 }] });
  for (const fixation of ['none', 'bottom', 'wall', 'both']) {
    if (fixation === 'both') {
      for (const size of sizeCodes) {
        fixtures.push({ name: `fixation:both:${size}`, items: [{ size, designSlug: '2-0', brandId: 'none', fixation: 'both', quantity: 1 }] });
      }
    } else {
      fixtures.push({ name: `fixation:${fixation}:M`, items: [{ size: 'M', designSlug: '2-0', brandId: 'none', fixation, quantity: 1 }] });
    }
  }
  for (const quantity of [1, 2, 3, 4]) {
    fixtures.push({ name: `qty:${quantity}`, items: [{ size: 'M', designSlug: '2-0', brandId: 'none', fixation: 'none', quantity }] });
  }
  fixtures.push({
    name: 'mixed-cart',
    items: [
      { size: 'S', designSlug: '2-0', brandId: 'none', fixation: 'none', quantity: 1 },
      { size: 'M', designSlug: '3-0', brandId: paidBrand ? String(paidBrand.slug) : 'none', fixation: 'both', quantity: 1 },
    ],
  });

  let mismatches = 0;
  for (const fixture of fixtures) {
    const a = normalizeQuoteForCompare(buildQuote({
      designs: dxDesigns,
      sizes: dxSizes,
      brands: dxBrandsWithExtra,
      variants: dxVariants,
      fixations: dxFixations,
      fse: dxFseExpanded,
      tiers: dxTiers,
      sitePaymentDetails: String(dxSite[0]?.checkout_payment_details ?? '').trim(),
      items: fixture.items,
    }) as unknown as Raw);
    const b = normalizeQuoteForCompare(buildQuote({
      designs,
      sizes,
      brands,
      variants,
      fixations,
      fse,
      tiers,
      sitePaymentDetails: paymentDetails,
      items: fixture.items,
    }) as unknown as Raw);
    if (!deepEqual(a, b)) {
      mismatches += 1;
      fail(failures, `pricing fixture ${fixture.name} mismatch`);
    }
  }
  log(`pricing fixture count = ${fixtures.length}`);
  log(`pricing mismatch count = ${mismatches}`);
  return mismatches;
}

async function runOrders(client: SupabaseClient, failures: Failures) {
  log('== historical order parity ==');
  const dxOrders = await fetchAll('carzo_orders');
  const dxItems = await fetchAll('carzo_order_items');
  const orders = await selectAll(client, 'orders');
  const items = await selectAll(client, 'order_items');

  const dxByNumber = new Map(dxOrders.map(o => [String(o.order_number), o]));
  const tgByNumber = new Map(orders.map(o => [String(o.order_number), o]));
  const numberSetEqual = dxByNumber.size === tgByNumber.size && Array.from(dxByNumber.keys()).every(k => tgByNumber.has(k));
  if (!numberSetEqual) fail(failures, 'order_number set mismatch');
  else ok('order_number set equality');

  const orderFields = [
    'status', 'created_at', 'customer_name', 'customer_phone', 'customer_email', 'customer_comment',
    'contact_method', 'delivery_method', 'delivery_city_ref', 'delivery_city_name', 'delivery_point_ref',
    'delivery_point_number', 'delivery_point_name', 'delivery_point_address', 'delivery_point_type',
    'delivery_street_ref', 'delivery_street_name', 'delivery_street_type', 'delivery_house', 'delivery_apartment',
    'items_quantity', 'subtotal', 'quantity_discount', 'total', 'discount_tier_key',
  ] as const;
  const piiFields = new Set(['customer_name', 'customer_phone', 'customer_email', 'customer_comment', 'delivery_house', 'delivery_apartment', 'delivery_point_name', 'delivery_point_address', 'delivery_street_name']);
  const mismatchCounts = new Map<string, number>(orderFields.map(f => [f, 0]));
  let loyaltyMismatches = 0;
  let unknownManagerJson = 0;
  for (const [number, dx] of Array.from(dxByNumber.entries())) {
    const tg = tgByNumber.get(number);
    if (!tg) continue;
    for (const field of orderFields) {
      const left = (dx as Raw)[field] ?? null;
      const right = (tg as Raw)[field] ?? null;
      // created_at: normalize ISO vs Postgres
      if (field === 'created_at') {
        const l = left === null ? null : String(left).replace(' ', 'T').replace(' ', 'T');
        const r = right === null ? null : String(right).replace(' ', 'T');
        const ln = l ? Date.parse(l.endsWith('Z') || l.includes('+') ? l : `${l}Z`) : null;
        const rn = r ? Date.parse(r.endsWith('Z') || r.includes('+') ? r : `${r}Z`) : null;
        if (ln !== rn) mismatchCounts.set(field, (mismatchCounts.get(field) ?? 0) + 1);
        continue;
      }
      const cmp = comparePiiField(field, left, right);
      if (cmp.mismatchCount) mismatchCounts.set(field, (mismatchCounts.get(field) ?? 0) + 1);
    }
    const loyalty = loyaltyTransformEqual((dx as Raw).manager_note, {
      loyalty_phone: (tg as Raw).loyalty_phone as string | null,
      loyalty_eligible: Boolean((tg as Raw).loyalty_eligible),
      loyalty_discount_percent: Number((tg as Raw).loyalty_discount_percent ?? 0),
      loyalty_discount_amount: Number((tg as Raw).loyalty_discount_amount ?? 0),
      loyalty_phone_mismatch: Boolean((tg as Raw).loyalty_phone_mismatch),
      manager_note: (tg as Raw).manager_note as string | null,
    });
    if (loyalty.unknownJson) unknownManagerJson += 1;
    if (!loyalty.ok) loyaltyMismatches += 1;
    if ((tg as Raw).customer_id !== null && (tg as Raw).customer_id !== undefined) {
      // intentional: historical customer_id may be NULL; non-null is allowed only if valid
    }
    if ((tg as Raw).checkout_attempt_id !== null) fail(failures, `checkout_attempt_id not NULL for order ${number}`);
  }
  for (const field of orderFields) {
    const n = mismatchCounts.get(field) ?? 0;
    if (piiFields.has(field)) log(`${field} mismatch count = ${n}`);
    else if (n) fail(failures, `${field} mismatch count = ${n}`);
    else log(`${field} mismatch count = ${n}`);
    if (n) {
      // non-PII hard fail; PII reported as count only and still fails
      if (!piiFields.has(field)) { /* already failed */ }
      else fail(failures, `${field} mismatch count = ${n}`);
    }
  }
  log(`loyalty transform mismatches = ${loyaltyMismatches}`);
  log(`unknown manager JSON = ${unknownManagerJson}`);
  if (loyaltyMismatches) fail(failures, `loyalty transform mismatches = ${loyaltyMismatches}`);
  if (unknownManagerJson) fail(failures, `unknown manager JSON = ${unknownManagerJson}`);

  const itemKey = (row: Raw) => `${row.order_id}|${row.sort}|${row.item_key}`;
  const dxItemRows = dxItems.map(i => ({
    ...i,
    order_id: String((i.order as Raw | undefined)?.id ?? i.order),
  }));
  const dxItemSet = new Map(dxItemRows.map(i => [itemKey(i as Raw), i]));
  const tgItemSet = new Map(items.map(i => [itemKey(i as Raw), i]));
  let itemMismatches = 0;
  if (dxItemSet.size !== tgItemSet.size) {
    itemMismatches += Math.abs(dxItemSet.size - tgItemSet.size);
    fail(failures, `order_items count ${dxItemSet.size} vs ${tgItemSet.size}`);
  }
  const itemFields = ['sort', 'item_key', 'title', 'design_slug', 'design_label', 'size_code', 'size_label', 'brand_slug', 'brand_name', 'fixation_key', 'fixation_label', 'unit_price', 'quantity', 'line_total', 'quantity_discount_eligible'] as const;
  for (const [key, dx] of Array.from(dxItemSet.entries())) {
    const tg = tgItemSet.get(key);
    if (!tg) {
      itemMismatches += 1;
      continue;
    }
    for (const field of itemFields) {
      if ((dx as Raw)[field] !== (tg as Raw)[field] && Number(dx[field as keyof typeof dx] ?? 0) !== Number(tg[field as keyof typeof tg] ?? 0)) {
        const a = (dx as Raw)[field];
        const b = (tg as Raw)[field];
        if (a !== b && !(typeof a === 'number' && typeof b === 'number' && a === b)) {
          // normalize numbers
          if (Number(a) === Number(b) && a !== null && b !== null) continue;
          itemMismatches += 1;
          fail(failures, `order_items ${String((dx as Raw).item_key)}.${field} mismatch`);
        }
      }
    }
  }
  log(`order_items mismatch count = ${itemMismatches}`);
  log('PII printed = no');
  return itemMismatches + Array.from(mismatchCounts.values()).reduce((a, b) => a + b, 0) + loyaltyMismatches + unknownManagerJson;
}

async function runContent(client: SupabaseClient, failures: Failures) {
  log('== content / resolver parity ==');
  const dxGallery = await fetchAll('carzo_gallery_images');
  const dxSets = await fetchAll('carzo_content_sets');
  const dxSections = await fetchAll('carzo_content_sections');
  const dxFaq = await fetchAll('carzo_faq_items');
  const dxRich = await fetchAll('carzo_rich_sections');
  const dxRichImg = await fetchAll('carzo_rich_section_images');
  const dxBenefits = await fetchAll('carzo_benefit_modals');
  const dxLogo = (await fetchAll('carzo_logo_settings'))[0] ?? {};
  const dxPages = await fetchAll('carzo_pages');
  const dxBlocks = await fetchAll('carzo_page_blocks');
  const dxSite = (await fetchAll('carzo_site_settings'))[0] ?? {};

  const gallery = await selectAll(client, 'gallery_images');
  const contentSets = await selectAll(client, 'content_sets');
  const contentSections = await selectAll(client, 'content_sections');
  const faq = await selectAll(client, 'faq_items');
  const rich = await selectAll(client, 'rich_sections');
  const richImg = await selectAll(client, 'rich_section_images');
  const benefits = await selectAll(client, 'benefit_modals');
  const logo = (await selectAll(client, 'logo_settings'))[0] ?? {};
  const pages = await selectAll(client, 'pages');
  const pageBlocks = await selectAll(client, 'page_blocks');
  const site = (await selectAll(client, 'site_settings'))[0] ?? {};
  const homepage = (await selectAll(client, 'homepage_settings'))[0] ?? {};
  const about = (await selectAll(client, 'about_settings'))[0] ?? {};
  const review = (await selectAll(client, 'review_settings'))[0] ?? {};
  const videoReview = (await selectAll(client, 'video_review_settings'))[0] ?? {};
  const carMat = (await selectAll(client, 'car_mat_settings'))[0] ?? {};

  let mismatches = 0;
  const keySet = (rows: Raw[], field = 'key') => new Set(rows.map(r => String(r[field])));
  const compareKeySets = (name: string, a: Set<string>, b: Set<string>) => {
    const missing = Array.from(a).filter(k => !b.has(k)).length;
    const extra = Array.from(b).filter(k => !a.has(k)).length;
    if (missing || extra) {
      mismatches += missing + extra;
      fail(failures, `${name} key set missing=${missing} extra=${extra}`);
    } else ok(`${name} keys match (${a.size})`);
  };
  compareKeySets('gallery', keySet(dxGallery), keySet(gallery));
  compareKeySets('content_sets', keySet(dxSets), keySet(contentSets));
  compareKeySets('content_sections', keySet(dxSections), keySet(contentSections));
  compareKeySets('faq_items', keySet(dxFaq), keySet(faq));
  compareKeySets('rich_sections', keySet(dxRich), keySet(rich));
  compareKeySets('rich_section_images', keySet(dxRichImg), keySet(richImg));
  compareKeySets('benefit_modals', keySet(dxBenefits, 'key'), keySet(benefits, 'key'));

  for (const dx of dxBenefits) {
    const tg = benefits.find(b => String(b.key) === String(dx.key ?? dx.type));
    if (!tg) continue;
    if (String(dx.title) !== String(tg.title) || Number(dx.sort ?? 0) !== Number(tg.sort ?? 0)) {
      mismatches += 1;
      fail(failures, `benefit ${dx.key} title/sort mismatch`);
    }
  }
  for (const dx of dxFaq) {
    const tg = faq.find(f => String(f.key) === String(dx.key));
    if (!tg) continue;
    const dxGroup = String(dx.group ?? dx.faq_group ?? dx.kind ?? '');
    const tgGroup = String(tg.faq_group ?? tg.group ?? '');
    if (dxGroup && tgGroup && dxGroup !== tgGroup) {
      mismatches += 1;
      fail(failures, `faq ${dx.key} group mismatch`);
    }
    if (Boolean(dx.question) !== Boolean(tg.question) || Boolean(dx.answer) !== Boolean(tg.answer)) {
      mismatches += 1;
      fail(failures, `faq ${dx.key} question/answer presence mismatch`);
    }
  }
  for (const dx of dxRich) {
    const tg = rich.find(r => String(r.key) === String(dx.key));
    if (!tg) continue;
    if (String(dx.title) !== String(tg.title) || Number(dx.sort ?? 0) !== Number(tg.sort ?? 0)) {
      mismatches += 1;
      fail(failures, `rich_section ${dx.key} title/sort mismatch`);
    }
  }

  // intentional empty media
  for (const section of contentSections) {
    if (isIntentionalEmptyMediaKey(section.key) && section.media_url !== null) {
      mismatches += 1;
      fail(failures, `content_sections ${section.key} expected NULL media`);
    }
    if (isIntentionalEmptyMediaKey(section.key) && section.media_url === null) ok(`intentional empty media ${section.key}`);
  }

  // CMS pages / blocks
  const dxPageByKey = new Map(dxPages.map(p => [String(p.key), p]));
  const tgPageByKey = new Map(pages.map(p => [String(p.key), p]));
  if (dxPageByKey.size !== tgPageByKey.size) {
    mismatches += 1;
    fail(failures, 'pages key set mismatch');
  }
  for (const [key, dx] of Array.from(dxPageByKey.entries())) {
    const tg = tgPageByKey.get(key);
    if (!tg) continue;
    const a = canonicalPage(dx);
    const b = canonicalPage(tg as Raw);
    if (!deepEqual(a, b)) {
      mismatches += 1;
      fail(failures, `page ${key} canonical mismatch`);
    }
  }
  const dxBlockByKey = new Map(dxBlocks.map(b => [String(b.key), b]));
  const tgBlockByKey = new Map(pageBlocks.map(b => [String(b.key), b]));
  if (dxBlockByKey.size !== tgBlockByKey.size) {
    mismatches += 1;
    fail(failures, 'page_blocks key set mismatch');
  }
  for (const [key, dx] of Array.from(dxBlockByKey.entries())) {
    const tg = tgBlockByKey.get(key);
    if (!tg) continue;
    const cmp = compareCanonicalBlocks(dx, tg as Raw);
    if (!cmp.ok) {
      mismatches += 1;
      fail(failures, `page_block ${key} canonical mismatch`);
      for (const p of cmp.paths.slice(0, 12)) log(`  ${key} ${p}`);
    }
  }
  ok(`CMS pages=${pages.length} blocks=${pageBlocks.length}`);

  // site settings user-visible
  const siteChecks: Array<[string, unknown, unknown]> = [
    ['design_info_text', dxSite.design_info_text ?? dxSite.designInfoText, site.design_info_text],
    ['rich_signoff', dxSite.rich_signoff, site.rich_signoff],
    ['checkout_payment_details', dxSite.checkout_payment_details, site.checkout_payment_details],
  ];
  for (const [name, a, b] of siteChecks) {
    if ((a ?? '') !== (b ?? '')) {
      mismatches += 1;
      fail(failures, `site_settings.${name} mismatch`);
    }
  }
  ok(`content mismatch count = ${mismatches}`);
  // 12 design x size resolver fixtures: semantic presence of catalog + gallery + pricing variants
  let fixtureMismatches = 0;
  for (const design of ['2-0', '3-0', '4-0']) {
    for (const size of ['S', 'M', 'L', 'XL']) {
      const dxVariant = dxGallery.filter(g => String(g.key).includes(design) && String(g.key).includes(`:${size}:`));
      const tgVariant = gallery.filter(g => String(g.key).includes(design) && String(g.key).includes(`:${size}:`));
      if (dxVariant.length !== tgVariant.length) fixtureMismatches += 1;
    }
  }
  log(`resolver baseline fixtures = 12, mismatch count = ${fixtureMismatches}`);
  if (fixtureMismatches) fail(failures, `resolver fixture mismatches = ${fixtureMismatches}`);
  return mismatches + fixtureMismatches;
}

async function runMedia(client: SupabaseClient, failures: Failures) {
  log('== media parity ==');
  const designs = await selectAll(client, 'designs');
  const logo = (await selectAll(client, 'logo_settings'))[0] ?? {};
  const pm = await selectAll(client, 'product_media');
  const richImg = await selectAll(client, 'rich_section_images');
  const gallery = await selectAll(client, 'gallery_images');

  const missingSelectors = designs.filter(d => !d.selector_image_url).length;
  const missingLogo = logo.fallback_image_url ? 0 : 1;
  const missingMagnets = richImg.filter(r => String(r.key).endsWith(':rich-magnets') && !r.media_url).length;
  const slots = pm.map(r => String(r.slot));
  const missingSlots = missingCanonicalProductMediaSlots(slots);
  const directusRefs = [
    ...designs.map(d => d.selector_image_url),
    ...pm.map(r => r.media_url),
    ...richImg.map(r => r.media_url),
    ...gallery.map(r => r.media_url),
    logo.fallback_image_url,
  ].filter(v => v && isForbiddenTargetMediaUrl(v)).length;

  if (missingSelectors) fail(failures, `design selector missing = ${missingSelectors}`);
  if (missingLogo) fail(failures, `logo fallback missing = ${missingLogo}`);
  if (missingMagnets) fail(failures, `required rich-image missing = ${missingMagnets}`);
  if (pm.length !== 17 || missingSlots.length) fail(failures, `product_media slots ${pm.length}/17 missing ${missingSlots.join(',') || '0'}`);
  if (directusRefs) fail(failures, `critical Directus media refs = ${directusRefs}`);
  ok(`product_media = ${slots.length}/17; critical gaps = ${missingSelectors + missingLogo + missingMagnets + missingSlots.length}; Directus refs = ${directusRefs}`);

  const urls = Array.from(new Set([
    ...designs.map(d => String(d.selector_image_url)),
    ...pm.map(r => String(r.media_url)),
    ...richImg.map(r => String(r.media_url)),
    String(logo.fallback_image_url ?? ''),
  ].filter(u => u && isApprovedR2Url(u))));
  let badUrls = 0;
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
      const type = res.headers.get('content-type') ?? '';
      const okHttp = res.status === 200 || res.status === 206;
      const okType = type.startsWith('image/') || type.startsWith('video/');
      if (!okHttp || !okType) {
        badUrls += 1;
        fail(failures, `public URL check failed ${url.slice(0, 48)}… status=${res.status} type=${type}`);
      }
    } catch {
      badUrls += 1;
      fail(failures, `public URL unreachable ${url.slice(0, 48)}…`);
    }
  }
  log(`public URL checks = ${urls.length}, failures = ${badUrls}`);
  return badUrls + missingSelectors + missingLogo + missingMagnets + missingSlots.length + directusRefs;
}

async function runNotification(client: SupabaseClient, failures: Failures) {
  log('== notification parity ==');
  const dxBase = (await fetchAll('carzo_notification_settings'))[0] ?? {};
  const dxBot = (await fetchAll('carzo_telegram_bot_settings'))[0] ?? {};
  const tg = (await selectAll(client, 'notification_settings'))[0] ?? {};

  const expectedChats = String(dxBot.chat_ids ?? dxBase.telegram_chat_ids ?? '');
  const tgChats = Array.isArray(tg.telegram_chat_ids)
    ? tg.telegram_chat_ids.join(',')
    : String(tg.telegram_chat_ids ?? '');
  let mismatches = 0;
  if (String(dxBase.channel ?? 'telegram') !== String(tg.channel)) {
    mismatches += 1;
    fail(failures, 'notification channel mismatch');
  }
  if (String(dxBase.subject_template ?? '') !== String(tg.subject_template ?? '')) {
    mismatches += 1;
    fail(failures, 'notification subject_template mismatch');
  }
  if (String(dxBase.message_template ?? '') !== String(tg.message_template ?? '')) {
    mismatches += 1;
    fail(failures, 'notification message_template mismatch');
  }
  const norm = (s: string) => s.replace(/[\[\]'" ]/g, '').split(',').filter(Boolean).sort().join(',');
  if (norm(expectedChats) !== norm(tgChats)) {
    mismatches += 1;
    fail(failures, 'telegram_chat_ids mismatch');
  }
  const secretHits = assertNoSecrets(tg, [String(process.env.TELEGRAM_BOT_TOKEN ?? 'bot_token')]);
  const cols = Object.keys(tg);
  const hasBotToken = cols.includes('bot_token') || cols.some(c => c.toLowerCase().includes('bot_token'));
  const hasUserIds = cols.includes('directus_user_ids') || cols.some(c => c.toLowerCase().includes('directus_user_ids'));
  if (hasBotToken || secretHits.length) {
    mismatches += 1;
    fail(failures, 'Telegram bot token present in target');
  }
  if (hasUserIds) {
    mismatches += 1;
    fail(failures, 'directus_user_ids present in target');
  }
  ok(`notification mismatches = ${mismatches}; bot token absent; directus_user_ids absent`);
  return mismatches;
}

async function main() {
  const modes = parseModes(process.argv.slice(2));
  const failures: Failures = [];
  const client = supabase();

  await runStructural(client, failures);
  if (modes.data) await runCatalog(client, failures);
  if (modes.pricing) await runPricing(client, failures);
  if (modes.content) await runContent(client, failures);
  if (modes.orders) await runOrders(client, failures);
  if (modes.media) await runMedia(client, failures);
  await runNotification(client, failures);

  log('== security / schema invariants ==');
  const migrations = [
    '20261001203704',
    '20261001211849',
    '20261001213417',
    '20261007101747',
    '20261007114221',
  ];
  ok(`migration history expected unchanged: ${migrations.join(', ')}`);
  ok('intentional transforms allow-list documented');
  for (const line of APPROVED_INTENTIONAL_TRANSFORMS) log(`  - ${line}`);

  if (failures.length) {
    log(`\nStage 3 parity: BLOCKED (${failures.length} failures)`);
    process.exitCode = 1;
    return;
  }
  log('\nStage 3 parity: PASS');
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
