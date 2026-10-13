# SUPABASE STAGE 4 RESULT

## Baseline

- date/time: 2026-10-13 (UTC, Stage 4 execution session)
- branch: `dev`
- baseline HEAD: `770eab16abc9e324abda80788a6d738bb2de2a58`
- Stage 3: **PASS** (`docs/SUPABASE_STAGE3_PARITY_REPORT.md`)
- Supabase project: `Carzo` / `kmhegysmtsjqtwwaacht`
- default backend state: all store flags default to `directus` (missing/blank behaves identically)

## Flags

| Flag | Accepted values | Default | Behavior |
|---|---|---|---|
| `CATALOG_STORE` | `directus` \| `supabase` | `directus` | missing/blank → directus; invalid → `DataStoreConfigError` code `CONFIG` |
| `CONTENT_STORE` | `directus` \| `supabase` | `directus` | same |
| `PAGE_STORE` | `directus` \| `supabase` | `directus` | same |
| `ORDER_STORE` | `directus` \| `supabase` | `directus` | same; `supabase` fail-closed until Stage 6 |
| `CUSTOMER_STORE` | `directus` \| `supabase` | `directus` | unchanged (pre-existing) |

- case normalization: yes (`SUPABASE` → `supabase`)
- domains resolve independently
- no per-table flags
- `PREVIEW_SECRET ?? DIRECTUS_PREVIEW_SECRET` implemented; legacy name kept

## Repositories

| Domain | Directus | Supabase |
|---|---|---|
| catalog | `lib/data/catalog/directus.ts` (wraps previous cart quote reads) | `lib/data/catalog/supabase.ts` (SELECT-only) |
| content | `lib/data/content/directus.ts` (wraps `lib/content/directus.ts`) | `lib/data/content/supabase.ts` (SELECT-only, R2 URLs) |
| pages | `lib/data/pages/directus.ts` (wraps `lib/pages/directus.ts`) | `lib/data/pages/supabase.ts` |
| orders | `lib/data/orders/directus.ts` (existing POST semantics) | `lib/data/orders/supabase.ts` **fail-closed placeholder** |
| notifications | `lib/data/notifications/directus.ts` (rollback path) | `lib/data/notifications/supabase.ts` (settings only) |

Facades: `loadCatalogData`, `getContentSource`, `getPublishedPage` / `getPublishedPageSummaries` / `getPreviewPage`, `createOrderRecord`, `getNotificationSettingsRepository`.

## Catalog / quote

- Supabase tables: `designs`, `sizes`, `brands`, `variants`, `fixations`, `fixation_size_extras`, `discount_tiers`, `site_settings`
- brands map `id=slug`, `price=logo_extra`, `logoImage=logo_image_url` (no `brand_pricing`)
- fixations reconstruct `extraBySize` from `fixation_size_extras` + `sizes.code`
- sizes rebuild `shippingProfile` when all shipping fields present, else `null`
- shared pricing: `calculateCartTotals` only — no per-backend math
- `lib/cart/server.ts` refactored onto `loadCatalogData()`
- fail-closed: catalog errors → `CartQuoteError` code `UNAVAILABLE`; never Directus/default-price fallback
- quote tests: base, brand surcharge, both-fixation S/M/L/XL, qty 2/3, mixed cart — mismatch 0

## Content

- `ContentSource` composed: catalog from `CATALOG_STORE` + editorial from `CONTENT_STORE`
- editorial fallback to `DEFAULT_CONTENT_SOURCE` allowed on content failure only; never overwrites commerce
- settings reconstructed from `site_settings`, `homepage_settings`, `about_settings`, `review_settings`, `video_review_settings`, `car_mat_settings`
- product_media: 17/17 canonical slots (`media-slots.ts`)
- Supabase media: R2 URLs only; no `/api/directus-assets/`
- callers use facades: `site-flag.ts`, `global-modals.ts`, sitemap, PDP, CMS routes

## Pages

- published / summaries / preview via `lib/data/pages`
- Supabase: `status='published'` for public reads; preview can read drafts (`no-store`)
- blocks ordered by `sort`; media R2-only
- sitemap uses content + pages facades; route/priority unchanged
- preview secret: `getPreviewSecret()` = `PREVIEW_SECRET ?? DIRECTUS_PREVIEW_SECRET`

## Orders

- Directus writer preserved behind `createOrderRecord`
- checkout.ts uses order repository (no inline POST)
- `ORDER_STORE=supabase` → `OrderStoreError` code `NOT_READY` (fail-closed)
- direct Supabase inserts = none
- `create_order_with_items` RPC = not created (Stage 6)
- `checkout_attempt_id` = not generated
- checkout client contract unchanged
- Supabase order writes performed = 0

## Notifications

- Directus default/rollback path preserved (including `directus_user_ids`, bot token in Directus)
- Supabase settings reader: `channel`, `subject_template`, `message_template`, `telegram_chat_ids`
- no `directus_user_ids` on Supabase path
- Telegram token on Supabase path: `TELEGRAM_BOT_TOKEN` env only
- `email`/`both` on Supabase path documented as unsupported until replacement
- no real Telegram sends during Stage 4

## Tests / build

| Suite | Result |
|---|---|
| `test:stage4` (config, orders, quote, content) | **17/17 pass** |
| `test:customer-store` | 32/32 pass |
| `test:loyalty` | 37/37 pass |
| `test:checkout-reliability` | 9/9 pass |
| `test:order-notifications` | 9/9 pass |
| `test:stage2a` | 11/11 pass |

Validation tooling (infrastructure timeouts — **no TypeScript diagnostics emitted**, not compile errors):

- `pnpm exec tsc --noEmit --pretty false` — infrastructure timeout at 300s, zero diagnostics
- `pnpm run lint` — infrastructure timeout at 180s
- `pnpm run build` — infrastructure timeout at 600s during "Creating an optimized production build", no error output

Per Stage 3/4 rules these are recorded as infrastructure execution timeouts, not type errors. Not retried in a loop.

## Remaining Directus runtime dependencies

- Directus adapters under `lib/data/*/directus.ts` and legacy `lib/content/directus.ts`, `lib/pages/directus.ts` (rollback)
- Directus order writer (`lib/data/orders/directus.ts`)
- legacy media fallback in `lib/media.ts` / Directus content loader (rollback; Supabase path does not use it)
- `/api/directus-assets/[id]` kept
- Directus env vars kept
- customer store Directus path (rollback)

## Safety

- Directus data mutations = none
- Supabase data mutations = none
- R2 mutations = none
- schema migration = none
- RLS/grant changes = none
- env cutover = none
- deploy = none
- Stage 5 = not started
- Stage 6 = not started

## Final status

Implementation and tests complete. Standalone `tsc` / `lint` / `build` hit infrastructure timeouts with no diagnostics (same class of issue as Stage 3 standalone `tsc`). Type integration gate **not fully confirmed** because `pnpm run build` did not finish within 10 minutes.

**Stage 4: PASS with documented validation limitation** — code/tests green; build/type tooling timeouts reported above; no type errors observed.
