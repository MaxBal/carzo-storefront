# SUPABASE STAGE 5 RESULT

**Final status: `BLOCKED`** — Stage 4 catalog adapter defect broke the Supabase read cutover build. Read flags rolled back; Preview recovered on Directus. Stage 6 not started.

## Baseline

- date/time: 2026-10-31 (UTC)
- branch: `dev`
- `origin/main`: `df8f3531ff9de2408525ac5caf6844d8c6e4d340` (production baseline, unchanged)
- `origin/dev`: `a0efc1bbd53f0330953cfc04c9becfb64de0b1c0` (`fix: close stage 4 validation gate`)
- working tree: clean (only untracked `.DS_Store` noise)
- Stage 4: **PASS** (`docs/SUPABASE_STAGE4_RESULT.md`), Stage 3: **PASS**, Stage 2A: **PASS**
- Supabase project: `Carzo` / `kmhegysmtsjqtwwaacht`
  - preflight note: project was paused on first contact (public DNS NXDOMAIN for `kmhegysmtsjqtwwaacht.supabase.co`); resumed by user; all data checks green afterwards

## Vercel

- account: `unisoftaua-8604` / team: **`yevgens-projects`**
- project: **`carzo-storefront`** (`prj_D6HYKiqCDNcJoMl2rah8ImaPimXW`), root directory `product-page`, framework nextjs
- Git integration: `MaxBal/carzo-storefront`, production branch `main`
- old `maxbals-projects` / `carzo-eight-staging`: not touched

### Preview deployments (branch `dev`)

| Purpose | Deployment ID | URL | Source | Status |
|---|---|---|---|---|
| Stage 5 cutover attempt | `dpl_6daD73h6QVBjiQYZCpcnpQbq7zfX` | `carzo-storefront-h3pwah8x3-yevgens-projects.vercel.app` (git alias `carzo-storefront-git-dev-yevgens-projects.vercel.app`) | git `dev` @ `a0efc1bbd53f0330953cfc04c9becfb64de0b1c0` | **ERROR** (build failure, see below) |
| Rollback | `dpl_HH7jgkLnVujwT8HAw3LWc1feXEHk` | `carzo-storefront-9ermntlvb-yevgens-projects.vercel.app` (git alias `carzo-storefront-git-dev-yevgens-projects.vercel.app`) | git `dev` @ `a0efc1bbd53f0330953cfc04c9becfb64de0b1c0` | **READY** |

Both created via Vercel API `POST /v13/deployments` with `gitSource` (Git integration path, no manufactured commits). Environment of both: Preview (production alias untouched).

### Production before / after (unchanged)

| | Before | After |
|---|---|---|
| Deployment ID | `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9` | `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9` |
| Alias | `https://carzo-storefront.vercel.app` | `https://carzo-storefront.vercel.app` |
| Commit SHA | `df8f3531ff9de2408525ac5caf6844d8c6e4d340` | `df8f3531ff9de2408525ac5caf6844d8c6e4d340` |
| HTTP probe | 200 | 200 |

## Effective Preview flags

Branch-scoped Preview variables (`preview` + git branch `dev`), verified at runtime with `vercel env run -e preview --git-branch dev`.

| Flag | During cutover attempt | After rollback (current) |
|---|---|---|
| `CATALOG_STORE` | `supabase` | `directus` |
| `CONTENT_STORE` | `supabase` | `directus` |
| `PAGE_STORE` | `supabase` | `directus` |
| `ORDER_STORE` | `directus` | `directus` |
| `CUSTOMER_STORE` | `directus` | `directus` |
| `NOTIFICATION_SETTINGS_STORE` | `directus` | `directus` |

`ORDER_STORE=supabase` never used (fail-closed `NOT_READY` until Stage 6).

## Credentials (presence only — no values recorded)

