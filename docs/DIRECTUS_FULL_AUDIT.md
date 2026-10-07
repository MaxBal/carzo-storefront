# DIRECTUS FULL AUDIT — Carzo Storefront

**Дата аудита:** 2026-10-03  
**Режим:** READ-ONLY. Без миграций, без мутаций Directus / Supabase / R2 / production.  
**Связанные документы:** `docs/SUPABASE_TARGET_ARCHITECTURE.md`, `docs/DIRECTUS_TO_SUPABASE_MASTER_PLAN.md`

---

## 0. Verified current state

### Git

| Item | Value |
|---|---|
| Repository | `MaxBal/carzo-storefront` |
| Branch | `dev` |
| HEAD | `2e4a773cc888990f11d26dffbbdc482e7c60272e` |
| Working tree | clean (only untracked `.DS_Store`) |
| Remote | `https://github.com/MaxBal/carzo-storefront.git` |

Last 10 commits (summary):

```
2e4a773 docs: record telegram discount breakdown in handoff
cbec2d4 fix: show discounts in order notifications
a0fc33f docs: correct checkout finalization git baseline table
9287bde docs: stamp staging deploy SHA for checkout finalization
bbef4eb docs: record checkout finalization and target architecture change
542d42e fix: include fixation in order notifications
139dc45 docs: record PHASE 6 commit SHA in handoff
c87f33c fix: harden checkout reliability and staging QA
16308f1 docs: record PHASE 5 commit SHA in handoff
3919a8b feat: make loyalty pricing server authoritative
```

### Supabase (project `Carzo` / `kmhegysmtsjqtwwaacht`)

| Item | Expected | Observed | Match |
|---|---|---|---|
| Application tables | `public.customers` | `public.customers` only | yes |
| Row count | ~5994 | 5994 | yes |
| Migrations | 3 listed in handoff | `20261001203704_rls_auto_enable`, `20261001211849_create_customers`, `20261001213417_tighten_customers_service_role_grants` | yes |
| RLS enabled | yes | yes | yes |
| RLS policies | — | **none** (advisor INFO `rls_enabled_no_policy`) | documented difference |
| Phone uniqueness | yes | `customers_phone_key` UNIQUE | yes |
| Phone format | `+380XXXXXXXXX` | CHECK `phone ~ '^\+380[0-9]{9}$'` | yes |
| Edge Functions | none required | none | yes |
| Indexes | — | `customers_pkey`, `customers_phone_key` | yes |
| Grants | service-role / server | `postgres` full; `service_role` SELECT/INSERT/UPDATE/DELETE. No `anon`/`authenticated` grants | yes |
| Triggers / views / functions (public) | — | none observed | — |

**Difference (do not fix in this phase):** RLS is enabled on `customers` but there are no policies. Access is gated by table grants (service-role only). This is acceptable for a server-only table but should be made explicit in target security design.

### Directus runtime

| Item | Value |
|---|---|
| Base URL | `directus-production-7c9b.up.railway.app` |
| Server reachable | yes (read-only schema/items API) |
| Application collections (`carzo_*`) | **31** (25 data + 6 UI groups) |
| Total fields (incl. system) | 813 |
| Application fields (`carzo_*`) | ~430 |
| Relations (all) | 113 |
| Application relations (`carzo_*`) | 53 |
| Directus files | 37 (all `storage=s3`) |
| Extensions | 0 |
| Flows | 1 (`Carzo — Нове замовлення`, **status=inactive**) |
| Operations | 1 (`notification` for that flow) |
| Roles | 6 |
| Policies | 7 |
| Permissions | 124 |
| Directus users | 2 (both Administrator; no PII recorded) |

> Tokens were used only for read-only introspection and are **not** stored in this document.

---

## 1. Live Directus collection inventory

### 1.1 Application collections (carzo_*)

| Collection | Kind | Rows | Status distribution | Group |
|---|---|---:|---|---|
| `carzo_designs` | list | 3 | published 3 | product_catalog |
| `carzo_sizes` | list | 4 | published 4 | product_catalog |
| `carzo_brands` | list | 26 | published 26 | product_catalog |
| `carzo_fixations` | list | 4 | published 4 | product_catalog |
| `carzo_variants` | list | 12 | published 12 | commerce |
| `carzo_brand_pricing` | list | 26 | published 26 | commerce |
| `carzo_size_shipping` | list | **0** | — | commerce |
| `carzo_discount_tiers` | list | 2 | published 2 | commerce |
| `carzo_gallery_images` | list | 57 | published 53, archived 4 | product_content |
| `carzo_content_sets` | list | 16 | published 16 | product_content |
| `carzo_content_sections` | list | 48 | published 48 | product_content |
| `carzo_faq_items` | list | 8 | published 8 | product_content |
| `carzo_rich_sections` | list | 4 | published 4 | product_content |
| `carzo_rich_section_images` | list | 12 | published 12 | product_content |
| `carzo_benefit_modals` | list | 6 | published 6 | product_content |
| `carzo_logo_settings` | **singleton** | 1 | published 1 | product_content |
| `carzo_logo_placements` | list | **0** | — | product_content |
| `carzo_media_settings` | **singleton** | 1 | published 1 | product_content |
| `carzo_site_settings` | **singleton** | 1 | published 1 | product_page |
| `carzo_pages` | list | 4 | published 2, draft 2 | site_pages |
| `carzo_page_blocks` | list | 5 | published 4, draft 1 | site_pages |
| `carzo_orders` | list | 10 | status=`new` 10 | orders |
| `carzo_order_items` | list | 17 | — | orders |
| `carzo_notification_settings` | **singleton** | 1 | — | (none) |
| `carzo_telegram_bot_settings` | **singleton** | 1 | — | (none) |
| `carzo_group_commerce` | UI group | n/a | 403 items | group |
| `carzo_group_orders` | UI group | n/a | 403 items | group |
| `carzo_group_product_catalog` | UI group | n/a | 403 items | group |
| `carzo_group_product_content` | UI group | n/a | 403 items | group |
| `carzo_group_product_page` | UI group | n/a | 403 items | group |
| `carzo_group_site_pages` | UI group | n/a | 403 items | group |

