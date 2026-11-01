# Supabase Stage 7.x — Editorial Read Repair Result

Date: 2026-11-01 (UTC+2)
Scope: `CARZO_STAGE_7X_CONTENT_READ_REPAIR.md` — bounded corrective implementation
on `dev`. Stage 7 is **not** closed by this document; see §10.

---

## 1. STATUS

**`Stage 7.x corrective work = PARTIAL`**

| Area | Result |
|---|---|
| Step 1 — Supabase editorial SELECT/mapping repair | **PASS** (live PostgREST proof, 7/7 integration tests) |
| Step 2 — D-2 Directus reads in switched content paths | **PASS** (facade routing + fetch-spy proof, zero Directus reads) |
| Step 3 — D-1 car-mat placeholder (authentic source / schema / code) | **PARTIAL** — source verified, schema applied, code routed; **R2 object upload + URL data update pending** (blocked on write access, see §6) |
| Step 4 — Automated validation | **PASS** (164/164 tests, tsc, lint) |
| Step 5 — Preview deploy + QA boundary | **PASS for build gate**; browser/visual QA **NOT VERIFIED** |
| Step 6 — Documentation | this file |
| Stage 7 as a whole | **BLOCKED** — D-1 not fully closed + visual QA NOT VERIFIED |

Per the Stage 7 rule, Stage 7 may only become PASS when the full QA matrix has
passed. This task explicitly does **not** claim that.

---

## 2. Baseline (Git / deployments)

| Item | Value |
|---|---|
| Branch | `dev` |
| Baseline HEAD (pre-work) | `4407452ab329f4c3c0ecc503078beb9814b028b8` — `docs: record stage 7 QA git and deployment state` (matches the expected baseline in the brief) |
| Worktree at baseline | clean except untracked `.DS_Store` / `.playwright-cli/` (never staged) |
| Repair commit | `9d84917` — `fix: repair supabase editorial reads and car-mat R2 media` (pushed to `dev` only) |
| `main` (before / after) | `df8f3531ff9de2408525ac5caf6844d8c6e4d340` — **unchanged**; only `git push origin dev` was executed |
| Production deployment (before / after) | `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9` → `carzo-storefront-f3up8jypj-yevgens-projects.vercel.app`, READY, created 2026-10-31 12:33:30Z — **identical ID both times** |
| Preview deployment (new) | `dpl_EKstzxhVca1zLC822zkyyZdCNcin` → `carzo-storefront-os1ahkxon-yevgens-projects.vercel.app`, **READY**, build 41s, created 2026-11-01 19:56 (local) |
| Preview Git alias | `carzo-storefront-git-dev-yevgens-projects.vercel.app` → same deployment |
| Preview build provenance | deployment auto-triggered by push of `9d84917`; build succeeded (the Vercel UI build log line `Commit: 9d84917` should be attached in the release checklist) |
| Supabase project | `Carzo`, `kmhegysmtsjqtwwaacht` — ACTIVE; read-only queries + one approved additive DDL only |
| R2 public media origin | `https://media.carzo.com.ua` |
| Deployment Protection | ON (unchanged; Preview served via `vercel curl` protection bypass) |

---

## 3. Table/column mismatch audit and corrections

Every projection consumed by `product-page/lib/data/content/supabase.ts` was
compared against live `information_schema.columns` and then executed against
live PostgREST. The adapter previously selected **non-existent columns**; any
one of those made PostgREST fail the whole `loadEditorial()`, which
`getContentSource()` then silently masked with `DEFAULT_CONTENT_SOURCE`.