| Name | Preview scope | Note |
|---|---|---|
| `SUPABASE_URL` | yes | preview/dev entry; expected `https://kmhegysmtsjqtwwaacht.supabase.co` (non-secret reference) |
| `SUPABASE_SECRET_KEY` | yes | existing Production secret, target extended to `production+preview`, value unchanged |
| `DIRECTUS_URL` | yes | same (Production value preserved) |
| `DIRECTUS_READ_TOKEN` | yes | same (rollback/order path) |
| `NOVA_POSHTA_API_KEY` | yes | same (delivery UI) |
| `PREVIEW_SECRET` | yes | generated in this stage for preview/dev only (neither `PREVIEW_SECRET` nor `DIRECTUS_PREVIEW_SECRET` existed anywhere before; code fallback `PREVIEW_SECRET ?? DIRECTUS_PREVIEW_SECRET` resolves to it) |
| `DIRECTUS_ADMIN_TOKEN` | no (production only) | left untouched; **audit follow-up**: remove/rotate high-privilege runtime secrets after dependency analysis |
| `R2_*` (4 vars) | no (production only) | not needed at runtime for reads (media URLs come from DB) |
| `TELEGRAM_BOT_TOKEN` | not set anywhere | notification settings read from Directus in this stage |

Scope-extension method: Vercel API `PATCH /v1/projects/{id}/env/{envId}` with `target` only — production targets and values untouched (sensitive values are write-only, never read back). API rejects `gitBranch` on multi-target variables (HTTP 400), so the four extended secrets apply to Preview-wide; flags stay branch-scoped to `dev`. Supabase secret client remains server-side only; nothing exposed as `NEXT_PUBLIC_*`.

## Preflight data verification (Supabase, SELECT-only)

All counts match `docs/SUPABASE_STAGE3_PARITY_REPORT.md` exactly:

- designs=3, sizes=4, brands=26, variants=12, fixations=4, fixation_size_extras=16, discount_tiers=2
- product_media=17, gallery_images=57, content_sets=16, content_sections=48, faq_items=8
- rich_sections=4, rich_section_images=12, benefit_modals=6, logo_settings=1
- pages=4, page_blocks=5; site/homepage/about/review/video_review/car_mat settings = 1 each; notification_settings=1

Pricing reference (Stage 3) — **12/12 design × size exact match**:

| Size | Price | Old price |
|---|---|---|
| S | 1790 | 2100 |
| M | 2249 | 2600 |
| L | 2590 | 2900 |
| XL | 2990 | 3400 |

- brand logo surcharge: 25 brands × 290 UAH + `none`=0 — match
- fixation `both` extras by size: S +60, M +80, L +100, XL +120 — match
- quantity discounts: 2 items −200 UAH, 3 items −500 UAH — match
- product_media: **17/17** canonical slots, all `https://media.carzo.com.ua/...`; Directus refs in media fields (designs.selector, rich_section_images, product_media, gallery_images, logo_settings): **0**
- R2 public check: 3/3 Stage 2A critical files HTTP 200 (`image/jpeg`, byte sizes 342579 / 247992 / 97129 — exact)
- CMS reference: `home` + `delivery-and-payment` published; `privacy-policy` + `public-offer` draft (blocks: home-hero/home-story/home-features/home-cta published, public-offer-draft draft)

Unexplained drift vs Stage 3: **none**.

## Build failure diagnostic (cutover deployment)

- deployment: `dpl_6daD73h6QVBjiQYZCpcnpQbq7zfX`, source `a0efc1bbd53f0330953cfc04c9becfb64de0b1c0`
- routes: `/llms.txt` and `/sitemap.xml` (static prerender, both call `loadCatalog()`)
- error: `CatalogUnavailableError: Supabase fixation_size_extras read failed: column fixation_size_extras.key does not exist`
- exit: `pnpm run build` exit code 1 (build phase "Generating static pages")

### Root cause — Stage 4 catalog adapter defect

`product-page/lib/data/catalog/supabase.ts:81`

```
selectAll('fixation_size_extras', 'fixation_id,size_id,extra,fixation:key,sizes:code'),
```

PostgREST parses `fixation:key` / `sizes:code` as **column-alias** syntax (`alias:column` → `key` as `fixation`), not embedded-relation syntax. Table `fixation_size_extras` columns are `id, fixation_id, size_id, extra, created_at, updated_at` — no `key`, no `code` — so the query is rejected. The correct embed form is used one line below for variants: `designs:design_id(slug),sizes:size_id(code)` (i.e. `alias:fk_column(embedded_column)`).