### 1.2 UI grouping collections (Directus Admin only)

`carzo_group_*` are folder/group rows in Directus UI. They have no application data and must **not** be migrated to Supabase.

Disposition: `DROP_AS_DIRECTUS_UI_METADATA`.

### 1.3 System collections

`directus_*` system tables (users, roles, policies, permissions, files, flows, operations, activity, revisions, etc.) are platform-managed. Only the **application-relevant effects** of some of them need replacement (see §4).

---

## 2. Live field schema (application collections)

> Types taken from live Directus `/fields`. `*URL` companions are R2 HTTPS fields with priority over Directus file UUIDs.

### 2.1 Catalog / commerce

#### `carzo_designs` (8)
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| slug | string UNIQUE | `2-0`, `3-0`, `4-0` |
| label | string | |
| version | string | `2.0` / `3.0` / `4.0` |
| sort | int | |
| status | string default `draft` | `published` |
| selector_image | uuid → directus_files | **file-only today** |
| selector_image_url | string | R2 companion (empty live) |

#### `carzo_sizes` (14)
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| code | string UNIQUE | `S`/`M`/`L`/`XL` |
| slug | string UNIQUE | lowercase |
| label | string | e.g. `S 40×30×30 см` |
| content_group | string | `S`/`M`/`LXL` |
| height_cm, width_cm, depth_cm | int | product dims (populated) |
| shipping_length_cm, shipping_width_cm, shipping_height_cm, shipping_weight_kg | int/float | **legacy, all null live** |
| sort, status | int/string | |

#### `carzo_brands` (9)
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| slug | string UNIQUE | includes `none` |
| name | string | |
| flag | string | emoji |
| logo_extra | int | **legacy**; storefront uses `carzo_brand_pricing` |
| logo_image | uuid | mostly unused live |
| logo_image_url | string | R2 primary (24/26) |
| sort, status | | |

#### `carzo_brand_pricing` (4)
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| brand | uuid → carzo_brands UNIQUE | 26 rows |
| logo_extra | int | live values 0 or 290 |
| status | string | |

#### `carzo_variants` (9)
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| key | string UNIQUE | `2-0:S` … `4-0:XL` (12) |
| design | uuid → carzo_designs | required in practice |
| size | uuid → carzo_sizes | required in practice |
| price | int UAH whole | 1790–2990 |
| old_price | int | informational strikethrough |
| in_stock | bool default true | all true live |
| quantity_discount_eligible | bool default true | all true live |
| status | string | |

#### `carzo_size_shipping` (7)
Empty live. Fields: id, size (UNIQUE), length_cm, width_cm, height_cm, weight_kg, status.  
Note: sizes currently use embedded `height/width/depth_cm`; shipping_* legacy columns are null.

#### `carzo_fixations` (7)
| Field | Type | Notes |
|---|---|---|
| key | string UNIQUE | `none`, `bottom`, `wall`, `both` |
| label | string | |
| extra | int default 0 | base extra UAH |
| extra_by_size | **json** | `{s,m,l,xl}` — LIVE_ONLY vs snapshot |
| sort, status | | |

Live values: `both` has extra=80 and extra_by_size `{s:60,m:80,l:100,xl:120}`; others 0.

#### `carzo_discount_tiers` (6)
| Field | Type | Notes |
|---|---|---|
| key | string UNIQUE | `quantity-2`, `quantity-3` |
| min_quantity | int | 2, 3 |
| amount | int UAH | 200, 500 (fixed amount) |
| sort, status | | |

### 2.2 Product content

#### `carzo_gallery_images` (9)
key UNIQUE, design?, size?, image?, external_url?, alt?, sort, status  
57 rows; 53 published, 4 archived. external_url populated on all 57; image file still set on 5 (both).

#### `carzo_content_sets` (11)
key UNIQUE, kind (`inside`|`fixation`), design?, size?, size_group?, title, content_tab_label, faq_tab_label, info_box, status  
16 rows: 4 `inside` (by size_group S/M/LXL + default naming) + 12 `fixation` (design×size) + 1 `fixation-default`.

#### `carzo_content_sections` (10)
key UNIQUE, content_set → sets, title, text, image?, external_url?, image_placeholder?, sort, status  
48 rows. 46/48 have R2 URL.

#### `carzo_faq_items` (7)
key UNIQUE, faq_group (`inside`|`fixation`|`logo`), question, answer, sort, status  
8 rows.

#### `carzo_rich_sections` (13)
key UNIQUE (`rich-materials`, `rich-magnets`, `rich-edging`, `rich-handles`), title, subtitle?, description, additional_title/text/list (json), design?, image?, external_url? (legacy), sort, status  
4 rows. Image is Directus-file primary; external_url empty.

#### `carzo_rich_section_images` (8)
key UNIQUE, section → rich_sections (CASCADE), design → designs (CASCADE), image?, external_url?, alt?, status  
12 rows. 9 have R2 URL; 3 remain file-only.