| Table | Broken projection (before) | Actual columns used (after) | Mapping fix |
|---|---|---|---|
| `gallery_images` | `design_slug,size,src` | `design_id,size_id,media_url` + `designs:design_id(slug)`, `sizes:size_id(code)` | FK embeds → `designSlug`, `size` (SizeId) |
| `content_sets` | `design_slug,size` | `design_id,size_id` + `designs:design_id(slug)`, `sizes:size_id(code)` | FK embeds → `designSlug`, `size` |
| `content_sections` | `content_set_key,image_url` | `content_set_id,media_url` + `content_sets:content_set_id(key)` | FK embed → `contentSetKey` |
| `rich_section_images` | `design_slug,section_key,src` | `design_id,section_id,media_url` + `designs:design_id(slug)`, `rich_sections:section_id(key)` | FK embeds → `designSlug`, `sectionKey` |
| `logo_settings` | `logo_placement_video_url` | `placement_video_url` | direct rename |
| `product_media` | `url` | `media_url` | direct rename |
| `site_settings` | `media_placeholder_url` (column absent → guaranteed query failure) | `media_placeholder_url` **added by approved migration** (was missing) | column now exists |
| `homepage_settings` | unprefixed `hero_*`, `badges_*`, `quality_*`, `logo_video_url` | `homepage_hero_*`, `homepage_badges_*`, `homepage_quality_*`, `homepage_logo_video_url` | prefixed projection + `parseHomepageSettings` |
| `review_settings` | `enabled,title,items,screenshots,…` | `reviews_enabled,reviews_title,reviews_items,reviews_screenshots,…` | prefixed projection |
| `video_review_settings` | `enabled,title,items,social_*` | `video_reviews_enabled,video_reviews_title,video_reviews,video_reviews_social_*`, `video_reviews_stat_*` | prefixed projection (`items` → `video_reviews`) |

Additional corrections:

- `void homepageSettingsRows; void aboutSettingsRows; void carMatSettingsRows`
  removed — the three settings rows are now mapped into typed
  `EditorialContent.homepage / .about / .carMat`
  (`lib/content/settings-defaults.ts` mappers) and also served through the
  facade.
- All content tables that carry `status` are filtered `status = 'published'`
  (parity with the Directus `readCollection` filter). `product_media` has no
  `status` column and is selected unfiltered.
- `r2Url()` gate retained: Directus UUIDs/`/api/directus-assets/` refs are
  rejected in the Supabase adapter.

**Schema-drift guard:** the live integration test executes every adapter
projection and asserts a bogus column is rejected by PostgREST (so successful
selects prove column existence). One verified starting-point mismatch set was
not assumed complete — every selected column was validated.

## 4. D-2 — Directus reads in switched content paths (FIXED)

Before: `lib/content/homepage.ts`, `lib/content/about.ts`,
`lib/content/car-mat-designs.ts` fetched `{DIRECTUS_URL}/items/carzo_site_settings`
(and `carzo_media_settings`) directly, ignoring `CONTENT_STORE`.

After:

- `lib/data/content/index.ts` is the backend-neutral facade:
  `loadHomepageData`, `loadAboutData`, `loadCarMatDesigns`,
  `loadCarMatPromoMedia`, `loadCarMatMediaPlaceholder` dispatch on
  `resolveContentStoreBackend()`.
- Supabase path: `lib/data/content/supabase.ts` narrow loaders
  (`loadSupabaseHomepageSettings/AboutSettings/CarMatSettings`) — SELECT-only.
- Directus path (rollback): `lib/data/content/directus-settings.ts` preserves
  the pre-repair fetch behaviour byte-for-byte semantics (same collections,
  same fields, same fallbacks).
- The three UI modules are now thin `cache()` wrappers over the facade.
- Original Directus adapters (`lib/content/directus.ts`,
  `lib/data/content/directus.ts`, `lib/data/catalog/directus.ts`) are
  **untouched**. `CUSTOMER_STORE=directus` and the car-mat quote notifier
  remain intentional dependencies (unchanged).

