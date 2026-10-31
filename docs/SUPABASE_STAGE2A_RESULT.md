# SUPABASE STAGE 2A RESULT

## Baseline

- date/time: 2026-10-07 (UTC)
- branch: `dev`
- baseline Git SHA: `9cdd0586a27b2d5e274ad2178de5ed0f38b639bc`
- Supabase project: `Carzo` / `kmhegysmtsjqtwwaacht`
- Stage 2 reference: `docs/SUPABASE_STAGE2_RESULT.md` — **Stage 2: PASS** (Stage 2A not started at that time)
- pre-Stage-2A gap counts:
  - `designs.selector_image_url` NULL: **3** (`2-0`, `3-0`, `4-0`)
  - `rich_section_images.media_url` NULL (rich-magnets): **3**
  - `logo_settings.fallback_image_url` NULL: **1**
  - `product_media` missing canonical slot: **1** (`magnetic_system_default_cover`)
  - total critical unresolved refs: **8**

## Inventory

- Directus files total: **37**
- referenced files (any live field): majority of 37; critical file-only subset below
- critical unresolved refs before: **8**
- unique required source files: **3**
- intentional empty refs: **2** `content_sections` (`fixation-bottom`, `fixation-wall`)
- legacy/unreferenced files: remaining Directus files with stable R2 companions or no live target field — **not copied** (out of Stage 2A critical scope)
- unexpected drift: **none**

### Unique source files

| Directus file UUID | filename_download | MIME | size | SHA-256 |
|---|---|---|---:|---|
| `d3bb1465-a5a6-40a5-9493-2f444931a026` | Без_имени-1.jpg | image/jpeg | 342579 | `500c2c0544b15c55f31b7ea084d9d8d276ea22317b23edb6d8224f15e5f25a3e` |
| `0c724340-1362-45fa-af6f-42e7c3379b16` | magnetic-system.jpg | image/jpeg | 247992 | `241ac94b97a8c7b60c12457c9feea820b68bdc004380eb14cc52129e57d192db` |
| `d5cfd8b2-c687-40d0-b0ce-88b5a5fc1b23` | Магнітна система 4.0.jpg | image/jpeg | 97129 | `d1537c73fd0e69cdce0a9b516f871a301d273903e77a4c8390abd9a7ea1f7f0a` |

Shared binaries intentionally uploaded **once** (no artificial per-ref duplicates).

## Mapping

| target table.field | key/slug/slot | source file UUID | MIME | R2 object key | public URL | action | SHA-256 |
|---|---|---|---|---|---|---|---|
| `designs.selector_image_url` | `2-0` | `d3bb1465…` | image/jpeg | `content/products/case/designs/selector-default.jpg` | https://media.carzo.com.ua/content/products/case/designs/selector-default.jpg | COPY | `500c2c05…` |
| `designs.selector_image_url` | `3-0` | `d3bb1465…` | image/jpeg | same as above (REUSE URL) | same | COPY (1 object) | `500c2c05…` |
| `designs.selector_image_url` | `4-0` | `d3bb1465…` | image/jpeg | same as above (REUSE URL) | same | COPY (1 object) | `500c2c05…` |
| `rich_section_images.media_url` | `2-0:rich-magnets` | `0c724340…` | image/jpeg | `content/products/case/rich-content/design-2.0/magnets.jpg` | https://media.carzo.com.ua/content/products/case/rich-content/design-2.0/magnets.jpg | COPY | `241ac94b…` |
| `rich_section_images.media_url` | `3-0:rich-magnets` | `0c724340…` | image/jpeg | same as above (REUSE URL) | same | COPY (1 object) | `241ac94b…` |
| `logo_settings.fallback_image_url` | logo_settings | `d3bb1465…` | image/jpeg | `content/products/case/designs/selector-default.jpg` | same as selectors | COPY (1 object) | `500c2c05…` |
| `product_media` | `magnetic_system_default_cover` | `0c724340…` | image/jpeg | `content/products/case/rich-content/design-2.0/magnets.jpg` | same as 2-0/3-0 magnets | COPY (1 object) | `241ac94b…` |
| `rich_section_images.media_url` | `4-0:rich-magnets` | `d5cfd8b2…` | image/jpeg | `content/products/case/rich-content/design-4.0/magnets.jpg` | https://media.carzo.com.ua/content/products/case/rich-content/design-4.0/magnets.jpg | COPY | `d1537c73…` |