#### `carzo_benefit_modals` (8)
key UNIQUE: `warranty`, `payment`, `delivery`, `returns`, `bundle`, `loyalty`  
title, card_label, subtitle, content (**json typed blocks**), sort, status.

#### `carzo_logo_settings` (singleton, 9)
title, info_text, specs (**json** list of 5), fallback_image?, fallback_image_url?, logo_placement_video?, logo_placement_video_url?, status.

#### `carzo_logo_placements` (8)
Empty live. design?, size?, image?, external_url?, key UNIQUE, sort, status.

#### `carzo_media_settings` (singleton, 38)
Pair pattern: `{name}` Directus file + `{name}_url` R2.

| Media family | File fields | URL fields | Live |
|---|---|---|---|
| materials/edging/fixation videos | 3 | 3 | URL filled |
| magnetic_system_video | 1 | 1 | URL filled |
| magnetic_system_default_cover | 1 | 1 | URL filled |
| magnetic covers 2.0/3.0/4.0 × S/M/L/XL | 12 | 12 | all URL filled |
| image (legacy single) | 1 | — | file only |

All live R2 URLs use host `media.carzo.com.ua`, path prefix `content/products/...`.

### 2.3 Global site settings — `carzo_site_settings` (singleton, 75 fields)

Accumulated responsibilities. Field groups:

| Domain | Fields (live) | Notes |
|---|---|---|
| About page | about_hero_*, about_process_*, about_principles_*, about_development_*, about_statement_text | process images have URL companions |
| Homepage | homepage_hero_*, homepage_badges_*, homepage_quality_*, homepage_logo_video* | logo video URL filled; badges video empty |
| Reviews | reviews_* (text/CTA/instagram/items JSON) | screenshots JSON empty |
| Video reviews | video_reviews* (list + social + 3 stats) | **LIVE_ONLY**; list[5] |
| Car mats | car_mat_designs JSON, car_mat_modal_*, car_mat_promo_* | promo cover/video URL filled; file empty |
| Product page copy | design_info_text, feature_*, rich_signoff, checkout_payment_details | checkout_payment_details empty |
| Site chrome | site_flag / site_flag_url | both empty live |
| **Customers JSON** | `customers` json | list[5] — legacy customer registry |
| Status | status | published |

Empty live: `car_mat_promo_cover`, `car_mat_promo_video`, `checkout_payment_details`, `homepage_badges_video`, `homepage_badges_video_url`, `homepage_logo_video`, `reviews_screenshots`, `site_flag`, `site_flag_url`.

### 2.4 CMS pages

#### `carzo_pages` (14)
id, key UNIQUE, slug UNIQUE, title, page_type (`landing`|`legal`), status, no_index, show_header, show_footer, seo_title, seo_description, seo_image?, seo_image_url?, blocks (O2M alias)

Live pages:
| key | slug | status | page_type | no_index |
|---|---|---|---|---|
| home | home | published | landing | false |
| delivery-and-payment | delivery-and-payment | published | legal | true |
| privacy-policy | privacy-policy | draft | legal | true |
| public-offer | public-offer | draft | legal | true |

#### `carzo_page_blocks` (21)
id, key UNIQUE, page → pages (O2M, sort), block_type (default `rich_text`), title, eyebrow, subtitle, body (HTML), items (**json**), image?, image_url?, image_alt, image_position, theme, primary_label/url, secondary_label/url, anchor, sort, status

5 blocks; 4 published, 1 draft.

### 2.5 Orders

#### `carzo_orders` (29)
| Group | Fields |
|---|---|
| Identity | id uuid, order_number UNIQUE, status (`new`), created_at |
| Customer snapshot | customer_name, customer_phone, customer_comment, customer_email (legacy) |
| Contact | contact_method |
| Delivery snapshot | delivery_method, delivery_city_ref/name, delivery_point_ref/number/name/address/type, delivery_street_ref/name/type, delivery_house, delivery_apartment |
| Totals | items_quantity, subtotal, quantity_discount, total, discount_tier_key |
| Audit | manager_note (text; currently loyalty JSON), items (O2M) |

Live: 10 orders, all `new`. Date range `2026-07-28` → `2026-10-02`.  
**No dedicated loyalty columns.** Loyalty audit is written into `manager_note` JSON via `lib/cart/order-audit.ts`.

#### `carzo_order_items` (17)
Snapshot fields: item_key, title, design_slug/label, size_code/label, brand_slug/name, fixation_key/label, unit_price, quantity, line_total, quantity_discount_eligible, sort, order FK.  
17 items across 10 orders. Integrity: 0 orphans.

### 2.6 Notifications

#### `carzo_notification_settings` (singleton, 6)
| Field | Live | Notes |
|---|---|---|
| channel | string | e.g. telegram/email routing |
| subject_template | string | `{{order_number}}` style |
| message_template | text | includes customer/order vars |
| directus_user_ids | json list[1] | Directus user UUID recipients |
| telegram_chat_ids | json list[1] | **legacy fallback** |

#### `carzo_telegram_bot_settings` (singleton, 3)
| Field | Live | Notes |
|---|---|---|
| bot_token | string present | **SECRET** — must move to env |
| chat_ids | json list[2] | recipients |

---

## 3. Relations

### 3.1 Domain relations (application)

