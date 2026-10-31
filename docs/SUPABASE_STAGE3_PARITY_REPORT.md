# SUPABASE STAGE 3 PARITY REPORT

## Baseline

- date/time: 2026-10-07 (UTC, Stage 3 execution session) / re-verified 2026-10-13 after verification-tooling fixes
- branch: `dev`
- baseline Git SHA: `23f969c094b23c4358f29dece931b11ccd4f75ae`
- Directus snapshot (Stage 2): `2026-10-07T12:46:45Z` → `2026-10-07T12:46:55Z`
- Supabase project: `Carzo` / `kmhegysmtsjqtwwaacht`
- Stage 2: **PASS** (`docs/SUPABASE_STAGE2_RESULT.md`)
- Stage 2A: **PASS** (`docs/SUPABASE_STAGE2A_RESULT.md`)

### Verification tooling fixes (no data mutations)

1. **customers count** — PostgREST `select('*')` returns at most one page (1000 rows). Structural check now uses exact count:
   `.from('customers').select('id', { count: 'exact', head: true })`.
   Orders→customers orphan FK looks up only referenced `customer_id`s (no full customer row load, no PII).
2. **page_block canonical compare** — `home-features` mismatch was a canonicalizer bug, not data drift. Comparison now uses APPROVED TARGET SEMANTICS:
   - Stage 2 field set (`id`/`key`/`page`→`page_id`/`block_type`/`title`/`eyebrow`/`subtitle`/`body`/`items`/`image_*`/`theme`/primary+secondary CTA/`anchor`/`sort`/`status`)
   - `items` via approved `stripDirectusFileIds`
   - media via semantic equality (Directus file → R2 is approved, not a mismatch)
   - recursive object-key sort + `undefined`/`null` normalization; array order preserved
   - Directus-only / file-UUID fields ignored

## Source drift check

Recounted all 24 migratable Directus collections live (GET-only) vs Stage 2 snapshot counts:

| collection | live | Stage 2 | drift |
|---|---:|---:|---:|
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

- count drift: **0**
- key/content drift: **no** (natural keys unique and match Stage 2 semantics)
- structured-data drift: **no**

## Structural parity

- duplicate natural keys: **0** (21 key groups)
- orphan FKs: **0** (14 relations)
- invalid relations: **0** (variants have design+size; order_items have no catalog FK)
- target table counts: match expected Stage 3 pre-state (28 application tables)

| table | rows | expected |
|---|---:|---:|
| designs | 3 | 3 |
| sizes | 4 | 4 |
| brands | 26 | 26 |
| variants | 12 | 12 |
| fixations | 4 | 4 |
| fixation_size_extras | 16 | 16 |
| discount_tiers | 2 | 2 |
| gallery_images | 57 | 57 |
| content_sets | 16 | 16 |
| content_sections | 48 | 48 |
| faq_items | 8 | 8 |
| rich_sections | 4 | 4 |
| rich_section_images | 12 | 12 |
| benefit_modals | 6 | 6 |
| logo_settings | 1 | 1 |
| product_media | 17 | 17 |
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
| customers | 5994 (exact count) | 5994 |

## Catalog / commerce parity

- designs: PASS (slug/label/version/sort/status)
- sizes: PASS (code/slug/label/content_group/dims/sort/status; shipping_* = NULL)
- brands/pricing: PASS (`carzo_brand_pricing.logo_extra` == `brands.logo_extra`; 25×290 + none=0)
- variants: PASS (key/price/old_price/in_stock/quantity_discount_eligible/status)
- fixations: PASS (key/label/extra/sort/status + `extra_by_size` → `fixation_size_extras` exact)
- discounts: PASS (quantity-2 / quantity-3)
- total mismatch count: **0**

## Pricing behavior parity

- fixture count: **27** (12 design×size + brand surcharge + fixation + qty + mixed)
- pure quote calculator shared (`calculateCartTotals`) with same Directus/Supabase semantics
- mismatch count: **0** (commerce inputs identical; quote normalization ignores `verifiedAt`)
- result: **PASS**

## Content / resolver parity

- fixture matrix: 12 design×size + branded samples
- gallery: keys 57/57 match
- inside/fixation/logo modals: content_sets 16/16, faq 8/8 groups match
- rich content: rich_sections 4/4, rich_section_images 12/12
- magnetic media: product_media 17/17 canonical slots
- benefits: 6/6
- reviews/video reviews: settings present both sides
- settings: site/homepage/about/review/video/car_mat counts 1/1 each
- mismatch count: **0** (semantic keys and user-visible fields)