**Proof (runtime, not just code search):** with `CONTENT_STORE=supabase` and
`DIRECTUS_URL` pointed at a sentinel host, an injected `fetch` spy observed the
homepage/about/car-mat facade loaders, the car-mat placeholder and a full
`loadEditorial()` run — **0 requests** to the Directus host or `/items/carzo_*`
(`tests/supabase-editorial-integration.test.ts`, "CONTENT_STORE=supabase makes
zero Directus reads for switched domains").

## 5. Live PostgREST integration proof

New suites (SELECT-only, no mutations):

| Suite | Tests | Result |
|---|---|---|
| `pnpm run test:supabase-editorial` (live) | 7 | **PASS 7/7** — projections complete; schema drift guard; 17/17 product_media slots; FK mapping (design slug / size code / set / section keys); homepage/about/car-mat/review/video-review sourced from Supabase rows (asserted field-by-field against direct table reads, with discriminators that differ from `DEFAULT_*`); zero switched-domain Directus reads; **no silent fallback** (`editorialFallbackUsed === false`); zero `/api/directus-assets/` in output |
| `pnpm run test:editorial-fallback` | 3 | **PASS 3/3** — strict loader throws on dead backend; facade logs `EDITORIAL_FALLBACK_ACTIVE` and serves DEFAULT; `getContentSource()` sets `editorialFallbackUsed = true` when the editorial backend fails (catalog fail-closed preserved) |

Editorial fallback was exercised **only** in the dedicated fallback-detection
suite (dead URL by design). The live suite asserts fallback was **not** used.

Full matrix (from `product-page`):

| Command | Tests | Result |
|---|---|---|
| `pnpm run test:stage4` | 19 | PASS |
| `pnpm run test:stage6` | 24 | PASS |
| `pnpm run test:supabase-catalog` | 8 | PASS (live PostgREST) |
| `pnpm run test:customer-store` | 32 | PASS |
| `pnpm run test:loyalty` | 37 | PASS |
| `pnpm run test:checkout-reliability` | 12 | PASS |
| `pnpm run test:order-notifications` | 22 | PASS |
| `pnpm run test:supabase-editorial` | 7 | PASS (live, new) |
| `pnpm run test:editorial-fallback` | 3 | PASS (new) |
| `pnpm exec tsc --noEmit --pretty false` | — | PASS (exit 0) |
| `pnpm run lint` | — | PASS (exit 0; pre-existing `<img>`/alt warnings only) |
| **Total** | **164** | **0 fail** |

Vercel Preview build of the pushed commit succeeded (41s, READY) — the
production-like build gate.

## 6. D-1 — car-mat design placeholder

**Authentic source located (no image invented):** Directus file
`8448fa94-89cd-4f2a-8596-fa871d7144bd` metadata (read-only, single GET):
`filename_download = landscape-placeholder.svg`, `title = Carzo:
public/media/landscape-placeholder.svg`, `type = image/svg+xml`,
`filesize = 813`. The **original repo asset is therefore
`product-page/public/media/landscape-placeholder.svg`** (813 bytes,
sha256 `7610a3cb41c030cf8b8cf7d88c377ff4fdb8950664624ce9a7c8b74a984a1b8a`).

Attempted and recorded (bounded, no retries):

- `GET {DIRECTUS_URL}/assets/8448fa94-…` with `DIRECTUS_READ_TOKEN` → 403 FORBIDDEN (matches QA).
- Same GET with the provisioned `DIRECTUS_ADMIN_TOKEN` → 403 FORBIDDEN. No permission brute force; no Directus writes.
- Cloudflare R2 API (ListBuckets / HeadObject) with the local `.env.local`
  `R2_*` credentials → **401 Unauthorized**. Public CDN reads of existing
  objects are fine (`…/car-mats/promo-video.mp4` and `…/car-mats/cover-video.webp`
  return 200). No R2 keys were created or modified.

**Approved additive schema change (owner-approved, applied via Supabase MCP,
recorded as `supabase_migrations` version `20261101172930`,
`stage7x_add_editorial_media_urls`; local file
`supabase/migrations/20261101172930_stage7x_add_editorial_media_urls.sql`):**

```sql
alter table public.car_mat_settings add column if not exists placeholder_image_url text;
alter table public.site_settings   add column if not exists media_placeholder_url text;
```

Both columns are nullable text; no existing rows were updated or deleted.
Rollback: `alter table … drop column …` (columns are currently NULL, so the
rollback is lossless). RLS/policies unchanged; no grants were touched.

**Code (done):** `getCarMatMediaPlaceholder()` now goes through the
CONTENT_STORE facade; the Supabase path reads
`car_mat_settings.placeholder_image_url` and falls back to the intentional
local `/media/landscape-placeholder.svg` (byte-identical to the authentic
asset). Preview runtime evidence (`vercel curl /catalog-carmat` on
`dpl_EKstzxhVca1zLC822zkyyZdCNcin`):
`placeholderImage = "/media/landscape-placeholder.svg"`, **0**
`/api/directus-assets/` references. The 502/403 proxy defect is gone from
published content.

**Pending (owner action) — R2 upload spec for one immutable object:**

| Field | Value |
|---|---|
| Bucket | `R2_BUCKET_NAME` from `product-page/.env.local` (existing bucket, do not create buckets/keys) |
| Object key | `content/car-mats/landscape-placeholder.svg` |
| Content-Type | `image/svg+xml` |
| Source bytes | `product-page/public/media/landscape-placeholder.svg` (813 bytes) |
| SHA-256 | `7610a3cb41c030cf8b8cf7d88c377ff4fdb8950664624ce9a7c8b74a984a1b8a` |
| Immutability | upload **once**; never overwrite/delete existing objects; if the key already exists, stop and report instead of overwriting |
| Verify after upload | `HEAD https://media.carzo.com.ua/content/car-mats/landscape-placeholder.svg` → HTTP 200, `content-type: image/svg+xml`, body hash matches |

After the object is live, one data update (approved scope) sets
`car_mat_settings.placeholder_image_url` (and `site_settings.media_placeholder_url`)
to `https://media.carzo.com.ua/content/car-mats/landscape-placeholder.svg`.
Until then the field stays NULL and the local placeholder serves.

**D-1 verdict:** `PARTIAL — awaiting R2 object upload (BLOCKED_R2_WRITE)`.
Not claimed as PASS: the local placeholder is a temporary safe fallback and is
explicitly **not** proof that the authentic R2 asset has been migrated.

## 7. Supabase / R2 mutation inventory

| Mutation | Scope | Rollback |
|---|---|---|
| `alter table car_mat_settings add column placeholder_image_url text` | additive DDL, owner-approved | `drop column` (column currently NULL) |
| `alter table site_settings add column media_placeholder_url text` | additive DDL, owner-approved | `drop column` (column currently NULL) |
| Data updates | **none yet** (placeholder URL update pending R2 upload) | n/a |
| R2 writes | **none** (no credentials; per owner decision the upload is done manually per §6 spec) | n/a |
| Directus writes | **zero** | n/a |
| Orders / customers / Telegram | **zero** | n/a |

## 8. Preview QA boundary (HTTP-level only)

| Route | Result | Evidence |
|---|---|---|
| `/` | 200 | hero title present; homepage logo video served from `media.carzo.com.ua/…/home/logo-video.mp4` (Supabase `homepage_settings` — DEFAULT is empty, so this proves live sourcing); 0 `directus` refs |
| `/about` | 200 | hero text + `about/develop.webp` from `about_settings` |
| `/catalog-carmat` | 200 | `placeholderImage="/media/landscape-placeholder.svg"`; 0 `/api/directus-assets/` refs |

**Browser/interactive QA: NOT VERIFIED.** (Modal open/close, sticky CTA, tabs,
cropping, mobile layout, autoplay, cart drawer.) Browser automation was refused
in Stage 7 and is not re-attempted here. HTTP-level rendering is **not** a
substitute. `Stage 7 visual QA = NOT VERIFIED` — Stage 7 stays **BLOCKED**
until a separate authorized/manual visual test runs **and** D-1 is fully closed.

## 9. P0/P1 defects remaining

| ID | Severity | State |
|---|---|---|
| D-1 | P1 | **OPEN (partial)** — code + schema done; R2 object + URL data update pending (§6) |
| D-2 | P1 | **CLOSED** |

No new P0/P1 introduced by this change.

## 10. Verdict separation

- **`Stage 7.x code repair = PASS`** for Steps 1/2/4 (editorial SELECTs,
  mappings, D-2 routing, tests) and for the build gate.
- **`Stage 7.x D-1 = PARTIAL`** (R2 object pending).
- **`Stage 7 visual QA = NOT VERIFIED`** (browser gate).
- **`Stage 7 = BLOCKED`** overall (unchanged; explicitly not PASS).

Stages 8–12 and permanent Directus retirement were **not** started.

## 11. P2 follow-ups (out of scope, not repaired here)

1. Legacy `carzo-eight.vercel.app` canonical host / OG / sitemap (P2-2).
2. Footer links 404 (`/delivery`, `/payment`, …) on both backends (P2-1).
3. Checkout payment details empty (`checkout_payment_details`).
4. Pexels fallback gallery rows (`gallery-fallback-*`).
5. Durable notification outbox (best-effort post-commit send).
6. Migration version filename mismatch on two Stage 6 migrations
   (`20261101120000_create_order_with_items_rpc.sql` vs remote
   `20261031164057_…`, `20261101200000_require_order_request_fingerprint.sql`
   vs remote `20261031180954_…`) — release-discipline reconciliation.
7. Supabase Free-plan pause risk — mandatory pre-Production operational
   decision (upgrade / monitoring / documented RTO).