| Many | Field | One | Cardinality | on_delete |
|---|---|---|---|---|
| carzo_variants | design | carzo_designs | M2O | (none) |
| carzo_variants | size | carzo_sizes | M2O | (none) |
| carzo_brand_pricing | brand | carzo_brands | M2O unique | (none) |
| carzo_size_shipping | size | carzo_sizes | M2O unique | (none) |
| carzo_content_sets | design | carzo_designs | M2O | (none) |
| carzo_content_sets | size | carzo_sizes | M2O | (none) |
| carzo_content_sections | content_set | carzo_content_sets | M2O | (none) |
| carzo_gallery_images | design / size | designs / sizes | M2O | (none) |
| carzo_logo_placements | design / size | designs / sizes | M2O | (none) |
| carzo_rich_sections | design | carzo_designs | M2O | SET NULL |
| carzo_rich_section_images | section | carzo_rich_sections | M2O | **CASCADE** |
| carzo_rich_section_images | design | carzo_designs | M2O | **CASCADE** |
| carzo_page_blocks | page | carzo_pages | O2M (sort) | (none) |
| carzo_order_items | order | carzo_orders | O2M (sort) | (none) |

### 3.2 Media relations (→ `directus_files`)

All `*_image` / `*_video` / `*_cover` / `site_flag` / `fallback_image` / `seo_image` / `logo_placement_video` fields are M2O to `directus_files`, mostly `ON DELETE SET NULL`.

**These relations must not exist in the target Supabase schema.** Target stores R2 URLs / object keys only.

---

## 4. Platform features audit

| Feature | Live state | Application impact | Target replacement |
|---|---|---|---|
| Roles | 6 (Administrator, API Reader, Viewer, Content Editor, Store Manager, Commercial Manager) | Admin UI access only | Supabase RLS + future admin |
| Policies / permissions | 7 policies, 124 permissions | Gate Directus tokens (read token / admin) | RLS policies; server-only secrets |
| Public / read-token access | Used by storefront (`DIRECTUS_READ_TOKEN`) for `/items/*` | **runtime-critical** | Supabase read paths (server) |
| Flows | 1: `Carzo — Нове замовлення`, **inactive** | None while inactive | Not needed; app already notifies via Telegram API |
| Operations | 1 notification op for that flow | none while inactive | — |
| Webhooks | not exposed on `/webhooks` (or unused) | none | — |
| Extensions | 0 | none | — |
| Notifications (Directus inbox) | `directus_user_ids` in notification settings | optional manager inbox | drop or map to email/Telegram only |
| Users | 2 admins referenced by notification settings | IDs only | remove user IDs from notification config |
| Files | 37 S3-backed files | fallback media | R2-only after media completion |
| Settings (project) | preview_url template uses `DIRECTUS_PREVIEW_SECRET` | draft/preview | keep secret-based preview over Supabase |

---

## 5. Live data inventory (safe aggregates)

### 5.1 Catalog snapshot

| Entity | Count | Keys |
|---|---:|---|
| designs | 3 | `2-0`, `3-0`, `4-0` |
| sizes | 4 | S, M, L, XL |
| brands | 26 | `none` + 25 brands |
| brand_pricing | 26 | 1:1 brands; logo_extra 0 or 290 |
| variants | 12 | full design×size matrix; prices 1790/2249/2590/2990; old_price 2100–3400 |
| fixations | 4 | none/bottom/wall/both |
| discount_tiers | 2 | qty≥2 → −200 UAH; qty≥3 → −500 UAH |

### 5.2 Content snapshot

| Entity | Count |
|---|---:|
| gallery_images | 57 (4 archived) |
| content_sets | 16 |
| content_sections | 48 |
| faq_items | 8 |
| rich_sections | 4 |
| rich_section_images | 12 |
| benefit_modals | 6 |
| pages | 4 |
| page_blocks | 5 |

### 5.3 Orders snapshot (no PII)

| Metric | Value |
|---|---|
| orders | 10 |
| order_items | 17 |
| statuses | `new` × 10 |
| created_at min/max | 2026-07-28 … 2026-10-02 |
| order_number uniqueness | 0 dups |
| manager_note populated | loyalty JSON present on orders that used loyalty |

### 5.4 Data quality checks (current findings)

| Check | Result |
|---|---|
| Duplicate design/size/brand/variant/content/page keys | **0** |
| Duplicate order_number | **0** |
| Orphan variants (missing design/size) | **0** |
| Orphan order_items | **0** |
| Orphan page_blocks | **0** |
| Orphan content_sections | **0** |
| Orphan rich_section_images | **0** |
| Orphan brand_pricing / size_shipping | **0** |
| Broken critical R2 URLs sampled | host `media.carzo.com.ua` consistently |
| customers collection (`/items/customers`) | **not present / 403** — customer-store falls back to `carzo_site_settings.customers` JSON (5 rows) |

---

## 6. Schema drift analysis

Source A = live Directus. Source B = `product-page/directus/schema.json`. Source C = application code.

### LIVE_ONLY (live but missing/outdated in snapshot)

| Area | Fields |
|---|---|
| brands | `logo_image_url` |
| designs | `selector_image_url` |
| fixations | `extra_by_size` |
| logo_settings | `fallback_image_url`, `logo_placement_video`, `logo_placement_video_url` |
| media_settings | 17 URL companions (`*_url`) for videos/covers |
| page_blocks | `image_url` |
| pages | `seo_image_url` |
| site_settings | `*_url` companions, `car_mat_promo_*`, `homepage_logo_video*`, `customers`, entire `video_reviews*` family |

### SNAPSHOT_ONLY
None for `carzo_*` collections/fields (snapshot has no extra app fields).  
Snapshot lacks the six `carzo_group_*` UI collections (expected — groups are runtime UI metadata).

