# SUPABASE STAGE 2 RESULT

## Baseline

- date/time: 2026-10-07 (UTC)
- branch: `dev`
- baseline Git SHA: `3b9bf6416e994f8c9a9676f0c2ba5d2f6eb7333a`
- Supabase project: `Carzo` / `kmhegysmtsjqtwwaacht`
- Stage 1 migration history: `20261001203704`, `20261001211849`, `20261001213417`, `20261007101747`, `20261007114221` (match Git)
- target table counts before: 27 Stage 1 tables = 0 rows each; application tables = 28
- customers count before: 5994

## Directus snapshot

- snapshot started_at: 2026-10-07T12:46:45Z
- snapshot completed_at: 2026-10-07T12:46:55Z

| collection | live | audit | drift |
|---|---:|---:|---|
| carzo_designs | 3 | 3 | 0 |
| carzo_sizes | 4 | 4 | 0 |
| carzo_brands | 26 | 26 | 0 |
| carzo_brand_pricing | 26 | 26 | 0 |
| carzo_variants | 12 | 12 | 0 |
| carzo_fixations | 4 | 4 | 0 |
| carzo_size_shipping | 0 | 0 | 0 |
| carzo_discount_tiers | 2 | 2 | 0 |
| carzo_gallery_images | 57 | 57 | 0 |
| carzo_content_sets | 16 | 16 | 0 |
| carzo_content_sections | 48 | 48 | 0 |
| carzo_faq_items | 8 | 8 | 0 |
| carzo_rich_sections | 4 | 4 | 0 |
| carzo_rich_section_images | 12 | 12 | 0 |
| carzo_benefit_modals | 6 | 6 | 0 |
| carzo_logo_settings | 1 | 1 | 0 |
| carzo_media_settings | 1 | 1 | 0 |
| carzo_site_settings | 1 | 1 | 0 |
| carzo_pages | 4 | 4 | 0 |
| carzo_page_blocks | 5 | 5 | 0 |
| carzo_orders | 10 | 10 | 0 |
| carzo_order_items | 17 | 17 | 0 |
| carzo_notification_settings | 1 | 1 | 0 |
| carzo_telegram_bot_settings | 1 | 1 | 0 |

- audit count drift summary: **none**
- source schema drift: **no**
- `carzo_logo_placements` count: **0** (verified, not migrated)

## Tooling

- migration script: `product-page/scripts/migrate-directus-to-supabase.ts`
- pure transforms: `product-page/scripts/migrate-directus-to-supabase/transform.ts`
- dry-run: `npx tsx scripts/migrate-directus-to-supabase.ts --dry-run` — PASS
- apply: `npx tsx scripts/migrate-directus-to-supabase.ts --apply` — PASS
- verify: `npx tsx scripts/migrate-directus-to-supabase.ts --verify` — PASS
- tests: `product-page/tests/migrate-directus-to-supabase.test.ts` — **19/19 PASS**

## Transformations

- brand pricing merge: `carzo_brand_pricing.logo_extra` → `brands.logo_extra` (1:1)
- size shipping fold: `carzo_size_shipping` → `sizes.shipping_*` (source empty → NULL)
- fixation size extras: 16 rows from `extra_by_size` → `fixation_size_extras`
- product media slots: **16/17** loaded; 1 gap deferred to Stage 2A
- site settings split: 6 target tables; `customers` JSON dropped
- notification: `bot_token` / `directus_user_ids` excluded; `telegram_chat_ids` from bot settings
- order loyalty transform: 3 loyalty JSON → `loyalty_*`; `manager_note` stays NULL for those; 0 unknown JSON
- customer FK link: linked=0 / unlinked=10 / invalid_for_link=0 (historical phone snapshot preserved)
- media file-only deferral: Directus file UUIDs never stored as media URLs

## Load result

| table | rows | expected |
|---|---:|---|
| designs | 3 | 3 |
| sizes | 4 | 4 |
| brands | 26 | 26 |
| variants | 12 | 12 |
| fixations | 4 | 4 |
| fixation_size_extras | 16 | expanded |
| discount_tiers | 2 | 2 |
| gallery_images | 57 | 57 |
| content_sets | 16 | 16 |
| content_sections | 48 | 48 |
| faq_items | 8 | 8 |
| rich_sections | 4 | 4 |
| rich_section_images | 12 | 12 |
| benefit_modals | 6 | 6 |
| logo_settings | 1 | 1 |
| product_media | 16 | 17 (1 gap) |
| site_settings | 1 | 1 |
| homepage_settings | 1 | 1 |
| about_settings | 1 | 1 |
| review_settings | 1 | 1 |
| video_review_settings | 1 | 1 |
| car_mat_settings | 1 | 1 |
| pages | 4 | 4 |
| page_blocks | 5 | 5 |
| notification_settings | 1 | 1 |
| orders | 10 | 10 |
| order_items | 17 | 17 |
| customers | 5994 | 5994 (unchanged) |

## Verification

- duplicates natural keys: **0** (20 key groups checked)
- orphans FKs: **0** (variants, fixation_size_extras, gallery, content_sections, rich_section_images, page_blocks, order_items)
- order parity: source 10 / target 10; items 17 / 17; `order_number` dups 0; `checkout_attempt_id` all NULL; JSON `manager_note` 0
- loyalty transform: eligible=3, loyalty_phone set=3
- commerce value parity: source counts and dry-run transforms match loaded rows (prices not recomputed)
- 24 source collections accounted: **yes**
- customers unchanged: **yes** (5994)
- schema/security/migration history unchanged: **yes**
- Directus `/assets/` leaks in target media fields: **0**
- notification chat ids present: **1/1**

## Media gaps for Stage 2A

Live Supabase verification: **8** unresolved production media references.

| target | keys / slot | count |
|---|---|---:|
| `designs.selector_image_url` | `2-0`, `3-0`, `4-0` | 3 |
| `rich_section_images.media_url` | `2-0:rich-magnets`, `3-0:rich-magnets`, `4-0:rich-magnets` | 3 |
| `logo_settings.fallback_image_url` | 1 unresolved fallback | 1 |
| `product_media` | missing canonical slot `magnetic_system_default_cover` | 1 |
| **total** | | **8** |

- product_media rows loaded / 17: **16/17**
- Directus file UUIDs stored as target media refs: **0**
- R2 mutations: **0**

Note: 2 `content_sections.media_url = NULL` rows are **not** counted as file-only gaps — source audit shows no mandatory Directus-file dependency. Stage 2A may classify them during inventory only.

Stage 2A not started.

## Safety

- Directus mutations: none (GET only)
- R2 mutations: none
- customers mutations: none
- runtime changes: none
- env changes: none (session-only credentials used for apply; not committed)
- deploy: none
- cutover: none

## Final status

**Stage 2: PASS**

Stage 2A not started. Stage 3 not started.