Mapping code (`extraByFixation`, same file ~lines 101–113) already resolves keys via `fixation_id`/`size_id` maps with embed fallback, so the minimal repair is to drop the two bogus embed segments (or mirror the variants embed form `fixation:fixation_id(key),sizes:size_id(code)`).

Scope: **catalog domain only**. `lib/data/content/supabase.ts` and `lib/data/pages/supabase.ts` use flat column selects (no embed syntax) — not implicated; their runtime path was never reached. Stage 4 suites (17/17 etc.) passed because fixtures/mocks never executed this PostgREST select against the live schema.

### Stage 4.x repair task (bounded)

1. Fix the select string at `lib/data/catalog/supabase.ts:81`.
2. Add an integration test that executes the real catalog PostgREST selects against the schema shape (the mock-only suites cannot catch this class of defect).
3. Re-run Stage 5 (env flags + Preview deploy + full QA matrix).

Per Stage 5 rules, **no application code was modified in this stage**.

## QA matrix

`PASS` / `FAIL` / `NOT VERIFIED` with evidence. Cutover column = Supabase read flags; Rollback column = flags restored to `directus` (recovery smoke scope).

| Check | Cutover (supabase) | Rollback (directus) |
|---|---|---|
| Homepage `/` | **FAIL** — build never served it (prerender error on sibling routes; no cutover runtime) | **PASS** — HTTP 200, 47 019 B |
| About `/about` | NOT VERIFIED (build blocked) | **PASS** — HTTP 200, 53 801 B |
| 12/12 PDP | NOT VERIFIED (build blocked) | **PASS** (spot 2/2): `/case/design/s/2-0` 200, 194 298 B; `/case/design/xl/4-0/none` 307 → canonical `/case/design/xl/4-0` (expected brand canonicalization). Full 12/12 re-run required after Stage 4.x fix |
| Pricing (PDP/cart/quote) | NOT VERIFIED at runtime (DB-level reference 12/12 exact match in preflight) | NOT VERIFIED at runtime |
| Cart / checkout | NOT VERIFIED | NOT VERIFIED |
| Nova Poshta read-only | NOT VERIFIED | NOT VERIFIED |
| Car mats `/catalog-carmat` | NOT VERIFIED | **PASS** — HTTP 200, 38 404 B |
| Modals (product/benefit/logo/fixation) | NOT VERIFIED | NOT VERIFIED |
| Published CMS pages | NOT VERIFIED | NOT VERIFIED (outside recovery scope) |
| Draft pages not public | NOT VERIFIED | NOT VERIFIED |
| Protected draft preview | NOT VERIFIED (`PREVIEW_SECRET` present; test not reached) | NOT VERIFIED |
| `/sitemap.xml` | **FAIL** — build prerender error (exact diagnostic above) | **PASS** — HTTP 200, 1 903 B |
| `/llms.txt` | **FAIL** — build prerender error (exact diagnostic above) | **PASS** — HTTP 200, 4 616 B |
| R2 media | **PASS** (preflight: 17/17 slots + 3/3 critical files 200, sizes exact) | n/a |
| Runtime logs | NOT VERIFIED (deployment never reached READY — build-time failure captured instead) | NOT VERIFIED (Vercel runtime-logs API timed out twice; recorded as infrastructure limitation, 1 controlled retry only) |

Canonical SEO note: sitemap/canonical behavior against the Preview domain was not reached; no SEO rewriting was performed.

## Directus dependencies

- **After rollback (current state)**: all reads resolve to Directus — expected, that is the rollback state.
- **During cutover attempt**: catalog Supabase read failed **fail-closed** (`CatalogUnavailableError` / `CartQuoteError` code `UNAVAILABLE`); no silent Directus fallback and no default-price fallback observed — consistent with the Stage 4 fail-closed contract. Editorial local fallback masking was not evaluated because the build aborted first.
- **Intentional Directus (retained by design in Stage 5)**: order writer (`ORDER_STORE`), customer store (`CUSTOMER_STORE`), notification settings (`NOTIFICATION_SETTINGS_STORE`), plus legacy `lib/content/directus.ts`, `lib/pages/directus.ts`, `/api/directus-assets/[id]` as rollback paths.
- Unexpected Directus reads in switched domains: **none observed** (cutover runtime never started).

## Safety confirmations