### CODE_EXPECTED_BUT_NOT_LIVE
| Code expectation | Live | Impact |
|---|---|---|
| `lib/cart/customer-store/directus.ts` uses `/items/customers` | collection not available (403) | falls back to `site_settings.customers` JSON |
| `size_shipping` rows for shipping dims | 0 rows | shipping dims currently unused |
| `logo_placements` rows | 0 rows | logo placement images unused; video is global |
| `reviews_screenshots` JSON | empty | reviews modal screenshots empty |
| `site_flag` / URL | empty | local `/flag-ua.svg` fallback |
| `homepage_badges_video` | empty | badges video fallback |
| `checkout_payment_details` | empty | no payment note shown |

### LIVE_UNUSED_BY_CODE (or weakly used)
| Item | Notes |
|---|---|
| `carzo_size_shipping` | loaded by catalog fetcher but empty |
| `carzo_logo_placements` | loaded but empty |
| `carzo_brands.logo_extra` | legacy; price comes from `brand_pricing` |
| `carzo_sizes.shipping_*` | legacy; empty |
| `carzo_rich_sections.image/external_url/design` | legacy; images moved to `rich_section_images` |
| `carzo_group_*` | Directus UI only |
| inactive Directus flow | no runtime effect |
| `directus_user_ids` notifications | optional inbox |

### LEGACY_COMPATIBILITY
| Field | Why |
|---|---|
| `carzo_orders.customer_email` | historical orders only |
| `carzo_site_settings.customers` | pre-Supabase customer registry |
| `carzo_notification_settings.telegram_chat_ids` | superseded by `carzo_telegram_bot_settings.chat_ids` |
| Dual media fields (`file` + `*_url`) | R2-first with Directus file fallback |
| `manager_note` as loyalty JSON | Directus order schema lacked loyalty columns |

---

## 7. Media / R2 audit

### 7.1 Media architecture today

Priority used by `resolveMediaUrl` / `resolveJsonMediaUrl`:

1. External HTTPS URL (`*_url` / `external_url`) — almost always `https://media.carzo.com.ua/...` (Cloudflare R2 public domain)
2. Directus file UUID → `/api/directus-assets/{id}` proxy (or `/assets/{id}`)
3. Local `public/` fallback path

### 7.2 Field coverage

| Collection | Field pair | R2 URL | Directus file | Both | File-only |
|---|---|---:|---:|---:|---:|
| carzo_designs | selector_image_url / selector_image | 0 | 3 | 0 | **3** |
| carzo_brands | logo_image_url / logo_image | 24 | 0 | 0 | 0 |
| carzo_gallery_images | external_url / image | 57 | 5 | 5 | 0 |
| carzo_content_sections | external_url / image | 46 | 1 | 1 | 0 |
| carzo_rich_section_images | external_url / image | 9 | 12 | 9 | **3** |
| carzo_logo_settings | fallback + placement video | URL video filled | files present | mixed | fallback file-only |
| carzo_media_settings | **17 canonical runtime slots** (5 general + 12 magnetic covers) | all video/cover URLs filled | files also present | mostly both | image legacy |
| carzo_site_settings | about/home/car_mat URLs | filled where used | some files empty | mixed | site_flag empty |
| carzo_pages | seo_image_url | empty | empty | 0 | 0 |
| carzo_page_blocks | image_url | mixed | mixed | mixed | some |

### 7.3 Directus files store

| Metric | Value |
|---|---|
| Files | 37 |
| Storage | all `s3` |
| Types | 14 jpeg, 14 png, 8 mp4, 1 svg |
| Folders | 21 in one folder, 16 root |
| Runtime need after cutover | **none** |

### 7.4 Classification

1. **Already fully on R2** for production display paths used by homepage/product/gallery/most content (URL-first).
2. **R2 primary + Directus file fallback remains** — gallery, content sections, media settings, site settings.
3. **Still only in Directus Files** — `carzo_designs.selector_image` (all 3), 3 `rich_section_images`, logo fallback image, some legacy companions.
4. **Local fallback assets** — `public/flag-ua.svg`, default design placeholder `/Без_имени-1.jpg`, seed assets in `content/` / `public/`.
5. **Obsolete after cutover** — every `directus_files` UUID field and `/api/directus-assets/[id]`.
6. **Duplicated R2 + Directus** — most URL+file pairs.
7. **Broken/inaccessible** — not systematically probed object-by-object (network HEAD of every object is a **Stage 2A media completion / verification** task). Host convention is consistent.
8. **Unreferenced Directus files** — possible among 37 files; full ref-count check belongs to media completion stage.

### 7.5 Final media requirement (acceptance)

After cutover there must be zero runtime dependency on:

- Directus Files / UUIDs
- `/assets/<uuid>`
- `/api/directus-assets/[id]`
- `DIRECTUS_URL` / `DIRECTUS_READ_TOKEN` for media

Supabase stores only stable R2 URLs / object keys. Binaries stay on R2 (not Supabase Storage).

---

## 8. Repository dependency matrix

Classification legend: **runtime-critical**, **runtime-fallback**, **admin/dev-tooling**, **migration-tooling**, **test-only**, **documentation-only**, **legacy/dead-candidate**.

