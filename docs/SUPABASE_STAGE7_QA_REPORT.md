# Supabase Stage 7 — Full Staging QA Report

Date: 2026-10-31 (QA run completed 2026-11-01 local)
Scope: Stage 7 of `docs/DIRECTUS_TO_SUPABASE_MASTER_PLAN.md` — comprehensive
staging QA of the existing Vercel Preview `dev` storefront (Supabase
catalog/content/pages/order-writes, Cloudflare R2 media). **QA only.**
Stage 8/9/10/11/12 were **not** started. Directus was **not** shut down.
Production `main` was **not** modified.

---

## 0. STATUS

**`STAGE 7 = BLOCKED`**

Two independent blockers; either one alone is sufficient for BLOCKED under the
Stage 7 rule ("PASS only if all required P0/P1 checks are fully verified with
adequate evidence").

1. **Visual/browser QA could not be completed.** Browser automation against the
   Preview was rejected by the local safety layer ("request was considered high
   risk"). That request was **not** retried and no bypass of the restriction was
   attempted. Every interactive-only criterion (modal open/close, sticky CTA,
   tab switching, image cropping, mobile layout, video autoplay, cart drawer
   behaviour) is therefore `NOT VERIFIED`. HTTP-level rendering evidence exists
   and is recorded below, but it is explicitly **not** a substitute for those
   checks.
2. **Two P1 defects found** by the HTTP/API/source evidence that did run
   (D-1 car-mat placeholder image broken, D-2 Directus reads inside the
   switched content domain).

Everything that *was* verifiable passed: 154/154 automated tests, typecheck,
lint, Supabase preflight, Vercel deployment identity, the full 12/12 PDP route
matrix, the price/extras/discount contract, live read-only cart quoting, and
the security/credential posture.

---

## 1. Baseline

| Item | Value |
|---|---|
| Timestamp (UTC) | 2026-10-31 ~21:00–22:15Z |
| Branch | `dev` |
| Git HEAD | `3d5ef7636c312538ba85d5572c84d43659ce8b35` — `docs: close stage 6 with telegram acceptance pass` |
| HEAD vs Stage 6 PASS baseline | **identical** (HEAD has not moved since Stage 6 close) |
| Worktree | clean except untracked `.DS_Store` ×3 and `.playwright-cli/` (local tooling logs, no secrets, not staged) |
| Vercel project | `carzo-storefront`, `prj_D6HYKiqCDNcJoMl2rah8ImaPimXW`, team `yevgens-projects`, account `unisoftaua-8604` |
| Preview deployment (immutable) | `dpl_E4B5diSxEnfpofb166gYi7zncthu` → `carzo-storefront-n9ysfnt71-yevgens-projects.vercel.app`, **READY**, created 2026-10-31 21:12:10Z |
| Preview build provenance | build log: `Branch: dev, Commit: 3d5ef76` — matches local HEAD |
| Preview Git alias | `carzo-storefront-git-dev-yevgens-projects.vercel.app` → resolves to the same deployment `dpl_E4B5diSx…` |
| Production deployment (before) | `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9` → `carzo-storefront-f3up8jypj-yevgens-projects.vercel.app`, READY, created 2026-10-31 12:33:30Z |
| Production deployment (after) | **identical id** `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9`, READY — unchanged |
| Production alias | `https://carzo-storefront.vercel.app` — observed only, never deployed or modified |
| Supabase project | `Carzo`, `kmhegysmtsjqtwwaacht`, `eu-west-1`, **ACTIVE**, Free plan |
| R2 public media origin | `https://media.carzo.com.ua` |
| Stage 5 status in repo | `PASS` (retry section of `docs/SUPABASE_STAGE5_RESULT.md`) |
| Stage 6 status in repo | `PASS` (`docs/SUPABASE_STAGE6_RESULT.md` §1 + Appendix A.1) |

Many Preview deployments exist in the last ~8h, all rebuilding the same commit
`3d5ef76` (redeploys/env-triggered, not code changes). The QA target is the
current READY deployment `dpl_E4B5diSx…`, which the Git alias resolves to.

---

## 2. Effective Preview store flags and credential inventory

Read via `vercel env pull --environment preview --git-branch dev` (values
retrieved only for the six non-secret store flags; secrets left as
`[SENSITIVE]` placeholders and never printed).

| Flag | Effective value | Expected | Result |
|---|---|---|---|
| `CATALOG_STORE` | `supabase` | supabase | PASS |
| `CONTENT_STORE` | `supabase` | supabase | PASS |
| `PAGE_STORE` | `supabase` | supabase | PASS |
| `ORDER_STORE` | `supabase` | supabase | PASS |
| `NOTIFICATION_SETTINGS_STORE` | `supabase` | supabase | PASS |
| `CUSTOMER_STORE` | `directus` | directus (deliberate until Stage 8/9) | PASS |

Credential **presence** for Preview (names + scope only, values never
reproduced):

| Name | Type | Scope | Present |
|---|---|---|---|
| `SUPABASE_URL` | Secret | Preview (dev) | yes |
| `SUPABASE_SECRET_KEY` | Secret | Production, Preview | yes |
| `DIRECTUS_URL` | Secret | Production, Preview | yes |
| `DIRECTUS_READ_TOKEN` | Secret | Production, Preview | yes |
| `NOVA_POSHTA_API_KEY` | Secret | Production, Preview | yes |
| `PREVIEW_SECRET` | Secret | Preview (dev) | yes |
| `TELEGRAM_BOT_TOKEN` | Secret | Preview (dev) | yes |
| `TELEGRAM_TEST_CHAT_IDS` | Config | Preview (all branches) | yes |

All eight required names are present and correctly scoped to Preview (none
leaks into Production). Note `TELEGRAM_TEST_CHAT_IDS` is scoped to `Preview`
(whole environment) rather than `Preview (dev)` specifically — still
Preview-only, so no Production exposure; worth tightening for hygiene.

Hygiene follow-ups (flagged, **not** changed):
`DIRECTUS_ADMIN_TOKEN` and the R2 write keys (`R2_SECRET_ACCESS_KEY`,
`R2_ACCESS_KEY_ID`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL`)
are Production-scoped. They are not on Preview runtime, but they are
high-privilege long-lived credentials on the production project — rotate/remove
after the Directus/R2 dependency analysis (Stage 11). Also `R2_PUBLIC_BASE_URL`
is marked Secret although it is a public origin.

---

## 3. Automated quality gate (Phase 1)

Run once each from `product-page`. No hangs, no retries needed.

| Command | Tests | Result | Notes |
|---|---|---|---|
| `pnpm run test:stage4` | 19 | **PASS** 19/19 | 330 ms |
| `pnpm run test:stage6` | 24 | **PASS** 24/24 | 249 ms |
| `pnpm run test:supabase-catalog` | 8 | **PASS** 8/8 | live PostgREST, SELECT-only, 11.6 s |
| `pnpm run test:customer-store` | 32 | **PASS** 32/32 | 196 ms |
| `pnpm run test:loyalty` | 37 | **PASS** 37/37 | 245 ms |
| `pnpm run test:checkout-reliability` | 12 | **PASS** 12/12 | includes "replayed orders never notify again" |
| `pnpm run test:order-notifications` | 22 | **PASS** 22/22 | preview recipient isolation covered |
| `pnpm exec tsc --noEmit --pretty false` | — | **PASS** (exit 0, no diagnostics) | |
| `pnpm run lint` | — | **PASS** (exit 0) | warnings only, see P2-5 |

**Total: 154/154 tests green, 0 fail.** No P0/P1 code errors.

The successful Vercel Preview build of `3d5ef76` is used as the
production-like build gate (local `next build` not run; per instructions,
build workers can hang locally).

---

## 4. Route matrix (HTTP-level, Preview via `vercel curl`)

Access method: `vercel curl` with the project's automation bypass (Deployment
Protection stays ON). Plain `curl` to the Preview redirects to
`vercel.com/login` — confirmed and recorded as PASS for the "Deployment
Protection remains on" security item. Bypass secret was never printed or
extracted.

**Legend:** HTTP-only = server-rendered HTML/API inspected; browser = real
interactive session (all browser rows are `NOT VERIFIED` — see §5).

| Route | HTTP | H1 / payload | Notes | Level |
|---|---|---|---|---|
| `/` | 200 | `Преміальні автоаксесуари Carzo` | hero/products/badges/stats/footer present; media on `media.carzo.com.ua` | HTTP-only |
| `/case/design/s/2-0` | 200 | `Автокейс S Carzo 2.0` | title `Автокейс S Carzo 2.0 \| CARZO` | HTTP-only |
| `/case/design/s/3-0` | 200 | `Автокейс S Carzo 3.0` | | HTTP-only |
| `/case/design/s/4-0` | 200 | `Автокейс S Carzo 4.0` | | HTTP-only |
| `/case/design/m/2-0` | 200 | `Автокейс M Carzo 2.0` | | HTTP-only |
| `/case/design/m/3-0` | 200 | `Автокейс M Carzo 3.0` | | HTTP-only |
| `/case/design/m/4-0` | 200 | `Автокейс M Carzo 4.0` | | HTTP-only |
| `/case/design/l/2-0` | 200 | `Автокейс L Carzo 2.0` | | HTTP-only |
| `/case/design/l/3-0` | 200 | `Автокейс L Carzo 3.0` | | HTTP-only |
| `/case/design/l/4-0` | 200 | `Автокейс L Carzo 4.0` | price 2590 / old 2900 in payload | HTTP-only |
| `/case/design/xl/2-0` | 200 | `Автокейс XL Carzo 2.0` | | HTTP-only |
| `/case/design/xl/3-0` | 200 | `Автокейс XL Carzo 3.0` | | HTTP-only |
| `/case/design/xl/4-0` | 200 | `Автокейс XL Carzo 4.0` | | HTTP-only |
| `/about` | 200 | `Робимо добре те, за що беремося` | | HTTP-only |
| `/catalog-carmat` | 200 | `Автокилимки Carzo` | **1 × `/api/directus-assets/…`** ref (D-1) | HTTP-only |
| `/delivery-and-payment` | 200 | `Доставка та оплата` | CMS page, published, `no_index=true` | HTTP-only |
| `/privacy-policy` | 404 | `Сторінку не знайдено` | draft → expected 404 + `robots: noindex` | HTTP-only |
| `/public-offer` | 404 | `Сторінку не знайдено` | draft → expected 404 + `robots: noindex` | HTTP-only |
| `/delivery` `/payment` `/returns` `/corporate-orders` `/wholesale` `/loyalty-program` `/bundle-deals` | 404 | 404 page | footer links; **same 404 on Production** (P2-1) | HTTP-only |
| `/sitemap.xml` | 200 | 1903 B, 14 URLs | all `https://carzo-eight.vercel.app/…` (P2-2) | HTTP-only |
| `/llms.txt` | 200 | 3 021 B | same legacy host | HTTP-only |
| `/robots.txt` | 200 | 129 B | sitemap line uses legacy host | HTTP-only |
| `/nonexistent-qa-probe-404` | 404 | `Сторінку не знайдено` | generic 404 works | HTTP-only |

### 4.1 PDP 12/12 summary

All twelve `2-0|3-0|4-0` × `S|M|L|XL` canonical routes render HTTP 200 with a
correct per-variant `H1` and matching `<title>`. Price/old-price pairs are
present in the server payload. Stock markers (`inStock`) are present. **PDP
route availability: 12/12 PASS (HTTP-only).**

### 4.2 Price / extras / discount contract

Live Supabase reference (SELECT-only) and live Preview `POST /api/cart/quote`
agree exactly.

| Size | Price | Old price |
|---|---|---|
| S | 1 790 | 2 100 |
| M | 2 249 | 2 600 |
| L | 2 590 | 2 900 |
| XL | 2 990 | 3 400 |

| Rule | Data | Expected | Result |
|---|---|---|---|
| Brand surcharge (enabled logos) | `brands.logo_extra = 290` (25 brands) | +290 | PASS |
| Brand `none` | `logo_extra = 0` | 0 | PASS |
| Fixation `both` by size | S 60, M 80, L 100, XL 120 | matches | PASS |
| Fixation `none` / `bottom` / `wall` | 0 all sizes | 0 | PASS |
| Qty tier 2 | `discount_tiers` min 2 → 200 UAH | 200 | PASS |
| Qty tier 3 | `discount_tiers` min 3 → 500 UAH | 500 | PASS |
| Variants | 12 (3 designs × 4 sizes) | 12 | PASS |
| `product_media` slots | 17 rows | 17 canonical slots | PASS |
| `fixation_size_extras` | 16 rows | 16 | PASS |

Live quote checks against Preview (`POST /api/cart/quote`, read-only — endpoint
verified as non-mutating before use):

| Case | Expected total | Actual | Verdict |
|---|---|---|---|
| Q1 1× L/4-0, none/none | 2 590 | 2 590 | **PASS** |
| Q2 1× L/4-0, bmw/both | 2 980 (=2590+290+100) | 2 980 | **PASS** |
| Q3 2× S/2-0, none/none | 3 380 (=3580−200) | 3 380 | **PASS** |
| Q4 3× M/3-0, audi/both | 7 357 (=7857−500) | 7 357 | **PASS** |
| Q5 1× XL/3-0, none/both | 3 110 (=2990+120) | 3 110 | **PASS** |
| Q6 1× S/4-0, mercedes/wall | 2 080 (=1790+290) | 2 080 | **PASS** |
| Q7 mixed 1×L/4-0 + 1×S/2-0 | 4 180 (=4380−200) | 4 180 | **PASS** |
| Q8 empty items | 400 | 400 | **PASS** |
| Q9 invalid size | 400 | 400 | **PASS** |
| Q10 invalid brand | 400 | 400 | **PASS** |

Per-line response also confirmed: `unitPrice`, `lineTotal`, `inStock: true`,
`quantityDiscountEligible: true`, `allowPostomat: true` for single-line qty 1,
`canCheckout: true`, `productUrl` canonical form
`/case/design/{size}/{design}/{brand}`. Server-side quote equals the displayed
arithmetic in all cases (brand and fixation extras are applied per unit before
the quantity discount, matching the documented order).

`checkoutPaymentDetails` came back empty on the quote response
(`site_settings.checkout_payment_details` is empty in Supabase) — recorded as
P2-6, not blocking.

---

## 5. Browser / interactive QA matrix — **NOT VERIFIED**

The browser automation request was rejected by the local safety layer as high
risk. Per instruction it was **not retried** and no workaround was attempted.
Consequently **none** of the following can be honestly marked PASS:

| Area | Interactive criteria | Status |
|---|---|---|
| A. Homepage | hero CTA behaviour, product-card hover, badges video autoplay, stats rendering, mobile proportions, sticky header, text clipping, horizontal scroll, image edges | **NOT VERIFIED** |
| B. PDP ×12 | gallery/thumbnail selector, size/design switcher, fixation variants, tabs, FAQ accordion, logo options, rich sections, magnetic covers, video reviews, sticky CTA, modal interactions, mobile cropping | **NOT VERIFIED** |
| C. Cart | drawer add/change/remove, qty 1/2/3 stepper, mixed lines, cross-variant edits, price/loyalty reconfirm flows, malformed-input UX, all four contact methods, Nova Poshta city/point/street pickers (BRANCH/POSTOMAT/COURIER) | **NOT VERIFIED** (API side of quote/loyalty/NP **was** verified — §4.2, §6) |
| D. Loyalty | eligibility UI, phone normalization feedback, mismatch/no-customer UX | **NOT VERIFIED** (fail-closed API path verified — §6) |
| E. About / car mats / modals | about hero/process/principles/development/statement rendering, car-mat design modal, promo video, all benefit modals open/close on desktop+mobile, tab switching, FAQ accordions | **NOT VERIFIED** (modal **data** present in payload — §7) |
| F. Reviews / social / video | review cards, video player controls, autoplay fallback, CTA links, social links | **NOT VERIFIED** |
| G. CMS / draft preview | draft **positive** preview with secret, page block order rendering, metadata | **NOT VERIFIED** (unauthorized draft rejection verified — §6) |
| H. R2 media visual fit | actual browser render of images/video, cropping, no blank white sides | **NOT VERIFIED** (URL/host/status inventory done — §7) |

Nothing in this section is claimed as passed. This is the primary reason for
the BLOCKED verdict.

---

## 6. Security / access (Phase 2.J)

| Check | Evidence | Result |
|---|---|---|
| Deployment Protection on for Preview | plain `curl` → `302 https://vercel.com/login?next=%2Fsso-api…` with `x-robots-tag: noindex` | **PASS** |
| Preview not publicly indexed | `x-robots-tag: noindex` on protected responses; `robots.txt`/sitemap use legacy host (P2-2) | PASS (limited) |
| Supabase secret server-only | `SUPABASE_SECRET_KEY` is a Vercel Secret, not `NEXT_PUBLIC_*`; no `NEXT_PUBLIC_*` elevated secret in env list | **PASS** |
| No anon/authenticated DML on orders/order_items/customers | `information_schema.role_table_grants`: only `service_role` has SELECT/INSERT/UPDATE/DELETE; zero grants to `anon`/`authenticated`/`public` | **PASS** |
| RLS enabled, deny-by-default | `orders`, `order_items`, `customers`, `notification_settings` all `relrowsecurity=true` with **0** policies | **PASS** |
| RPC execute privilege | `create_order_with_items`: `EXECUTE` only for `postgres` + `service_role`; `prosecdef=false` (SECURITY INVOKER) | **PASS** |
| Security advisor | only `rls_enabled_no_policy` INFO ×28 (intentional deny-by-default); no WARN/ERROR | **PASS** |
| Telegram probe route / nonce absent | `app/**/route.ts` inventory: `llms.txt`, `api/draft`, `api/draft/disable`, `api/customer-discount/check`, `api/directus-assets/[id]`, `api/cart/quote`, `api/nova-poshta/{cities,points,streets}` — no probe/debug route. `STAGE6_CHECK_NONCE` appears only as historical prose in `SUPABASE_STAGE6_RESULT.md` | **PASS** |
| Old debug path | no such route registered; generic 404 returned for unknown paths. Not recreated. | **PASS** |
| `PREVIEW_SECRET` server-only | Secret type, Preview (dev) scope, never printed | **PASS** |
| Draft preview — unauthorized rejected | `GET /api/draft?slug=privacy-policy` → **401** `Invalid preview request`; same with a bogus `secret` → **401** | **PASS** |
| Draft preview — positive with real secret | cannot be exercised without reading/using the secret | **NOT VERIFIED** |
| Draft pages not public | `/privacy-policy`, `/public-offer` → **404** + `robots: noindex` | **PASS** (expected behaviour) |
| Runtime log PII scan | Vercel Hobby plan does not retain per-request logs (same infrastructure limitation recorded in Stage 5); source-level `safeErrorDetail` sanitisation covered by tests (12/12) | **NOT VERIFIED** (infra limit) |
| Env hygiene | `DIRECTUS_ADMIN_TOKEN` + R2 write keys on Production — flagged, untouched | follow-up |

**Live-checkout / order-write safety (this run):** no order was created, no
`create_order_with_items` RPC was called (not even as a probe), no customer was
created or modified, no Telegram message was sent, no Nova Poshta shipment was
created, no R2/Directus/Supabase mutation was performed. Checkout
idempotency/fingerprint is cited from **prior Stage 6 evidence** only.

| Checkout criterion | Status |
|---|---|
| BRANCH / POSTOMAT / COURIER live UI checkout | `PASS (prior Stage 6 evidence)` — Stage 6.1 A.5, 3/3 |
| Idempotent retry same `checkout_attempt_id` | `PASS (prior Stage 6 evidence)` — A.6 |
| Fingerprint mismatch rejection | `PASS (prior Stage 6 evidence)` — A.6/A.7 + 12/12 unit tests this run |
| Snapshot/loyalty/immutability of the 10 historical orders | `PASS (prior Stage 6 evidence)` + read-only re-count this run (§8) |
| Replayed order sends no notification | `PASS (prior Stage 6 evidence)` + `test:checkout-reliability` 12/12 this run |
| New live E2E order submission | **NOT VERIFIED — NEW AUTHORIZATION REQUIRED** (deliberately not attempted) |

---

## 7. Media / R2 inventory (Phase 2.H)

Supabase media inventory (SELECT-only), all published URLs inspected for host
and presence. The task's "working Production media is fine" constraint is
honoured — this audit is Preview-specific and no re-upload was attempted.

| Group | Count | Host | Result |
|---|---|---|---|
| `product_media` canonical slots | 17 (2 videos + 12 magnetic covers + default cover + magnetic video + materials video) | `media.carzo.com.ua` | **PASS** 17/17 |
| `gallery_images` real product shots | 49 (design × size × 4–5 shots) | `media.carzo.com.ua` | PASS |
| `gallery_images` fallbacks | 4 (`gallery-fallback-1..4`) | `images.pexels.com` | present by design (stock fallbacks) — P2-7 note |
| `content_sections` fixation media | 37 rows | `media.carzo.com.ua` | PASS |
| `content_sections` `fixation-bottom`, `fixation-wall` | 2 rows, `media_url` empty | — | **PASS — intentional empty slots**, not defects |
| `content_sections` inside-* | 9 | `media.carzo.com.ua` | PASS |
| `rich_section_images` | 12 | `media.carzo.com.ua` | PASS (note `3-0:rich-magnets` reuses the `design-2.0/magnets.jpg` asset — content decision, not a 404) |
| Car-mat promo video/cover | 2 | `media.carzo.com.ua` | PASS |
| Homepage logo video | 1 | `media.carzo.com.ua` | PASS |
| Homepage badges video | DB value empty → local `/carzo-badges.mp4` | local | PASS (local asset serves) |
| Site flag | DB value empty → local `/flag-ua.svg` | local | PASS |
| Logo fallback + placement video | 2 | `media.carzo.com.ua` | PASS |
| Video-review social badge | 1 | `media.carzo.com.ua` | PASS |
| Brand logos | 24 URLs | `media.carzo.com.ua` | PASS (24/25 brands have logos; `none` intentionally has none) |
| Design selector image | 3 designs → `designs/selector-default.jpg` | `media.carzo.com.ua` | PASS |
| OG image | `/case.jpg` on the deployment host | Preview host | P2-2 (crawler-unfetchable behind protection) |

### 7.1 Directus asset leakage in published media — **P1**

Exactly **one** published page still resolves critical media through the
Directus proxy:

| Page | Reference | Slot | Upstream | Result |
|---|---|---|---|---|
| `/catalog-carmat` | `/api/directus-assets/8448fa94-89cd-4f2a-8596-fa871d7144bd` | car-mat **design variants modal placeholder** | Directus `GET /assets/8448fa94…` → **403 FORBIDDEN**; proxy returns **502** | **FAIL (D-1)** |

All other routes returned **zero** `/api/directus-assets/` references and zero
Directus host references. Root cause and remediation are in §9 (D-1).

---

## 8. Backend dependencies, data parity, cutover readiness (Phase 3)

### 8.1 Directus usage classification

| Location | Domain | Runtime traffic? | Classification |
|---|---|---|---|
| `lib/cart/customer-store/directus.ts` | customers / loyalty | yes | **Intentional** — `CUSTOMER_STORE=directus` until Stage 8/9 |
| `lib/order-notifications.ts` (car-mat quote notifier) | car-mat quote notifications | yes (on quote form submit; not exercised) | **Intentional legacy** — pending retirement in Stage 11 |
| `lib/content/homepage.ts` | content (homepage) | **yes** — `GET {DIRECTUS_URL}/items/carzo_site_settings` | **Unexpected — D-2 (FAIL)** |
| `lib/content/about.ts` | content (about) | **yes** — `GET {DIRECTUS_URL}/items/carzo_site_settings` | **Unexpected — D-2 (FAIL)** |
| `lib/content/car-mat-designs.ts` | content (car-mat) | **yes** — `carzo_site_settings` + `carzo_media_settings` | **Unexpected — D-2 (FAIL)** |
| `app/api/directus-assets/[id]/route.ts` | media proxy | yes (via D-1) | **Unexpected — D-1 (FAIL)** |
| `lib/content/directus.ts`, `lib/pages/directus.ts` | content/pages adapters | no (selected only when flag = directus) | Dormant rollback code — document only |
| `lib/data/catalog/directus.ts`, `lib/data/orders/directus.ts`, `lib/data/notifications/directus.ts` | catalog/orders/notifications adapters | no | Dormant rollback code — document only |
| `lib/media.ts` | helper | indirect | utility; emits `/api/directus-assets/` for Directus file refs |
| `scripts/*` (migrate, verify, import) | tooling | no (not in runtime) | tooling only |

**Runtime proof for D-2** (not just source reading): the rendered
`/catalog-carmat` payload contains
`placeholderImage: "/api/directus-assets/8448fa94-89cd-4f2a-8596-fa871d7144bd"`,
and Directus `carzo_media_settings` holds exactly
`image.id = 8448fa94-89cd-4f2a-8596-fa871d7144bd` with `external_url = null`.
Supabase has **no** `media_settings` table, so this value can only have come
from Directus at request time.

### 8.2 Content parity Directus ↔ Supabase

Read-only comparison of the fields that homepage/about/car-mat render:

| Field | Directus | Supabase | Drift |
|---|---|---|---|
| `homepage_hero_eyebrow` | `Стабільно якісно з 2020 року` | identical | none |
| `homepage_hero_title` | `Преміальні автоаксесуари Carzo` | identical | none |
| `homepage_logo_video_url` | R2 `…/home/logo-video.mp4` | identical | none |
| `homepage_badges_video_url` | null | `''` | none (both empty → local fallback) |
| `homepage_badges_title` | `Високоякісні шильди` | identical | none |
| `about_hero_title` | `Робимо добре те, за що беремося` | identical | none |
| `about_process_image_1_url` | R2 `…/about/develop.webp` | identical | none |
| `car_mat_promo_video_url` | R2 `…/car-mats/promo-video.mp4` | identical | none |
| `car_mat_promo_cover_url` | R2 `…/car-mats/cover-video.webp` | identical | none |
| `car_mat_modal_title` | `Варіанти дизайну` | identical | none |

**Parity: PASS** (zero drift on the sampled published fields). The problem is
*which* backend serves them, not what they say.

### 8.3 Data counts (SELECT-only)

| Entity | Count | Stage 6.1 checkpoint | Result |
|---|---|---|---|
| `orders` | 10 | 10 | match |
| `order_items` | 17 | 17 | match |
| `customers` | 5 994 | 5 994 | match |
| `variants` | 12 | 12 | match |
| `product_media` | 17 | 17 | match |
| `fixation_size_extras` | 16 | 16 | match |
| `designs` / `sizes` / `brands` | 3 / 4 / 26 | — | coherent |
| `notification_settings` | 1 (`channel=telegram`) | 1 | match |
| Synthetic orders (`CZ-20261031-%`) | **0** | 0 (cleaned) | match |
| Historical orders with `checkout_attempt_id` | 0 | 0 | match |
| Historical orders with `request_fingerprint` | 0 | 0 | match |
| Historical orders with `manager_note` | 0 | 0 | match |

All 10 historical orders remain untouched. Counts are treated as checkpoints,
not frozen invariants — no legitimate new activity was observed and none was
created.

### 8.4 Notification posture

- `ORDER_STORE=supabase` and `NOTIFICATION_SETTINGS_STORE=supabase` confirmed
  effective on Preview.
- Preview recipient isolation: on Preview, Telegram recipients come **only**
  from `TELEGRAM_TEST_CHAT_IDS`; fallback to
  `notification_settings.telegram_chat_ids` is blocked. Covered by
  `test:order-notifications` 22/22 ("preview blocks instead of falling back",
  "never falls back to the shared work chats on preview").
- `notification_settings` has a single `telegram` row. **There is no email
  channel row → email channel is `UNSUPPORTED`. Do not claim it works.**
- Bot token is server-side only (`TELEGRAM_BOT_TOKEN`, Preview (dev) Secret).
- Stage 6 evidence (not re-run): bot `getMe ok:true`; one TEST message per
  owner-approved recipient, **2/2 delivered** (`message_id` 117/118). **This
  proves Telegram delivery of control messages, not a complete new-order →
  Telegram payload.** That gap is recorded as P2-4. **No message was sent this
  run.**
- Best-effort post-commit notification on server crash (no durable outbox) —
  recorded as P2-3 resilience risk; **no queue/outbox was added in this
  QA-only stage** (correctly out of scope).
- Car-mat quote notifier still writes to Directus — explicit Stage 11
  retirement item.

### 8.5 Migration version discrepancy (read-only, not repaired)

| Local file | Remote `supabase_migrations` entry | Match |
|---|---|---|
| `20261101120000_create_order_with_items_rpc.sql` | `20261031164057_create_order_with_items_rpc` | **NO** |
| `20261101200000_require_order_request_fingerprint.sql` | `20261031180954_require_order_request_fingerprint` | **NO** |
| `20261001203704_rls_auto_enable.sql` | `20261001203704_rls_auto_enable` | yes |
| `20261001211849_create_customers.sql` | `20261001211849_create_customers` | yes |
| `20261001213417_tighten_customers_service_role_grants.sql` | `20261001213417_tighten_customers_service_role_grants` | yes |
| `20261007101747_directus_exit_schema_foundation.sql` | `20261007101747_directus_exit_schema_foundation` | yes |
| `20261007114221_add_missing_fk_indexes.sql` | `20261007114221_add_missing_fk_indexes` | yes |

Remote history was **not** renamed, no RPC migration was re-run, no schema
write was performed. Classified as **P2-5 release-discipline issue** requiring
a separate, safe reconciliation before Stage 8 (see §11).

### 8.6 Rollback risk after Supabase-only orders

A naive `ORDER_STORE=directus` flip is **unsafe** once unique Supabase orders
exist: Directus has no `checkout_attempt_id` / `request_fingerprint` columns and
no `create_order_with_items`, so a rollback would (a) lose idempotency and (b)
diverge order numbering. Currently there are **0** Supabase-only orders in the
table (all 10 are legacy), so the window is still open — but it closes at the
first real Supabase order after cutover. Reconciliation (export Supabase orders
into Directus, or accept Supabase as order SoR and treat Directus as
read-only) must be designed **before** Stage 9. Recorded in §11.

### 8.7 Customer registry / Stage 8 prerequisites

- `CUSTOMER_STORE=directus` is a **temporary cross-store dependency**. The
  5 994 Supabase `customers` rows are an **older imported snapshot**, not
  necessarily the current authoritative loyalty registry.
- Directus holds legacy customer JSON that has not been reconciled.
- **Determination:** a customer **delta sync is required before switching
  `CUSTOMER_STORE=supabase`** (Stage 8 must cover customers, not only
  catalog/content). Without it, loyalty eligibility would silently diverge.
- No freeze/import was performed in this stage (correct).

### 8.8 Supabase Free-plan pause risk

The `Carzo` project is on the **Free** plan and has already auto-paused once.
A production storefront cannot tolerate an unannounced pause. This is a
**mandatory pre-Production operational decision** (upgrade to paid, or
monitoring + auto-resume + documented RTO). **No upgrade and no spend was
performed** (correct — not authorized).

### 8.9 Static prerender / freshness

`/api/cart/quote` is `force-dynamic` and returns `Cache-Control: no-store` —
no stale commerce totals from prerendering. Sitemap/llms.txt are the only
statically derived outputs and carry the legacy-host defect (P2-2). Quote
failures return `503` (`UNAVAILABLE`) or `400` — fail-closed, matching the
documented contract.

---

## 9. Defect classification

### D-1 — P1 — car-mat design placeholder image broken

- **Impact:** `/catalog-carmat` → design variants modal shows a broken
  placeholder image (critical published media not loading).
- **Evidence:** rendered payload
  `placeholderImage: "/api/directus-assets/8448fa94-89cd-4f2a-8596-fa871d7144bd"`;
  `GET /api/directus-assets/8448fa94-…` on Preview → **502**;
  Directus `GET {DIRECTUS_URL}/assets/8448fa94-…` with `DIRECTUS_READ_TOKEN` →
  **403 FORBIDDEN**. `carzo_media_settings.external_url` is `null`, so
  `resolveMediaUrl` falls through to the Directus file id.
- **Root cause:** the car-mat placeholder was never migrated to R2; the
  Directus read token cannot serve that file.
- **Proposed owner action (Stage 7.x patch, separately approved):** migrate the
  placeholder to R2 and set `carzo_media_settings.external_url` (or add a
  Supabase `media_settings` row) so the resolved URL is
  `https://media.carzo.com.ua/…`; then re-verify `/catalog-carmat` renders with
  zero `/api/directus-assets/` references.

### D-2 — P1 — Directus reads inside the switched content domain

- **Impact:** `CONTENT_STORE=supabase` is not actually in force for homepage,
  about and car-mat content. Three modules issue live Directus reads at request
  time, so the "zero unexpected Directus calls for switched domains" Stage 7
  verification criterion is **not** met.
- **Evidence:** `lib/content/homepage.ts:139`,
  `lib/content/about.ts:147`, `lib/content/car-mat-designs.ts:50,83,111` each
  `fetch('{DIRECTUS_URL}/items/carzo_site_settings|carzo_media_settings')`
  with no `resolveContentStoreBackend()` gate. `lib/data/config.ts:25` explicitly
  declares homepage/about/reviews/product_media/site settings as
  `CONTENT_STORE` scope. `lib/data/content/supabase.ts:135,136,137` fetches
  `homepage_settings`, `about_settings`, `car_mat_settings` and then discards
  them (`void homepageSettingsRows; void aboutSettingsRows; void
  carMatSettingsRows;`). Runtime proof in §8.1. Supabase content parity is
  currently identical (§8.2), so there is **no user-visible drift yet** — but
  any Directus edit would now diverge from Supabase.
- **Proposed owner action (Stage 7.x patch, separately approved):** route the
  three loaders through `lib/data/content` so `CONTENT_STORE=supabase` is
  honoured, populate/complete the Supabase car-mat + media-placeholder mapping,
  and re-verify with a browser network capture that Preview makes zero Directus
  calls for content.

### P2-1 — footer links 404 (pre-existing, both backends)

`/delivery`, `/payment`, `/returns`, `/corporate-orders`, `/wholesale`,
`/loyalty-program`, `/bundle-deals` return 404 on **both** Preview and
Production. The footer hardcodes these while CMS only has `home`,
`delivery-and-payment`, `privacy-policy` (draft), `public-offer` (draft).
**Not a Preview regression and not a cross-backend mismatch.** Owner decision:
point the footer at `/delivery-and-payment` / `/about` / the benefit modals, or
publish the missing CMS pages before production cutover.

### P2-2 — legacy `carzo-eight.vercel.app` canonical / OG / sitemap (known)

Present on **every** page of both Preview and Production:
`<link rel="canonical">`, `og:url`, JSON-LD `Organization.url`/`logo`,
`/sitemap.xml` (14 URLs), `/llms.txt`, `/robots.txt` sitemap line all use
`https://carzo-eight.vercel.app`. Additionally `og:image`/`twitter:image` point
at the **Preview** host `carzo-storefront-git-dev-….vercel.app/case.jpg`,
which is unreachable to social crawlers behind Deployment Protection.

- **Distinguish Preview vs cutover risk:** this is **site content**, identical
  on Production today — it is **not** a Preview regression. It **is** a
  production SEO risk once the storefront is authoritative: Google would keep
  canonicalising to the wrong host.
- **Not fixed here** (QA-only, and SEO policy change is an owner decision).
- Recommended: introduce a `NEXT_PUBLIC_SITE_URL`/`SITE_URL`-driven canonical
  and regenerate sitemap/llms.txt before Stage 9. `AGENTS.md` already lists the
  OG image (`case.jpg`, should be a real 1200×630 branded image) as a known
  limitation.

### P2-3 — no durable notification outbox (known)

`runPostOrderSideEffects` is best-effort post-commit: a server crash after
commit loses the Telegram notification with no retry. Accepted for Stage 7
(no queue/outbox added — correct for a QA-only stage). Owner decision before
Stage 9: accept as a follow-up, or add an outbox/queue.

### P2-4 — real order → Telegram payload not fully proven (known)

Stage 6.1 delivered **TEST** control messages 2/2 and verified the bot token
(`getMe ok:true`). That does not prove the complete new-order → Telegram
payload rendering. Requires a new authorized order to close. **Not attempted.**

### P2-5 — migration version mismatch (known)

See §8.5. Remote history ≠ local filenames for the two Stage 6 migrations.
Needs a separate, non-destructive reconciliation before Stage 8 so that
`supabase db push`/`reset` semantics stay trustworthy.

### P2-6 — `checkout_payment_details` empty

`site_settings.checkout_payment_details` is empty in Supabase, so the quote
response exposes `checkoutPaymentDetails: ""`. If the checkout UI is supposed
to show payment details, this is a content gap; if intentional, ignore.

### P2-7 — gallery fallbacks point at Pexels

`gallery_images.gallery-fallback-1..4` use `images.pexels.com` stock photos.
Only reached when a design×size gallery is missing. Consider migrating to R2
or accepting as a deliberate fallback.

### P2-8 — lint warnings (pre-existing)

9 × `@next/next/no-img-element`, 1 × `jsx-a11y/alt-text`
(`components/ManagedProductImage.tsx:24`). Non-blocking.

### P2-9 — `gallery_images` key naming inconsistency

Keys mix `gallery:2.0:L:1` (dots) with `gallery:4-0:L:1` (dash). The Supabase
mapper reads `design_slug`/`size` columns rather than parsing `key`, so there
is **no functional impact** — cosmetic only.

### P2-10 — Supabase Free-plan pause (operational)

See §8.8. Mandatory pre-Production decision, not a code defect.

---

## 10. Data-safety audit

| Category | Count |
|---|---|
| Supabase writes (data or schema) | **0** |
| Directus writes | **0** |
| R2 writes / re-uploads | **0** |
| Orders created | **0** |
| Orders deleted / modified | **0** |
| Customers created / modified | **0** |
| `create_order_with_items` RPC invocations | **0** (not even as a probe) |
| Telegram messages sent | **0** |
| Nova Poshta shipments created | **0** |
| Car-mat quote form submissions | **0** |
| Vercel env / flag changes | **0** |
| Production deploys / promotions | **0** |
| `main` branch touched | **0** |
| Secret values printed / copied to docs | **0** |
| Supabase branches / projects created | **0** |
| Temporary debug endpoints created | **0** |
| SQL writes (all queries SELECT / information_schema / pg_catalog) | **0 mutations** |

**Production unchanged proof:** deployment id `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9`
identical at the start and at the end of the QA run; alias
`https://carzo-storefront.vercel.app` still serves the same document
(`title: CARZO — преміальні автоаксесуари`, canonical `carzo-eight.vercel.app`)
— observed only.

---

## 11. Stage 8 preconditions and outstanding change-control decisions

Ready:
- Stage 5 PASS, Stage 6 PASS recorded in repo and confirmed at HEAD `3d5ef76`.
- Catalog/content/pages/order-writes on Supabase with verified price/extras/
  discount contract and live quote agreement.
- Order writer idempotent + fingerprint-bound (Stage 6 evidence + unit tests).
- Security posture (RLS deny-by-default, `service_role`-only RPC, no
  probe/nonce, Deployment Protection on).

Not ready — must be decided or fixed first:

| # | Item | Owner decision needed |
|---|---|---|
| 1 | **D-1 / D-2 fix** (car-mat placeholder + content-domain Directus reads) | approve a narrowly scoped `Stage 7.x` patch |
| 2 | **Visual/browser QA completion** | re-run Stage 7's interactive matrix under an authorized browser session |
| 3 | Customer delta sync (§8.7) | confirm Stage 8 covers `customers`, not only catalog/content |
| 4 | Supabase Free-plan pause (§8.8) | paid plan vs monitoring + accepted RTO |
| 5 | Migration version reconciliation (§8.5) | non-destructive, separate task |
| 6 | Rollback plan for post-Supabase orders (§8.6) | design before first real Supabase order |
| 7 | Legacy `carzo-eight` SEO URLs (P2-2) | SEO policy + `SITE_URL` before cutover |
| 8 | Footer 404 links (P2-1) | repoint or publish pages |
| 9 | Notification outbox (P2-3) and real order→Telegram proof (P2-4) | accept as follow-up or authorize evidence runs |
| 10 | `DIRECTUS_ADMIN_TOKEN` / R2 write-key hygiene | Stage 11 rotation |

**Stage 8 was not started. Directus was not frozen or imported.**

---

## 12. Final verdict

**`Stage 7: BLOCKED`**

Required P0/P1 checks that are **not** fully verified:

1. Visual/browser QA matrix (Phase 2.A–H interactive criteria) —
   `NOT VERIFIED`; browser automation was rejected by the local safety layer
   and was not retried.
2. D-1 (car-mat placeholder media broken, `P1`) — **FAIL**.
3. D-2 (Directus reads in the switched content domain, `P1`) — **FAIL**.

No P0 defect was found. Production was not modified. Zero writes occurred.

**Highest-priority next corrective task:**

> Approve and apply a narrowly scoped `Stage 7.x` patch that (a) migrates the
> car-mat design placeholder to R2 so `/catalog-carmat` has zero
> `/api/directus-assets/` references (D-1), and (b) routes
> `lib/content/{homepage,about,car-mat-designs}.ts` through
> `lib/data/content` so `CONTENT_STORE=supabase` is honoured (D-2). Then
> re-run the Stage 7 interactive QA matrix under an authorized browser
> session.

**Ready to prepare Stage 8 Directus delta migration plan** is **NOT** claimed.
Do not execute Stage 8 or Stage 9.

---

## 13. Post-QA git / deployment state

| Item | Value |
|---|---|
| QA doc commit | `944c085` — `docs: record stage 7 full staging QA` (documentation only, 1 file, +700 lines) |
| Pushed | `3d5ef76..944c085` → `origin/dev` only; `main` untouched |
| Preview rebuilt from the docs push | `dpl_6ZjUJjzgoRwV3SebjBrGw1f931nC` → `carzo-storefront-7xf6jwih4-yevgens-projects.vercel.app`, **READY** (build log `Branch: dev, Commit: 944c085`) |
| Preview git alias | `carzo-storefront-git-dev-yevgens-projects.vercel.app` now resolves to `dpl_6ZjUJjz…` |
| Deployment actually QA'd in this run | `dpl_E4B5diSxEnfpofb166gYi7zncthu` @ `3d5ef76` (docs-only diff since; app runtime identical) |
| Production after | `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9`, **Ready**, unchanged (same id / creation timestamp as §1) |
| Untracked left alone | `.DS_Store` ×3, `.playwright-cli/` (local tooling logs) — not committed |

---

## Appendix A — HTTP matrix machine-readable output

Full per-route JSON (status, title, h1, canonical, og:url, og:image, prices,
hosts, legacy-count, directus-asset counts) captured at
`/tmp/stage7-http-matrix.json` during the run and summarised in §4. Quote
matrix in §4.2.

## Appendix B — tools and access method used

- `git` / `gh`-free read-only repo inspection.
- `vercel` CLI 65.9.0 (`curl`, `inspect`, `ls`, `env ls`, `env pull`) —
  automation bypass applied by the CLI, secret never printed or extracted.
- Supabase MCP (`execute_sql`, `list_tables`, `list_migrations`,
  `get_advisors`) — SELECT / catalog reads only.
- Directus read-only `GET` with `DIRECTUS_READ_TOKEN` from `product-page/.env.local`
  for the parity comparison in §8.2 and the asset probe behind D-1.
- Plain `curl` to **Production** only (public, read-only) for the
  unchanged-proof and the P2-1 comparison.
- Browser automation: **not used** (rejected; see §5).

---

## Superseding status — 2026-11-03 (Stage 7.x repair + Stage 7.1 visual QA)

This section supersedes the §0 STATUS verdict only. All historical findings
above are preserved as originally recorded.

| Item | Update |
|---|---|
| D-1 (car-mat placeholder) | **CLOSED by owner decision** — placeholder removed from UI/runtime on both backends (no R2 upload). See `docs/SUPABASE_STAGE7X_REPAIR_RESULT.md` §6. |
| D-2 (Directus reads in switched content paths) | **CLOSED** — content facade routing + fetch-spy proof (0 Directus reads). See `SUPABASE_STAGE7X_REPAIR_RESULT.md` §4. |
| Visual / browser QA (this report §5) | **Now executed** — authorized browser session covered the V1–V9 interaction matrix at the nearest reproducible viewport (675×782). See `docs/SUPABASE_STAGE7_1_VISUAL_QA_RESULT.md`. |
| New defects | none P0/P1. New P2: `/delivery-and-payment` renders an editor placeholder instead of content (P2-a); CMS title duplicates `\| CARZO` suffix (P2-b). |
| Overall Stage 7 (updated) | **PARTIAL / BLOCKED** — remains not-PASS until: (1) exact 1440×900 + 390×844 viewport screenshot pass, (2) positive authorized draft preview or explicit owner adjudication, (3) owner adjudication of browser-network vs HTTP evidence. Detailed checklist in `SUPABASE_STAGE7_1_VISUAL_QA_RESULT.md` §8. |

---

## Superseding status — 2026-11-03 (Stage 7.1 final acceptance)

Supersedes verdicts only; historical findings above are preserved.

| Item | Update |
|---|---|
| Visual/browser QA | Executed for the full interaction matrix at 675×782 (see `SUPABASE_STAGE7_1_VISUAL_QA_RESULT.md` §4–§7). Exact desktop 1440×900 / mobile 390×844 passes remain **NOT VERIFIED** — browser tooling was rejected by the security layer (not retried); owner manual checklist provided in §13.4 of the supplemental report. |
| P2-a `/delivery-and-payment` placeholder | **CLOSED by removal** (owner decision) — row deleted from Supabase `pages`, Preview returns **HTTP 404**, sitemap clean, modals «Доставка»/«Оплата» unchanged (§12). |
| CMS pages fetch cache | **FIXED** — stale Next.js fetch Data Cache root-caused and corrected for CMS pages only (`3edbacf`, `1413ec8`). |
| Draft preview | Negative checks PASS; positive test **NOT VERIFIED** — owner decision requested (§13.5). |
| Browser network zero-Directus | HTTP/DOM + fetch-spy evidence PASS; Network-panel level **NOT VERIFIED** — owner adjudication requested (§13.6). |
| Overall Stage 7 (updated) | **PARTIAL / BLOCKED** — no open P0/P1; closes when §13.11 items 1–3 are satisfied by owner evidence or explicit adjudication. Stage 8 not started. |

---

## FINAL OWNER SIGN-OFF — STAGE 7 (2026-11-04)

Closing section. Historical findings above are preserved; this section records
owner decisions and the final Stage 7 status.

### Visual

**`OWNER VISUAL ACCEPTANCE — APPROVED`**

The Carzo owner accepts the visual state of the site (homepage, product cards,
mobile, desktop, modals, cart, car-mat page, galleries). The last defect —
low mobile case card height — was fixed in `81fe242` (16:9 → 4:3,
`object-position: 50% 63%`, verified by computed styles at 495×782 and exact
crop simulation).

Recorded limitations (kept in QA history, not erased by this decision):

- Automated exact-viewport passes at **1440×900** and **390×844** were and
  remain **NOT VERIFIED** (browser tooling was rejected as high-risk; the
  rejected request was never retried). The prior interaction matrix was
  executed at the nearest reproducible viewport (675×782).
- Owner acceptance does **not** mean the agent performed those missing
  viewport tests. It is an explicit owner decision to accept the visual state
  in their place.
- No new browser audit was run for this sign-off.

### Network

**`OWNER NETWORK EVIDENCE ACCEPTANCE — APPROVED`**

The owner accepts the alternative evidence bundle for "no Directus in switched
content routes" instead of a DevTools Network-panel pass:

- HTTP scans of `/`, `/about`, `/catalog-carmat` and 12 PDP routes (0 Directus
  host refs, 0 `/api/directus-assets/`),
- live DOM scans of the same surfaces,
- fetch-spy integration tests (0 Directus reads for switched domains),
- `test:supabase-editorial` integration suite (Supabase-only reads).

Recorded explicitly: a full browser-network panel verification was **never
performed**; the evidence above is accepted in its place by owner decision.

Known intentional Directus dependencies (not unexpected D-2 regressions;
scheduled for later migration stages):

- `CUSTOMER_STORE=directus` — customers / loyalty (Stage 8/9 delta).
- Car-mat quote notification (`notifyNewCarMatQuote`,
  `lib/order-notifications.ts:368`) — Stage 11 retirement.

### Draft Preview

**`POSITIVE DRAFT PREVIEW — PASS (owner-confirmed, 2026-11-04)`**

The positive scenario was performed by the owner in their own authorized
session (the agent never received or extracted `PREVIEW_SECRET`). Owner result:

- draft «Політика конфіденційності» opened via `/api/draft` successfully;
- the yellow preview banner appeared;
- after clicking «Вийти» the public `/privacy-policy` returns 404 again.

Agent-side verification below was completed read-only beforehand (no secret
used or extracted):

| Check | Result |
|---|---|
| `/api/draft` validates secret + id, 401 otherwise | PASS (code + live: 401 without secret, 401 with bogus secret) |
| `draftMode().enable()` → 307 redirect to `/{slug}?preview={id}` | PASS (code: `app/api/draft/route.ts`) |
| Draft reads via Supabase (`PAGE_STORE=supabase`), no Directus | PASS (runtime: adapter `getPreviewPage` returns both drafts; `getPublishedPage('privacy-policy')` → null) |
| Preview banner «Режим попереднього перегляду…» + «Вийти» | PASS (code: `components/cms/PageRenderer.tsx:208-212`) |
| `/api/draft/disable` exits draft mode | PASS (code) |
| Public `/privacy-policy` / `/public-offer` | PASS (404) |

**Reference runbook for future re-tests** (already executed by the owner
2026-11-04; own authorized session only — never paste the secret into
chat/reports, it lands in URL history; use a private window):

1. Vercel dashboard → project `carzo-storefront` → Settings → Environment
   Variables → copy `PREVIEW_SECRET` (Preview scope).
2. Open: `https://carzo-storefront-git-dev-yevgens-projects.vercel.app/api/draft?secret=<PREVIEW_SECRET>&id=3d2d625f-8ee8-4b5a-8ace-c456a258b99d`.
3. Expect: 307 → `/privacy-policy?preview=3d2d625f-…`, amber preview banner
   with «Вийти», unpublished page visible to you only.
4. Click «Вийти» (or open `/api/draft/disable`).
5. Re-open `/privacy-policy` → must be 404 again.
6. Optional repeat with `id=f6510315-0199-4840-9816-27b07e5404f3` (public-offer).

Owner result (2026-11-04): draft opened, banner shown, «Вийти» restored the
public 404 — **positive scenario confirmed**. Note: secret-in-URL is the
existing mechanism; history/request-log exposure is a known accepted risk.

### Defects

| ID | State |
|---|---|
| D-1 | **CLOSED** (removed per owner decision) |
| D-2 | **CLOSED** (content facade) |
| P2-a | **CLOSED** (unused CMS page removed; Preview 404) |
| P2-1…P2-10 + SEO checklist items | remain in **pre-production backlog** (canonical host, footer hrefs, og:image, title duplication, notification outbox, migration filename mismatch, Free-plan risk) |
| New P0/P1 | **none** |

### Overall Stage 7

**`STAGE 7 = PASS`** (2026-11-04) — all mandatory criteria are closed by
evidence or explicit owner decisions/confirmations:

- Visual: `OWNER VISUAL ACCEPTANCE — APPROVED` (limitations of the automated
  viewport checks preserved in this report's history).
- Network: `OWNER NETWORK EVIDENCE ACCEPTANCE — APPROVED` (HTTP/DOM/fetch-spy
  accepted in place of a Network-panel pass; a panel pass was never performed).
- Draft Preview: `POSITIVE DRAFT PREVIEW — PASS (owner-confirmed)`.
- Defects: D-1 / D-2 / P2-a CLOSED; no open P0/P1.
- Regression sweep on the sign-off deployment: 16/16 routes (12 PDPs, `/`,
  `/about`, `/catalog-carmat`, `/delivery-and-payment`→404), sitemap clean.

Remaining P2/pre-production items are backlog (see below) and do not block
Stage 7 per the master-plan gate. **Stage 8 not started** — begins only on
explicit owner instruction.

### STAGE 8 READINESS CHECKLIST (preparation only — not started)

| # | Item | Status |
|---|---|---|
| 1 | Directus → Supabase customer delta | READY TO PLAN — source `carzo_customers`-side delta needed (`CUSTOMER_STORE=directus`) |
| 2 | Historical orders / order_items reconciliation | READY TO PLAN — checkpoint 10/17 rows in Supabase vs Directus ledger |
| 3 | Discounts & loyalty reconciliation | READY TO PLAN — tiers + loyalty flags compare |
| 4 | Catalog & content freshness check | READY TO PLAN — count/parity rerun after delta |
| 5 | Directus write freeze plan | REQUIRED — announce + freeze window before delta |
| 6 | Order conflict / duplication prevention | REQUIRED — `checkout_attempt_id` + fingerprint rules already in place; extend to delta window |
| 7 | Rollback plan after Supabase orders | REQUIRED — no naive `ORDER_STORE` flip; documented restore path |
| 8 | Supabase migration version reconciliation | REQUIRED — 2 Stage 6 filename mismatches (P2-5) |
| 9 | SEO canonical + Footer fixes | BEFORE STAGE 9 — `SITE_URL`/`carzo-eight` root cause in `lib/seo.ts:7` + `app/layout.tsx:24` |
| 10 | Supabase Free / Production availability decision | REQUIRED owner decision before cutover |

---

## STAGE 8A GATE RE-VERIFICATION (2026-11-03)

Read-only re-check performed at the start of Stage 8A delta discovery.
This section does **not** replace the owner sign-off above — it records that the
gate was re-validated before Stage 8A work began.

- Owner sign-off record: commit `8ab7529` (2026-11-04 local / 2026-11-03 22:47 UTC),
  `STAGE 7 = PASS`, all four §0 acceptance conditions present and honestly labelled
  (owner acceptance ≠ automated viewport PASS; Network panel never claimed;
  preview secret never exposed; D-1/D-2 closed).
- New P0/P1 regressions since sign-off: **none** (read-only parity run 2026-11-03:
  catalog/pricing/content/media/notification clean; the 4 reported parity FAILs are
  the approved `delivery-and-payment` removal + the live +1 order delta — see
  `docs/SUPABASE_STAGE8A_DELTA_DISCOVERY.md`, neither is a Stage 7 regression).
- Git consistency: `dev` @ `8ab7529` = `origin/dev`; `origin/main` = `df8f353` (untouched).

**Stage 7 gate remains CLOSED (PASS).** Historical findings and NOT-VERIFIED
limitations above are preserved unchanged.
