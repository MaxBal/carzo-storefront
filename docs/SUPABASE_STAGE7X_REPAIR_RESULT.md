# Supabase Stage 7.x — Editorial Read Repair Result

Date: 2026-11-01 (UTC+2)
Scope: `CARZO_STAGE_7X_CONTENT_READ_REPAIR.md` — bounded corrective implementation
on `dev`. Stage 7 is **not** closed by this document; see §10.

---

## 1. STATUS

**`Stage 7.x corrective work = PASS`** (D-1 closed by owner decision — see §6)

| Area | Result |
|---|---|
| Step 1 — Supabase editorial SELECT/mapping repair | **PASS** (live PostgREST proof, 7/7 integration tests) |
| Step 2 — D-2 Directus reads in switched content paths | **PASS** (facade routing + fetch-spy proof, zero Directus reads) |
| Step 3 — D-1 car-mat placeholder | **PASS (closed by removal)** — owner cancelled the landscape placeholder entirely; it is removed from the car-mat UI and runtime (both backends), no R2 upload needed (§6) |
| Step 4 — Automated validation | **PASS** (164/164 tests, tsc, lint) |
| Step 5 — Preview deploy + QA boundary | **PASS for build gate**; browser/visual QA **NOT VERIFIED** |
| Step 6 — Documentation | this file |
| Stage 7 as a whole | **BLOCKED** — visual QA NOT VERIFIED (browser gate) |

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
| Follow-up commits | `e990ffe` — `docs: record stage 7.x editorial repair result`; `02f3eaa` — `fix: remove car-mat landscape placeholder per owner decision` (D-1 v2, see §6) |
| `main` (before / after) | `df8f3531ff9de2408525ac5caf6844d8c6e4d340` — **unchanged**; only `git push origin dev` was executed |
| Production deployment (before / after) | `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9` → `carzo-storefront-f3up8jypj-yevgens-projects.vercel.app`, READY, created 2026-10-31 12:33:30Z — **identical ID both times** |
| Preview deployment (current) | `dpl_89sGuJHKcbhsUtT1UiQj4C3Z7jJS` → `carzo-storefront-oftz3ocn6-yevgens-projects.vercel.app`, **READY**, build 36s (commit `02f3eaa`) |
| Preview deployment (earlier gate) | `dpl_EKstzxhVca1zLC822zkyyZdCNcin` → `carzo-storefront-os1ahkxon-yevgens-projects.vercel.app`, READY, build 41s (commit `9d84917`) |
| Preview Git alias | `carzo-storefront-git-dev-yevgens-projects.vercel.app` → current `dev` deployment |
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

## 6. D-1 — car-mat design placeholder (CLOSED by owner decision)

**Owner decision (2026-11-03): the landscape placeholder is cancelled entirely.**
`landscape-placeholder.svg` is an unwanted technical stub and must not be used
on the car-mat surface. D-1 is therefore closed **by removing the element**,
not by migrating a file to R2. No replacement image was invented.

What was done:

1. **No R2 upload.** The previously prepared `content/car-mats/landscape-placeholder.svg`
   upload is cancelled and was never performed (the local R2 write credentials
   returned 401 and no retry loop was run; no R2 keys were created or changed).
2. **Removed from the car-mat UI.** `components/DesignVariantsModal.tsx` no
   longer takes a `placeholderImage`, no longer renders the fallback image
   layer (`EMERGENCY_PLACEHOLDER`, `.dvm-img-fallback`), and renders the image
   block **only while a real design photo is present and has not failed** —
   a design without an image shows the selector/text content with **no image
   block at all** (no fake picture, no broken `<img>`).
3. **Removed from the car-mat runtime on both backends.**
   `getCarMatMediaPlaceholder()` / `loadCarMatMediaPlaceholder()` /
   `loadDirectusCarMatMediaPlaceholder()` and the `CarMatContent.placeholderImage`
   field are deleted. This also removes the legacy Directus
   `/api/directus-assets/8448fa94-89cd-4f2a-8596-fa871d7144bd` lookup (the
   502/403 proxy path) from the car-mat request path on the rollback backend.
4. **`car_mat_settings.placeholder_image_url` usage audit → dropped.** The
   column had been added exclusively for this placeholder and had zero other
   consumers; it was NULL in every row. Removed by the separate additive-free
   migration `20261103125918_stage7x_drop_car_mat_placeholder_url`
   (`supabase/migrations/20261103125918_stage7x_drop_car_mat_placeholder_url.sql`).
   Rollback: re-add the nullable column (lossless in both directions).