| File / module | Directus dependency | Domain | R/W | Runtime? | Target replacement | Delete after cutover? |
|---|---|---|---|---|---|---|
| `lib/content/directus.ts` | GET `/items/*` catalog+content+settings | content/catalog | R | **runtime-critical** | Supabase content/catalog repos | yes |
| `lib/pages/directus.ts` | GET pages/blocks; preview | CMS pages | R | **runtime-critical** | Supabase page repo | yes |
| `lib/content/resolver.ts` | consumes Directus-shaped data | product content | R | runtime-critical | keep domain API, swap source | keep (maybe slim) |
| `lib/content/default-source.ts` | local fallback content | fallback | — | **runtime-fallback** | keep editorial fallback; remove pricing fallbacks | partial |
| `lib/content/homepage.ts` | GET site_settings | homepage | R | runtime-critical | homepage_settings | rewrite source |
| `lib/content/about.ts` | GET site_settings | about | R | runtime-critical | about settings | rewrite source |
| `lib/content/global-modals.ts` | GET benefit_modals | modals | R | runtime-critical | benefit_modals table | rewrite source |
| `lib/content/car-mat-designs.ts` | GET site_settings car_mat_* | car mats | R | runtime-critical | car_mat settings | rewrite source |
| `lib/content/site-flag.ts` | GET site_settings | chrome | R | runtime-critical | site_settings | rewrite source |
| `lib/content/types.ts` | Directus DTO shapes | types | — | runtime | keep domain types | keep |
| `lib/media.ts` | `directusAssetUrl`, `resolveMediaUrl` | media | R | **runtime-critical** | R2 URL only | **remove Directus branch** |
| `lib/pages/directus.ts` asset helper | `/api/directus-assets` | media | R | runtime-critical | drop | yes |
| `app/api/directus-assets/[id]/route.ts` | proxy `/assets/{id}` | media | R | runtime-fallback | none — delete route | **yes** |
| `lib/cart/server.ts` | GET variants/sizes/fixations/brands/pricing for quote | pricing | R | **runtime-critical** | catalog repository + fail-closed | rewrite |
| `app/actions/checkout.ts` | POST `/items/carzo_orders` (`writeOrder`) | orders | **W** | **runtime-critical** | Supabase order write / RPC | rewrite |
| `lib/order-notifications.ts` | GET notification + telegram settings; optional Directus notify; Telegram API | notifications | R/W | **runtime-critical** | settings table + env secret | rewrite |
| `lib/cart/customer-store/directus.ts` | `/items/customers` + `site_settings.customers` | customers | R/W | runtime (when `CUSTOMER_STORE=directus`) | `public.customers` | yes after flip |
| `lib/cart/customer-store/supabase.ts` | Supabase | customers | R/W | runtime (when flipped) | keep | keep |
| `lib/cart/customer-store/config.ts` | `CUSTOMER_STORE` | customers | — | runtime | remove flag after full cutover | yes |
| `lib/cart/customer-store/index.ts` | store factory | customers | — | runtime | single Supabase store | slim |
| `lib/cart/checkout-reliability.ts` | post-order side effects | orders | — | runtime-critical | keep semantics | keep |
| `lib/cart/order-audit.ts` | loyalty JSON into manager_note | orders | — | runtime | structured loyalty columns | rewrite |
| `lib/cart/loyalty.ts` / `loyalty-math.ts` / `pricing.ts` | pricing math | commerce | — | runtime-critical | keep | keep |
| `lib/supabase/server.ts` | Supabase admin client | customers/future | R/W | runtime-critical | expand as data layer | keep |
| `app/api/draft/route.ts` | preview via pages loader | preview | R | runtime | keep secret preview | rewrite source |
| `app/case/design/[...slug]/page.tsx` | product page via content resolver | product | R | runtime-critical | keep UI | keep |
| `app/[...slug]/page.tsx` | CMS pages | pages | R | runtime-critical | keep UI | keep |
| `app/sitemap.ts`, `app/llms.txt/route.ts` | page/product listings | SEO | R | runtime-critical | Supabase queries | rewrite |
| `components/cms/PageRenderer.tsx` | block rendering | pages | — | runtime | keep | keep |
| `scripts/setup-directus.mjs` | **mutating** schema+seed | tooling | W | admin/dev-tooling | obsolete | **delete after freeze** |
| `scripts/validate-directus-access.mjs` | access check | tooling | R | admin/dev-tooling | obsolete | delete |
| `scripts/verify-directus-access.mjs` | verify | tooling | R | admin/dev-tooling | obsolete | delete |
| `scripts/verify-product-media.mjs` | media verify | tooling | R | admin/dev-tooling | replace with R2 checks | rewrite |
| `scripts/import-carzo-4-media.mjs` | **mutating** media import | tooling | W | migration-tooling | freeze | delete after media done |
| `scripts/migrate-customers.ts` | customer export/import | tooling | R/W | migration-tooling | superseded by Supabase import | keep until retirement |
| `directus/schema.json` | schema snapshot | docs | — | documentation-only | historical | keep as archive |
| `directus/access-control.mjs`, `navigation.mjs` | admin UI config | tooling | — | admin/dev-tooling | obsolete | delete |
| `content/carzo-pages.seed.json` etc. | local seeds | fallback | — | runtime-fallback / dev | keep as emergency content seed | partial |
| `tests/customer-store.test.ts` | customer store adapters | tests | — | test-only | update to Supabase-only | rewrite |
| `tests/checkout-*.ts` | checkout reliability | tests | — | test-only | keep + extend | keep |
| `docs/*` Directus docs | documentation | docs | — | documentation-only | archive after cutover | archive |
| `.env.example` `DIRECTUS_*` | env contract | config | — | runtime | remove after cutover | yes |