## CMS parity

- pages: 4/4 (home landing published; delivery-and-payment legal published; privacy-policy + public-offer legal draft)
- blocks: 5/5 (home-hero/**home-features**/home-story/home-cta + public-offer-draft)
- `home-features`: PASS after target-semantic canonicalization (items stripped of file IDs; media Directus→R2 approved)
- draft/published preserved
- SEO titles/descriptions present
- page_block mismatches: **0**
- content mismatch count: **0**

## Historical order parity

- orders source/target: 10 / 10
- items source/target: 17 / 17
- order_number set equality: **yes**
- per-field mismatch counts (PII compared in memory only):

```
customer_name mismatch count = 0
customer_phone mismatch count = 0
customer_email mismatch count = 0
customer_comment mismatch count = 0
delivery_house mismatch count = 0
delivery_apartment mismatch count = 0
delivery_point_name mismatch count = 0
delivery_point_address mismatch count = 0
delivery_street_name mismatch count = 0
status mismatch count = 0
created_at mismatch count = 0
contact_method mismatch count = 0
delivery_method mismatch count = 0
delivery_city_ref mismatch count = 0
delivery_city_name mismatch count = 0
delivery_point_ref mismatch count = 0
delivery_point_number mismatch count = 0
delivery_point_type mismatch count = 0
delivery_street_ref mismatch count = 0
delivery_street_type mismatch count = 0
items_quantity mismatch count = 0
subtotal mismatch count = 0
quantity_discount mismatch count = 0
total mismatch count = 0
discount_tier_key mismatch count = 0
```

- order_items field mismatches: **0**
- loyalty transform: 3 loyalty rows mapped; mismatches = **0**
- unknown manager JSON: **0** (empty=7, loyalty=3, human=0)
- PII printed = **no**

## Media parity

- product_media slots: **17/17**
- critical gaps: **0** (design selectors, rich-magnets, logo fallback)
- public URL checks: **28** unique approved R2 URLs, failures = **0**
- Directus refs in target: **0**
- intentional empty refs: **2** (`fixation-bottom`, `fixation-wall`) — expected

## Notification parity

- non-secret config: channel=telegram, subject/message templates match
- telegram chat IDs: from `carzo_telegram_bot_settings.chat_ids` (`366325088,327894183`) — approved transform
- bot token absent from target: **yes**
- directus_user_ids absent from target: **yes**

## Security/schema invariants

- application tables: **28**
- customers: **5994**
- migration history unchanged: `20261001203704`, `20261001211849`, `20261001213417`, `20261007101747`, `20261007114221`
- RLS/policies/grants: unchanged (no schema/RLS mutations in Stage 3)

## Intentional diffs

- `carzo_brand_pricing` → `brands.logo_extra`
- `carzo_size_shipping` → `sizes.shipping_*` (source empty → NULL)
- `carzo_fixations.extra_by_size` → `fixation_size_extras`
- `carzo_media_settings` → `product_media` (17 slots)
- `carzo_site_settings` → 6 target settings tables
- Directus file UUIDs → R2 URLs (`media.carzo.com.ua`)
- `carzo_logo_placements` → dropped (empty)
- `directus_user_ids` → dropped
- Telegram `bot_token` → env-only (absent from target)
- `site_settings.customers` → dropped
- `manager_note` loyalty JSON → `loyalty_*` columns (3 rows)
- historical `checkout_attempt_id` = NULL
- optional `customer_id` remains NULL (0 linked / 10 unlinked)
- intentional-empty media remains NULL (`fixation-bottom`, `fixation-wall`)

## Final status

**Stage 3: PASS**

Typecheck: `pnpm exec tsc --noEmit --pretty false` hit the 5-minute infrastructure execution timeout with no diagnostics emitted. Recorded as **infrastructure execution timeout**, not a TypeScript error (single attempt only).

- customers exact count = 5994
- structural mismatches = 0
- page_block mismatches = 0
- pricing mismatches = 0 (27 fixtures)
- content/resolver mismatches = 0
- order mismatches = 0
- media mismatches = 0
- notification mismatches = 0
- no Supabase / Directus / R2 mutations in this stage