- unresolved reference count: **8**
- unique Directus source file UUID count: **3**
- reused duplicate binaries across refs: **yes** (1 object per unique UUID)

## R2 result

- bucket name: `carzo-media`
- public base URL: `https://media.carzo.com.ua`
- copied objects: **3**
- reused objects: **0** (no pre-existing matching keys)
- collisions: **0**
- failures: **0**
- public verification: **3/3 HTTP 200**, `Content-Type: image/jpeg`, non-zero bytes
- hash equality: **3/3** public SHA-256 == Directus source SHA-256

## Supabase updates

- design selector URLs updated: **3** (`2-0`, `3-0`, `4-0`)
- rich_section_images URLs updated: **3** (`2-0:rich-magnets`, `3-0:rich-magnets`, `4-0:rich-magnets`)
- logo fallback updated: **yes**
- product_media row inserted: `magnetic_system_default_cover`
- final product_media count: **17**

Applied via Supabase MCP (narrow media-only SQL). Affected rows: designs 3, rich_section_images 3, logo_settings 1, product_media 1.

## Intentional empty content

| content_sections.key | source `external_url` | source `image` | classification | final action |
|---|---|---|---|---|
| `fixation-bottom` | absent | absent | INTENTIONAL_EMPTY | keep `media_url` NULL |
| `fixation-wall` | absent | absent | INTENTIONAL_EMPTY | keep `media_url` NULL |

## Verification

- critical gaps after:
  - `designs.selector_image_url` NULL: **0**
  - required rich-magnets `media_url` NULL: **0**
  - `logo_settings.fallback_image_url` NULL: **0**
  - missing canonical product_media slots: **0**
- Directus refs in target media fields after: **0**
  - scanned for `directus-production-`, `/assets/`, `/api/directus-assets/`
- public URL verification: **PASS** (3/3)
- hash equality: **PASS** (3/3)
- structured row-count invariants: **PASS**
  - designs=3, sizes=4, brands=26, variants=12, fixations=4, fixation_size_extras=16, discount_tiers=2
  - gallery_images=57, content_sets=16, content_sections=48, faq_items=8
  - rich_sections=4, rich_section_images=12, benefit_modals=6, logo_settings=1
  - site_settings=1, homepage_settings=1, about_settings=1, review_settings=1
  - video_review_settings=1, car_mat_settings=1, pages=4, page_blocks=5, notification_settings=1
  - product_media=17 (16 → 17 expected)
- customers unchanged: **yes** (5994)
- orders/order_items unchanged: **yes** (10 / 17)
- migration history unchanged: **yes**
  - `20261001203704`, `20261001211849`, `20261001213417`, `20261007101747`, `20261007114221`
- RLS/security unchanged: **yes** (no schema/RLS/policy/grant mutations)

## Safety

- Directus mutations: none (GET only)
- R2 deletions: none
- schema migrations: none
- runtime changes: none
- env secrets committed: none
- deploy: none
- cutover: none
- Stage 3: not started

## Tooling

- script: `product-page/scripts/complete-directus-media-to-r2.ts`
- pure helpers: `product-page/scripts/complete-directus-media-to-r2/transform.ts`
- tests: `product-page/tests/complete-directus-media-to-r2.test.ts` — **11/11 PASS**
- modes: `--inventory`, `--dry-run`, `--apply`, `--verify`
- S3 client: `@aws-sdk/client-s3@3.758.0` (pinned)

## Final status

**Stage 2A: PASS**

critical Directus-file-only production media dependencies = **0**