### Code that currently prevents Directus shutdown

Runtime-critical blockers (must be replaced before retirement):

1. Content/catalog reads (`lib/content/directus.ts` and friends)
2. CMS page reads (`lib/pages/directus.ts`)
3. Cart quote catalog reads (`lib/cart/server.ts`)
4. Order writes (`app/actions/checkout.ts` → `writeOrder`)
5. Notification settings reads (`lib/order-notifications.ts`)
6. Customer store Directus path (`lib/cart/customer-store/directus.ts`) while `CUSTOMER_STORE=directus`
7. Media resolution fallback (`lib/media.ts` + `/api/directus-assets/[id]`)
8. Env vars `DIRECTUS_URL`, `DIRECTUS_READ_TOKEN` (and admin token for scripts)

---

## 9. Secret / config inventory

| Secret / config | Current location | Runtime consumer | Future location | Remove after cutover? |
|---|---|---|---|---|
| `DIRECTUS_URL` | Vercel env / `.env.local` | content, pages, cart, orders, notifications, media | — | **yes** |
| `DIRECTUS_READ_TOKEN` | Vercel env (server-only) | same | — | **yes** |
| `DIRECTUS_ADMIN_TOKEN` | scripts / local | setup/verify/import scripts | migration tooling only during burn-in | **yes** after retirement |
| `DIRECTUS_PREVIEW_SECRET` | env | `/api/draft` | keep as `PREVIEW_SECRET` (non-Directus) | rename/keep |
| Telegram `bot_token` | **Directus** `carzo_telegram_bot_settings.bot_token` | `lib/order-notifications.ts` | **Vercel env** `TELEGRAM_BOT_TOKEN` (already used as override) | move out of DB |
| `TELEGRAM_BOT_TOKEN` | env (already present) | notifications | env secret | keep |
| `NOVA_POSHTA_API_KEY` | env | delivery | env secret | keep |
| Supabase service key | env `SUPABASE_SECRET_KEY` | customer store / future repos | env secret | keep |
| Nova Poshta / Telegram chat IDs | Directus settings tables | notifications | Supabase config tables (non-secret) | config stays, secrets move |

**Rule:** `bot_token` must not remain a normal application row in Supabase.

---

## 10. Order / loyalty / notification behavior (as implemented)

### Order write path
`app/actions/checkout.ts` → server quote (`lib/cart/server.ts` + pricing) → `writeOrder` POST `carzo_orders` with nested `items` → then `runPostOrderSideEffects` (notify + customer upsert).  
Post-order failures are logged and must **not** turn a persisted order into a client failure (`lib/cart/checkout-reliability.ts`).

### Loyalty
Server-authoritative pricing (`lib/cart/checkout-pricing.ts`, `loyalty-math.ts`).  
Audit payload JSON written into `manager_note` (`lib/cart/order-audit.ts`) because Directus lacks loyalty columns. Target must use structured columns.

### Notifications
Templates from `carzo_notification_settings`; recipients from `carzo_telegram_bot_settings.chat_ids` (+ env token override). Directus inbox is secondary.

### Idempotency
Known debt: no checkout attempt id / unique constraint for retry safety. Orders use client-supplied `id` (uuid) in `writeOrder`. Target design must add explicit idempotency.

---

## 11. Collection disposition

| Directus collection | Purpose | Rows | Consumers | Final disposition | Target |
|---|---|---:|---|---|---|
| carzo_designs | product designs | 3 | catalog, content targeting | MIGRATE_TO_SUPABASE | `designs` |
| carzo_sizes | sizes | 4 | catalog, shipping dims | MIGRATE_TO_SUPABASE | `sizes` |
| carzo_brands | brands + legacy logo_extra | 26 | catalog, PDP | MIGRATE_TO_SUPABASE | `brands` |
| carzo_brand_pricing | logo extra by brand | 26 | pricing | MIGRATE_TO_SUPABASE | **`brands.logo_extra`** (column merge; no separate table) |
| carzo_variants | SKU price matrix | 12 | cart quote | MIGRATE_TO_SUPABASE | `variants` |
| carzo_fixations | fixation types + extras | 4 | cart pricing | MIGRATE_TO_SUPABASE | `fixations` + `fixation_size_extras` (`size_id` → `sizes.id`) |
| carzo_size_shipping | shipping dims | 0 | catalog (empty) | MIGRATE_TO_SUPABASE | fold into `sizes.shipping_*` (no `size_shipping` table) |
| carzo_discount_tiers | qty discounts | 2 | cart pricing | MIGRATE_TO_SUPABASE | `discount_tiers` |
| carzo_gallery_images | PDP gallery | 57 | product page | MIGRATE_TO_SUPABASE (R2 refs) | `gallery_images` |
| carzo_content_sets | content targeting | 16 | product content | MIGRATE_TO_SUPABASE | `content_sets` |
| carzo_content_sections | sections | 48 | product content | MIGRATE_TO_SUPABASE | `content_sections` |
| carzo_faq_items | FAQ | 8 | product content | MIGRATE_TO_SUPABASE | `faq_items` |
| carzo_rich_sections | rich template | 4 | product content | MIGRATE_TO_SUPABASE | `rich_sections` |
| carzo_rich_section_images | rich images | 12 | product content | MIGRATE_TO_SUPABASE | `rich_section_images` |
| carzo_benefit_modals | modals | 6 | global modals | MIGRATE_TO_SUPABASE | `benefit_modals` |
| carzo_logo_settings | logo block settings | 1 | product page | MIGRATE_TO_SUPABASE | `logo_settings` |
| carzo_logo_placements | per design/size logo imgs | 0 | product page | **DROP_AS_LEGACY_UNUSED / ARCHIVE_ONLY** | no target table (empty) |
| carzo_media_settings | global media/videos | 1 | product page | MIGRATE_TO_SUPABASE | **`product_media`** (final; R2 URLs only) |
| carzo_site_settings | god-singleton | 1 | homepage/about/reviews/car mats/flags | **split** MIGRATE_TO_SUPABASE | `site_settings`, `homepage_settings`, `about_settings`, `review_settings`, `video_review_settings`, `car_mat_settings` |
| carzo_pages | CMS pages | 4 | CMS | MIGRATE_TO_SUPABASE | `pages` |
| carzo_page_blocks | CMS blocks | 5 | CMS | MIGRATE_TO_SUPABASE | `page_blocks` |
| carzo_orders | orders | 10 | checkout, history | MIGRATE_TO_SUPABASE | `orders` |
| carzo_order_items | order lines | 17 | checkout | MIGRATE_TO_SUPABASE | `order_items` |
| carzo_notification_settings | templates/channels | 1 | notifications | MIGRATE_TO_SUPABASE (non-secret) | `notification_settings` |
| carzo_telegram_bot_settings | bot token + chats | 1 | notifications | **split** | chat_ids → `notification_settings`; **bot_token → REPLACE_WITH_ENV_SECRET** |
| carzo_group_* (6) | Directus UI folders | — | Admin UI | DROP_AS_DIRECTUS_UI_METADATA | — |
| site_settings.customers JSON | legacy customers | 5 | customer-store fallback | **already superseded** by `public.customers` | DROP as source (archive) |
| Directus files | media binaries | 37 | media fallback | REPLACE_WITH_R2_REFERENCE | R2 keys/URLs in app tables |