| Check | Result |
|---|---|
| Production env modified | **no** (4 secrets had `target` extended to `production+preview` via API; production targets and values preserved) |
| Production deployment/domain changed | **no** (ID/alias/SHA identical before & after) |
| Supabase data writes / schema / RLS | **no** |
| Directus writes | **no** |
| R2 mutations | **no** |
| Orders / customers created | **no** |
| Notifications sent | **no** |
| Secrets in git/docs/logs | **no values recorded** (see hygiene note) |
| Stage 6 started | **no** |

Security hygiene note: while setting up authorized Preview access behind Vercel Deployment Protection (protection stayed ON), one Protection Bypass for Automation secret was accidentally echoed into session tool output. Remediated in-session: that secret was revoked via API (`revoke`, `regenerate=false`) after moving the `VERCEL_AUTOMATION_BYPASS_SECRET` role to a second, never-printed secret. The revoked value no longer works; no bypass secret value appears in this document.

## Rollback details

Trigger: Stage 5 failure/rollback procedure (material check failed — cutover build ERROR).

1. Failure recorded: Preview URL/ID, routes `/llms.txt` + `/sitemap.xml`, exact error and source commit (above).
2. `CATALOG_STORE` / `CONTENT_STORE` / `PAGE_STORE` restored to `directus` on Preview/dev (branch-scoped); `ORDER_STORE` / `CUSTOMER_STORE` / `NOTIFICATION_SETTINGS_STORE` left `directus`. Verified effective values via `vercel env run -e preview --git-branch dev`.
3. Fresh Preview deployment `dpl_HH7jgkLnVujwT8HAw3LWc1feXEHk` created from `dev` @ `a0efc1b` → **READY**; recovery smoke 5/5 routes + 2 PDP probes green.
4. Production untouched throughout.
5. `SUPABASE_URL`, `SUPABASE_SECRET_KEY` scope, `PREVIEW_SECRET` left in Preview scope (inert while flags read `directus`; ready for re-cutover after the Stage 4.x fix).

Rollback is fully reversible: flip the three flags back to `supabase` and redeploy Preview after the adapter fix.

## Documentation / git

- this file: `docs/SUPABASE_STAGE5_RESULT.md`
- commit: **not performed** — task prescribes the documentation commit on `dev` only if Stage 5 passes; status is `BLOCKED`. File left in the working tree for the Stage 4.x repair session (or commit on request).

## Final status

**Stage 5: `BLOCKED`**

Reason: the Supabase read cutover Preview (`dev` @ `a0efc1b`, `dpl_6daD73h6QVBjiQYZCpcnpQbq7zfX`) failed to build on a Stage 4 catalog adapter defect (`lib/data/catalog/supabase.ts:81`, wrong PostgREST embed syntax for `fixation_size_extras` → `column fixation_size_extras.key does not exist`). Per Stage 5 rules no runtime code was modified; read flags were rolled back to `directus` and Preview verified recovered. Production unchanged.

**Next step:** Stage 4.x repair task above, then re-run Stage 5. Stage 6 (atomic Supabase order writes, checkout idempotency, notification reliability) is **not started** and must not start until Stage 5 passes.

## Stage 4.2 repair — `PASS` (2026-10-31)

Repair task items 1–2 completed on `dev`. Item 3 (re-run Stage 5) deliberately not started here.

### Fixes applied — `product-page/lib/data/catalog/supabase.ts`

1. `fixation_size_extras` select is now `fixation_id,size_id,extra` (bogus column-alias segments `fixation:key,sizes:code` removed — they made PostgREST request non-existent columns `fixation_size_extras.key` / `.code`).
2. `id` added to the `sizes` and `fixations` selects, so the existing `sizeCodeById` / `fixationKeyById` maps resolve real UUIDs from `fixation_size_extras.fixation_id` / `.size_id`.
3. Extras mapping is now strict: a row whose `fixation_id` / `size_id` is empty or unmapped throws `CatalogUnavailableError` ("unmapped ids") instead of being silently skipped. Dead embed fallbacks removed.

### Integration test (read-only, live PostgREST)

`product-page/tests/supabase-catalog-integration.test.ts` (`pnpm run test:supabase-catalog`, real Supabase SELECTs through the server admin client; `tests/helpers/server-only-stub.cjs` neutralizes the Next-only `server-only` guard for Node runs). 8/8 PASS:

- all catalog selects complete against live PostgREST;
- all 16 `fixation_size_extras` rows mapped through UUID joins (fixation→key, size→code), none skipped;
- surcharge contract: `both`+S/M/L/XL = 60/80/100/120 грн, `none`/`bottom`/`wall` = 0 грн (also cross-checked in SQL);
- 12 variants = every design × size pair, positive prices;
- brands / fixations / discount tiers coherent;
- cart `quoteCartItems` unit prices and totals match the server-side calculation (variant + brand + per-size fixation surcharge);
- extras rows with unmapped UUIDs fail closed (rejected, not skipped);
- catalog read failure → `CatalogUnavailableError` (`UNAVAILABLE`), no Directus fallback.

### Validation

| Check | Result |
|---|---|
| Stage 4 regression (`pnpm run test:stage4`) | 17/17 PASS |
| Integration test (`pnpm run test:supabase-catalog`) | 8/8 PASS |
| `tsc --noEmit` | clean |
| `pnpm run lint` | clean (pre-existing `<img>`/alt warnings only) |
| Production/main, Vercel env, Supabase schema/data, R2, Stage 6 | untouched |

Status: **ready for Stage 5 re-run** (flip `CATALOG_STORE` / `CONTENT_STORE` / `PAGE_STORE` to `supabase` on Preview and repeat the QA matrix above).

---

# Stage 5 retry — `PASS` (2026-10-31)

Supersedes the "Final status" of the first attempt above (that record is kept verbatim as history).

## Baseline

| Item | Value |
|---|---|
| Repo / branch | `MaxBal/carzo-storefront` / `dev` |
| HEAD | `2d3859f34edfa89a42df10e4c2de0da6d4d9b471` (`fix: repair supabase catalog fixation mapping`) |
| Stage 4.2 | PASS — adapter fix + 8/8 integration tests + 17/17 Stage 4 regression |

## Cutover actions

1. Preview/dev env inspected (names/targets only; secret values never displayed). Present: `PREVIEW_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DIRECTUS_URL`, `DIRECTUS_READ_TOKEN`, `NOVA_POSHTA_API_KEY` (sensitive) + the six store flags (branch-scoped `dev`) + automation-bypass (protection, `isEnvVar`).
2. Store flags set on Preview (branch `dev`):

| Flag | Value |
|---|---|
| `CATALOG_STORE` | `supabase` |
| `CONTENT_STORE` | `supabase` |
| `PAGE_STORE` | `supabase` |
| `ORDER_STORE` | `directus` |
| `CUSTOMER_STORE` | `directus` |
| `NOTIFICATION_SETTINGS_STORE` | `directus` |

Effective values verified with `vercel env run -e preview --git-branch dev` (6/6 match).

3. Fresh Preview deployment from git `dev` @ `2d3859f` (redeploy of the git source):

| Item | Value |
|---|---|
| Deployment | `dpl_HKhu4Bpce3Kg2iXDppdDJGHwoKZn` |
| URL | `https://carzo-storefront-qevcd4wph-yevgens-projects.vercel.app` (git alias `carzo-storefront-git-dev-yevgens-projects.vercel.app`) |
| Commit | `2d3859f34edfa89a42df10e4c2de0da6d4d9b471` |
| Build | **READY in 58s** — first successful cutover build (the first attempt failed exactly here) |

## QA matrix

All checks ran against the cutover Preview with the automation-bypass header (Deployment Protection stays ON). Price expectations were taken from live Supabase SQL and compared to runtime output.