5. **`site_settings.media_placeholder_url` usage audit → kept.** It is not
   car-mat-specific: `lib/content/resolver.ts` feeds it into the PDP
   gallery/rich-section/magnetic-poster `fallbackSrc` chain
   (`components/ManagedProductImage` renders it when a real product photo is
   missing or fails to load), and the untouched Directus adapter resolves the
   same value from `carzo_media_settings`. Per the instruction it was **not**
   removed blindly; deleting it would change PDP behaviour outside the car-mat
   scope. The R2-upload spec for a car-mat object is therefore obsolete.
   Note: `DEFAULT_CONTENT_SOURCE.siteSettings.mediaPlaceholder` still points at
   `/media/landscape-placeholder.svg` **for that PDP fallback chain only**;
   car-mat code has zero references to the file.

Runtime evidence (`vercel curl`, deployment `dpl_89sGuJHKcbhsUtT1UiQj4C3Z7jJS`):
`/catalog-carmat` renders with `0` `placeholderImage` props, `0`
`landscape-placeholder` refs, `0` `/api/directus-assets/` refs, `0` `directus`
refs; real car-mat media (`…/car-mats/promo-video.mp4`,
`…/car-mats/cover-video.webp`) and design variant content still render.
`/` and `/about` unchanged (R2 logo video / process images intact).

**D-1 verdict: CLOSED — placeholder removed per owner decision.**

## 7. Supabase / R2 mutation inventory

| Mutation | Scope | Rollback |
|---|---|---|
| `alter table car_mat_settings add column placeholder_image_url text` | additive DDL, owner-approved (`20261101172930`) | superseded by the drop below |
| `alter table site_settings add column media_placeholder_url text` | additive DDL, owner-approved (`20261101172930`); feeds the PDP fallback chain — **kept** | `drop column` (column currently NULL) |
| `alter table car_mat_settings drop column placeholder_image_url` | owner decision to remove the cancelled placeholder (`20261103125918`); column was NULL in every row — lossless | re-add nullable text column |
| Data updates | **none** | n/a |
| R2 writes | **none** (upload cancelled; 401 on local keys, no retries, no new keys) | n/a |
| Directus writes | **zero** | n/a |
| Orders / customers / Telegram | **zero** | n/a |

## 8. Preview QA boundary (HTTP-level only)

Latest deployment `dpl_89sGuJHKcbhsUtT1UiQj4C3Z7jJS` (READY) — current `dev`:

| Route | Result | Evidence |
|---|---|---|
| `/` | 200 | hero + homepage logo video from `homepage_settings` (R2); 0 `directus` refs |
| `/about` | 200 | hero text + `about/develop.webp` from `about_settings` |
| `/catalog-carmat` | 200 | **0** `placeholderImage`, **0** `landscape-placeholder`, **0** `/api/directus-assets/`, **0** `directus` refs; promo video/cover (R2) and design variant text intact |

Earlier deployment `dpl_EKstzxhVca1zLC822zkyyZdCNcin` (commit `9d84917`)
verified the pre-decision state (placeholder served locally, 0 proxy refs).

**Browser/interactive QA: NOT VERIFIED.** (Modal open/close, sticky CTA, tabs,
cropping, mobile layout, autoplay, cart drawer.) Browser automation was refused
in Stage 7 and is not re-attempted here. HTTP-level rendering is **not** a
substitute. `Stage 7 visual QA = NOT VERIFIED` — Stage 7 stays **BLOCKED**
until a separate authorized/manual visual test runs.

## 9. P0/P1 defects remaining

| ID | Severity | State |
|---|---|---|
| D-1 | P1 | **CLOSED** — placeholder removed per owner decision (§6) |
| D-2 | P1 | **CLOSED** |

No new P0/P1 introduced by this change.

## 10. Verdict separation

- **`Stage 7.x code repair = PASS`** for Steps 1/2/4 (editorial SELECTs,
  mappings, D-2 routing, tests) and for the build gate.
- **`Stage 7.x D-1 = PASS (closed by removal)`** — owner cancelled the
  landscape placeholder; car-mat UI/runtime has no placeholder and no Directus
  asset-proxy path.
- **`Stage 7 visual QA = NOT VERIFIED`** (browser gate).
- **`Stage 7 = BLOCKED`** overall until the authorized/manual visual QA matrix
  passes. Explicitly not PASS.

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