Counts:
- MIGRATE_TO_SUPABASE: **24** collections (data migrates; `carzo_brand_pricing` merges into `brands.logo_extra`; `carzo_site_settings` splits; `carzo_size_shipping` folds into `sizes`)
- DROP_AS_LEGACY_UNUSED / ARCHIVE_ONLY: **1** collection (`carzo_logo_placements`, empty)
- REPLACE_WITH_R2_REFERENCE: media fields (not whole collections) + Directus files (**Stage 2A**)
- REPLACE_WITH_ENV_SECRET: telegram bot token (+ existing env secrets)
- DROP_AS_DIRECTUS_UI_METADATA: **6** groups
- DROP_AS_LEGACY_UNUSED / archive: inactive flow, unused legacy fields (documented in §6), `directus_user_ids` (not migrated)

---

## 12. Dead / legacy candidates

| Candidate | Why | Safe to drop after cutover? |
|---|---|---|
| `carzo_group_*` | UI only | yes |
| `carzo_size_shipping` | empty; fold into `sizes.shipping_*` | yes — **no separate target table** |
| `carzo_logo_placements` | empty | **do not create target table** (ARCHIVE_ONLY / DROP_AS_LEGACY_UNUSED) |
| `carzo_brands.logo_extra` | superseded by `carzo_brand_pricing.logo_extra` → merge into `brands.logo_extra` | yes (legacy field not authoritative) |
| `carzo_sizes.shipping_*` | empty legacy | yes |
| `carzo_rich_sections.image/external_url/design` | moved to rich_section_images | yes |
| `site_settings.customers` | Supabase customers done | yes after migration verified |
| `notification_settings.telegram_chat_ids` | bot settings preferred | yes |
| `orders.customer_email` | historical only | keep column for history |
| inactive Directus flow | unused | yes |
| `directus_user_ids` notifications | optional | drop |
| scripts `setup-directus`, `import-carzo-4-media`, `verify/validate-directus` | Directus lifecycle | delete after retirement |
| `/api/directus-assets/[id]` | media proxy | delete after media completion |
| `CUSTOMER_STORE=directus` path | dual backend | delete after unified cutover |

---

## 13. Security notes

1. Tokens used for this audit were not written into docs or git.
2. `carzo_telegram_bot_settings.bot_token` is a live secret inside Directus data — must migrate to env before Directus shutdown and must not land in Supabase as a normal column.
3. Storefront uses a read token with broad `/items` read on application collections — target should not expose unrestricted browser SQL/API.
4. `customers` in Supabase has RLS enabled but no policies; access is service-role only. Document this explicitly in target RLS.
5. Checkout already avoids echoing response bodies that may contain PII — preserve that.

---

## 14. Audit limitations / follow-ups (not blocking planning)

1. Per-object HEAD validation of every R2 URL was not performed (Stage verification item).
2. Directus `/items/customers` is 403/absent; customer-store fallback path to `site_settings.customers` has only 5 rows vs 5994 in Supabase — bulk customers already live in Supabase via completed import.
3. Webhooks API not available/enabled; flow is inactive so no active platform automation detected.
4. Full permissions matrix (role×collection) summarized by counts only; enough to know admin UI roles exist.
5. Media file ref-count against Directus Files (orphans among 37) is deferred to media completion checks.

---

## 15. Conclusion

Live Directus still holds **all** structured application data used by the storefront except customers (already in Supabase). Media is **mostly R2-first** already; remaining Directus file usage is fallback/legacy. Repository has a concentrated set of runtime Directus touchpoints (content, pages, quote, order write, notifications, media fallback, customer-store directus adapter).

**Ready inputs for target architecture and master plan.** No mutations were performed.