| Check | Result | Evidence |
|---|---|---|
| Homepage `/` | **PASS** | 200, 39 557 B |
| About `/about` | **PASS** | 200, 43 593 B |
| 12/12 PDP (`/case/design/{s,m,l,xl}/{2-0,3-0,4-0}`) | **PASS** | 12/12 × 200, each payload contains its base price + old price (S 1790/2100, M 2249/2600, L 2590/2900, XL 2990/3400) |
| Prices (PDP + cart quote) | **PASS** | quote API unit prices match `variants` rows 12/12 |
| Logo surcharges | **PASS** | `brandId=audi` + S → unit 2080 = 1790 + 290 (`brands.logo_extra`) |
| Fixation surcharges | **PASS** | `both` + S/M/L/XL → +60/+80/+100/+120 (1850/2329/2690/3110); `none`/`bottom`/`wall` → +0 |
| Quantity discounts | **PASS** | qty2 → −200 (`quantity-2`), qty3 → −500 (`quantity-3`); totals = subtotal − discount |
| Cart (mixed quote) | **PASS** | both+S×1 + none+M×2 → subtotal 6348, discount 500, total 5848, itemsQuantity 3. Checkout submission intentionally not exercised (creates real orders — out of scope) |
| Nova Poshta (read-only) | **PASS** | `/api/nova-poshta/cities?q=…` 200 (2 rows), `/api/nova-poshta/points?city=…&method=BRANCH` 200 (20 rows) — also proves `NOVA_POSHTA_API_KEY` is injected at runtime |
| Car mats `/catalog-carmat` | **PASS** | 200, 31 605 B |
| Modals (benefit content store) | **PASS** | benefit modal content embedded in page payload (content store read) |
| CMS published pages | **PASS** | `/delivery-and-payment` 200 (35 028 B) |
| Draft pages not public | **PASS** | `/privacy-policy` → 404 |
| Draft preview | **PASS** (limited) | `/api/draft` rejects missing/wrong secret → 401/401; `getPreviewPage('3d2d625f-…')` verified against the Supabase pages store (returns draft `privacy-policy`). Positive secret comparison not exercised: `PREVIEW_SECRET` is `sensitive` and unreadable by design (no rotation performed) |
| `/sitemap.xml` | **PASS** | 200, contains all 12 PDP URLs |
| `/llms.txt` | **PASS** | 200, 3 021 B |
| Cloudflare R2 media | **PASS** | media served via `https://media.carzo.com.ua/…` (R2 custom domain); 6/6 sampled files 200 (selector + brand logos) |
| Runtime logs | **PASS** (limited) | deployment events: zero catalog/runtime errors, build completed clean; `vercel logs` 30-min window: no error entries. Per-request log history not retained on Hobby plan (infrastructure limitation, same class as the first attempt) |

## Directus reads in switched domains

**No unexpected Directus reads.** Evidence chain:

1. Flags effective at runtime (`vercel env run`): `CATALOG_STORE`/`CONTENT_STORE`/`PAGE_STORE` = `supabase`.
2. The first attempt proved these exact build paths execute the Supabase catalog adapter (prerender of `/sitemap.xml`, `/llms.txt`, PDPs failed on the adapter defect). This build with the same paths **passed** → Supabase reads served the build; no fallback was needed.
3. The adapter has no silent cross-backend fallback (fail-closed, enforced by the Stage 4.2 integration test).
4. Quote endpoints returned values matching live Supabase SQL reference (prices, surcharges, tiers).
5. No `CatalogUnavailableError`/`UNAVAILABLE`/fetch errors in logs.

Retained Directus by design (unchanged): order writer (`ORDER_STORE`), customer store (`CUSTOMER_STORE`), notification settings (`NOTIFICATION_SETTINGS_STORE`), legacy `lib/content/directus.ts`, `lib/pages/directus.ts`, `/api/directus-assets/[id]` as rollback paths.

## Production / safety

| Check | Result |
|---|---|
| Production deployment | unchanged — `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9` READY @ `df8f3531ff9de2408525ac5caf6844d8c6e4d340` (identical before & after) |
| Production env / domain | untouched |
| Supabase data/schema writes | none |
| R2 mutations | none |
| Orders / customers created | none |
| Adapter rewrites in Stage 5 | none |
| Secret values printed | none (metadata only) |
| Stage 6 started | no |

Observation (pre-existing, out of scope): PDP payload references `https://carzo-eight.vercel.app/...` in canonical/OG-style URLs — staging project URL in site content; not introduced by this cutover.

## Final status

**Stage 5 retry: `PASS`** — Preview/dev left on Supabase reads (`CATALOG_STORE`/`CONTENT_STORE`/`PAGE_STORE` = `supabase`). Rollback remains one flag flip + redeploy away.

Next step: Stage 6 (atomic Supabase order writes, checkout idempotency, notification reliability) when authorized.
