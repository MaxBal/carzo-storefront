# SUPABASE STAGE 9 — PRE-CUTOVER READINESS

**Status: `PREPARED — NOT READY`** — engineering preparation in `dev` is complete;
READY is **not** declared while critical owner decisions and window steps remain
(see §10). Stage 8B apply and Stage 9 cutover are **not** authorized by this document.

- Date: 2026-11-03 (UTC) · Branch: `dev` · Basis: `docs/SUPABASE_STAGE8B_EXECUTION_PLAN.md` v2.1
- Scope of this stage: development and tests in `dev` only. Nothing was applied,
  frozen, switched, or sent (§11).

---

## 1. Remaining Directus runtime dependencies — eliminated for the quote path

### What was broken

With `NOTIFICATION_SETTINGS_STORE=supabase` the car-mat quote flow still used
Directus unconditionally: `notifyNewCarMatQuote` → `readSettings()`
(`carzo_notification_settings`), `sendTelegram` → `readTelegramBotSettings()`
(`carzo_telegram_bot_settings.bot_token`!), and `sendDirectusMessage` (Directus
inbox). This was the last unconditional Directus dependency in a normal user flow
(`CUSTOMER_STORE=directus` is flag-gated and flips with the Stage 9 flags).

### What was implemented (`dev`)

`lib/order-notifications.ts` now branches like the order path:

| concern | Supabase path (new) |
|---|---|
| settings/templates/chat ids | Supabase `notification_settings` reader (`lib/data/notifications/supabase.ts`, SELECT-only) |
| Telegram bot token | server env `TELEGRAM_BOT_TOKEN` only (never from DB, never from Directus) |
| recipients | `resolveTelegramRecipients` — non-production sends **only** to `TELEGRAM_TEST_CHAT_IDS`, missing value blocks the send (no work-chat fallback) |
| quote message | format preserved exactly («Новий запит на прорахунок автокилимків» + same 8 lines) |
| Directus requests | **zero** |
| email channel | logged UNSUPPORTED (same policy as the order path); live channel is `telegram`, so no behavior change today |
| Telegram failure | `delivered=false` returned to the action → customer sees «Не вдалося надіслати заявку…»; token redacted in logs; no throw |

The legacy Directus path remains behind `NOTIFICATION_SETTINGS_STORE=directus`
(Production until cutover) — Production behavior is unchanged.

### Verification

- `tests/carmat-quote-notifications.test.ts` (10 tests): format preservation,
  channel off, email-only, telegram failure → false, token redaction, missing
  token, test-chat-only routing on preview, production routing. **No real
  messages sent** (sender injected).
- `tests/carmat-quote-supabase-integration.test.ts` (3 tests, real Supabase
  SELECTs, Telegram HTTP intercepted): **zero Directus requests** through the
  full `notifyNewCarMatQuote` call; test-chat routing; telegram 500 → `false`.
- `tests/supabase-editorial-integration.test.ts` re-run: 10/10 green including
  «CONTENT_STORE=supabase makes zero Directus reads for switched domains».

### Normal user flows vs Directus at all six flags = `supabase`

| user flow | runtime backends | Directus? |
|---|---|---|
| homepage / about / car-mat / reviews | `CONTENT_STORE=supabase` | no (fetch-spy proven) |
| product pages, catalog, pricing | `CATALOG_STORE=supabase` | no |
| CMS pages / preview / sitemap | `PAGE_STORE=supabase` | no |
| checkout → order write | `ORDER_STORE=supabase` (RPC) | no |
| order Telegram notification | `notifyNewOrderSupabase` | no |
| car-mat quote notification | `notifyNewCarMatQuoteSupabase` (**new**) | no (integration-proven) |
| customer loyalty lookup/upsert | `CUSTOMER_STORE=supabase` | no |
| media files | R2 URLs in Supabase content (`/api/directus-assets` never referenced — integration-proven) | no |

**Confirmation:** with all six store flags = `supabase`, ordinary user scenarios
make **no Directus requests**. The `/api/directus-assets/[id]` route and the
`*/directus.ts` adapters remain in the codebase as the rollback path and are
inert while the flags read `supabase`.

---

## 2. Checkout maintenance mode (Stage 8B → Stage 9 window)

Implemented in `dev`; **not enabled anywhere** (Production untouched).

- Switch: server env `CHECKOUT_MAINTENANCE=1` (`true`/`on` accepted; unset = off).
- Enforcement: `lib/checkout-maintenance.ts` checked at the **server-action
  boundary** — `createOrder` returns `{code:'MAINTENANCE'}` and
  `submitCarMatQuote` returns its notice **before** validation, before any
  customer/order write, before any notification. Hiding a button alone would not
  be sufficient; this block is server-side.
- What keeps working: homepage, catalog, PDPs, cart editing, browsing.
- Customer message: «Оформлення замовлень тимчасово недоступне — ми оновлюємо
  систему. Кошик збережено…» (quotes get their own variant).
- No order loss/duplication possible: the gate runs before any persistence;
  the existing `checkout_attempt_id` idempotency is untouched.
- Safe re-enable: unset `CHECKOUT_MAINTENANCE`, no other step.
- Tests: `tests/checkout-maintenance.test.ts` (flag parsing, messages).
- UI note: the notice appears on submit attempt (server-returned message). A
  pre-submit banner can be added later if the owner wants one; it is not required
  for safety.

---

## 3. Historical order import safety (Stage 8B plan v2.1 — confirmed rules)

Refined in `docs/SUPABASE_STAGE8B_EXECUTION_PLAN.md` §4:

1. Identity collision (existing `order_number`, existing `id`, or existing item
   `(order_id, item_key)`) triggers a **full-payload equality compare**.
2. Equal → `skipped-identical`; **different → STOP** (window abort). A silent
   skip or an overwrite is forbidden.
3. Duplicate `item_key` inside one source order → STOP before any insert.
4. Atomic per-order transactions; replay of a successful import must yield
   `inserted=0, skipped-identical=N, stopped=0`.
5. Preserved byte-for-byte: source ids (all uuid-compatible — verified), order
   numbers (never regenerated), `created_at`, status, customer fields, delivery
   snapshot, prices/discounts/totals (never recalculated), item snapshots,
   `loyalty_*`, and explicit `NULL` `checkout_attempt_id` / `request_fingerprint`
   for legacy rows.

No INSERTs were executed — this stage ran zero writes (§11).

---

## 4. Rollback split (Stage 8B plan v2.1 — contradictions removed)

- **9A — before the first real Supabase order:** controlled return to Directus
  allowed after the consistency check (delete only import-created rows, restore
  pre-images if needed, re-run §6 checks against T0, then flags + unfreeze).
- **9B — after the first real Supabase order:** naive flag flip forbidden;
  automatic Directus unfreeze / old write path forbidden; preferred = forward-fix
  on Supabase; alternative = **full reconciliation** of Supabase-only orders into
  Directus (exact snapshots, verified counts) plus a fresh owner gate before any
  flag revert.

---

## 5. SEO and Production configuration (fixed in `dev`)

| item | before | after |
|---|---|---|
| SITE_URL fallback (`lib/seo.ts`) | `https://carzo-eight.vercel.app` | `https://carzo-storefront.vercel.app` (env `SITE_URL` still wins) |
| og:url / Organization url+logo (`app/layout.tsx`) | hardcoded `carzo-eight` | `absoluteSiteUrl()` / `siteOrigin()` |
| title duplication (`lib/pages/metadata.ts`) | CMS title + template = «… \| CARZO \| CARZO» | trailing `\| CARZO` stripped before the template |
| og:image | `case.jpg` declared 1200×630 but actually **1365×2048** | `public/og-cover.png` — real product photo, deterministic 1200×630 crop (AI image generation unavailable this session: 403 membership; no fabricated asset) |
| sitemap.xml / robots.txt | used `absoluteSiteUrl` | correct automatically once the origin is fixed; staging noindex logic unchanged |
| llms.txt | existed (dynamic, pages + products via `absoluteSiteUrl`) | unchanged code; inherits the corrected origin — content rebuilds from live CMS |
| footer hrefs (P2-1) | modal links pointed at 404 routes (`/delivery`, `/payment`, …) | `href="#"` + same onClick modal openers — **modal behavior and design unchanged** |
| modal design/behavior | — | untouched (owner constraint) |

Verified in `dev` via `tsc`, `eslint`, `next build` (all green; `/llms.txt`,
`/robots.txt`, `/sitemap.xml` in the route table).

---

## 5A. Release-blocker review fixes (2026-11-04)

An external review found four defects that had to be closed before cutover.
All four are fixed in `dev` and verified; none of them touched Production.

### 5A.1 Customer pagination — a truncated registry would have corrupted the plan

**Defect.** `fetchTarget()` issued one uncapped PostgREST SELECT per table.
`public.customers` holds 5,994 rows and PostgREST caps a response at 1000, so
the planner would have seen 1,000 customers and treated the other 4,994 phones
as "new" — inserting duplicates and corrupting the merge plan.

**Fix.** `scripts/stage8b-historical-import/paginate.ts` implements
`fetchAllPaginated`: range-paged reads with `count: 'exact'` as the
authoritative total, plus hard refusals for every way a read can be short —
collected ≠ total, total changing mid-read, a page error, and a boundary-sized
result with no reported total. An incomplete read is an error, never a quiet
subset.

**Evidence.** 11 fixture tests including a 5,994-row registry loading across 6
pages. Read-only check against the live Supabase: **5,994 rows / 5,994 unique
phones loaded in 6 page calls, `complete: true`.**

### 5A.2 Order verification — live Supabase orders were wrongly flagged

**Defect.** `runVerify()` treated *any* non-null `checkout_attempt_id` /
`request_fingerprint` as a violation. After Stage 9 those fields are exactly
what a correctly created live order carries, so every post-cutover order would
have failed `--verify`.

**Fix.** `scripts/stage8b-historical-import/verify.ts` classifies rows:
historical = both fields NULL; live = both present and non-empty; anything
else (`half-populated`, `live-without-fingerprint`, `live-without-attempt-id`)
is a real defect. `duplicate-attempt-id` is checked separately because the RPC
is idempotent on `checkout_attempt_id`. `--verify` now reports
`historical = N, live = M, inconsistent = K` and only fails on `K > 0` or on
genuine uniqueness/FK/arithmetic problems.

**Evidence.** 13 fixture tests covering the mixed base (historical + live),
repeated checkout attempts (idempotent single row vs. duplicate rows) and
whitespace-only ids. Live read-only check: the current 10 orders classify as
`historical=10, live=0, inconsistent=0`.

### 5A.3 Maintenance-mode contradiction in the runbook

**Defect.** the runbook asked for a control order *while*
`CHECKOUT_MAINTENANCE=1`, but `createOrder` blocks submits at the server-action
boundary in that state — the step was unachievable, and "grant permission for
one test order" would have been a hidden bypass of the freeze.

**Fix.** runbook §4.2–§4.7 resequenced: steps 1–10 are read-only and
write-nothing while frozen; step 11 is an explicit go/no-go; step 12 lifts
maintenance by the ordinary mechanism (unset + **redeploy**); only step 13
places the one authorized control order; step 14 re-freezes on failure.
Explicitly documented: there is **no bypass** (no test hook, no admin override,
no direct RPC), and a failure must **not** flip the STORE flags back — that is
rollback case 9B. Order loss is prevented by construction (the gate runs before
any persistence; there is no client queue).

### 5A.4 Git release strategy — `main` and `dev` share no ancestor

**Defect.** `git merge-base main dev` exits `1`; GitHub reports *"No common
ancestor between main and dev"*. A PR `dev → main` cannot exist.

**Fix.** runbook §3.3 documents the validated procedure: cut
`release/stage9` **from `main`**, bring over `product-page` `docs` `supabase`
via `git checkout dev -- <paths>`, review the full diff, exclude
secrets/local/QA artifacts, verify build + tests + STORE flags, then open a
**normal PR `release/stage9 → main`**. `main` history is never rewritten,
never force-pushed. Merge is owner-gated.

**Evidence.** dry-run executed in a local worktree (created, verified, then
deleted; nothing pushed): 71 files (38 added, 33 modified, **0 file
deletions**); secret scan found only two fake test-fixture values; `tsc`,
`next build`, `test:stage8b-import` 66/66, `test:customer-store` 32/32,
`test:stage9-prep` 13/13, `test:checkout-reliability` 12/12, `test:stage4`
19/19 all green; STORE flags unset → all six `directus` (Stage A changes no
data path), all `supabase` → `supabase`, invalid → fail-closed.

---

## 6. Supabase migrations (P2-5) — reconciled, file-only

Remote `supabase.schema_migrations` (9 rows) vs local `supabase/migrations/` (9 files).
Before reconciliation two rows mismatched on the version/filename pair only:

| remote version / name | local file (before) | local file (after) |
|---|---|---|
| 20261001203704 `rls_auto_enable` | same | same |
| 20261001211849 `create_customers` | same | same |
| 20261001213417 `tighten_customers_service_role_grants` | same | same |
| 20261007101747 `directus_exit_schema_foundation` | same | same |
| 20261007114221 `add_missing_fk_indexes` | same | same |
| 20261031164057 `create_order_with_items_rpc` | `20261101120000_…` | **`20261031164057_…`** (renamed) |
| 20261031180954 `require_order_request_fingerprint` | `20261101200000_…` | **`20261031180954_…`** (renamed) |
| 20261101172930 `stage7x_add_editorial_media_urls` | same | same |
| 20261103125918 `stage7x_drop_car_mat_placeholder_url` | same | same |

**Result: Git filenames match the remote history 9/9.**

### 6.1 Verification performed before the rename

1. **Content re-compared.** `diff` of the two local files shows exactly the
   documented two-stage relationship: `20261031164057` creates the RPC and
   adds `request_fingerprint`; `20261031180954` tightens the fingerprint
   binding (adds `INVALID_FINGERPRINT`, turns the lenient mismatch check into
   an unconditional one). The live remote function body contains the
   fingerprint-stage markers (`v_existing_fingerprint`,
   `ATTEMPT_FINGERPRINT_MISMATCH`, `INVALID_FINGERPRINT`) — i.e. the remote
   effective state equals the **final** local file, as expected for two
   sequentially applied migrations. `orders.request_fingerprint` and
   `orders.checkout_attempt_id` exist and are nullable (verified via
   `information_schema.columns`), matching what the historical import needs.
2. **Change is exclusively file-level.** `git diff --cached --numstat` reports
   `0 0` for both renames — zero lines added or removed. No SQL byte changed.
3. **No re-apply risk.** `supabase db push` skips any version already present
   in `supabase_migrations.schema_migrations`. After the rename all 9 local
   versions are registered remotely → **zero** migrations would be applied.
   Before the rename the two unmatched local versions would have been treated
   as new and re-applied (re-creating the function and re-running the
   `ADD COLUMN IF NOT EXISTS`) — so the rename *removes* the re-apply risk
   rather than creating one.
4. **No remote operation of any kind.** No `apply_migration`, no `db push`, no
   registry insert, no history rewrite.

### 6.2 Explicitly rejected alternatives (unchanged)

Inserting registry rows to rewrite history — mutates recorded history without
approval. Re-running `supabase db push` / re-apply — forbidden (existing SQL
functions must not be re-applied). Leaving it as-is — acceptable short-term
(zero runtime impact) but keeps P2-5 open.

---

## 7. Stage 9 readiness checklist

| # | item | state | notes |
|---|---|---|---|
| 1 | Six STORE flags | **ready** | Preview already 5×supabase + customers=directus; Stage 9 sets all six to `supabase` on Production in one step. Flag semantics + fail-fast validated by tests |
| 2 | Production secrets | **owner check required** | Needed on Production env at cutover: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `NOVA_POSHTA_API_KEY`, `DIRECTUS_URL`+`DIRECTUS_READ_TOKEN` (rollback only), `SITE_URL`. Values were never read into this work |
| 3 | Supabase customer store | **ready** | `customer-store/supabase.ts` exists (Stage 4/6); delta plan + merge precedence in 8B §5; current registry delta = 3 rows |
| 4 | Historical order import | **ready (tooling shipped)** | equality-first collisions, STOP rule, atomicity, replay proof — §3. Tooling: `scripts/stage8b-historical-import/` (`--audit`/`--dry-run`/`--verify`/`--apply`). Complete paged customer reads (5,994 proven), historical-vs-live order verification (§5A). 66/66 fixture tests + live ROLLBACK drill proven. Real `--apply` intentionally not run |
| 5 | Telegram: orders + car-mat quotes | **ready** | both flows have Supabase settings + env-token paths; failure behavior tested; live smoke belongs to G5 (needs separate permission — no test messages sent here) |
| 6 | Nova Poshta | **owner check required** | code path unchanged; confirm `NOVA_POSHTA_API_KEY` present on Production env before G2 |
| 7 | Maintenance mode | **ready (dev)** | `CHECKOUT_MAINTENANCE=1` mechanism implemented + tested; not enabled anywhere |
| 8 | SEO / canonical / og / footer | **ready (dev)** | §5; remaining content decision: `privacy-policy` / `public-offer` are still **drafts** → those footer links 404 until published (owner content call) |
| 9 | Rollback | **ready (policy)** | 9A/9B split signed into the runbook (§4); applies at G4/G5 |
| 10 | Monitoring | **plan only** | Vercel logs (zero Directus host requests post-switch), checkout success, Telegram delivery, 24–72h burn-in; alerts/contacts to confirm at G2 |
| 11 | Supabase Free-plan decision | **OWNER DECISION DEFERRED** | Owner decision recorded §8.1: remain on Free for development/preparation. Free plan does **not** block Stage 8B/9 preparation. Separate explicit owner acceptance of the Free risks is required **immediately before cutover**; cutover is not automatically authorized |
| 12 | Joint window Stage 8B → Stage 9 | **BLOCKER — owner** | one combined ≤90 min window (8B §7); G2 must declare Stage 9 executable before any freeze. Runbook: `docs/SUPABASE_STAGE9_RELEASE_RUNBOOK.md` |

Supporting re-checks (all green on `dev` at 2026-11-03):
`pnpm exec tsc --noEmit` · `pnpm run lint` (pre-existing warnings only) ·
`pnpm run build` · unit suites 107/107 + 13/13 + 35/35 · integration 10/10 + 3/3.

---

## 8. What remains a blocker

1. **Joint window scheduling + Stage 9 readiness declaration** (owner, G2).
2. **Production env secrets verification** (owner/ops) — checklist §7-2/§7-6.
3. **Draft legal pages** (`privacy-policy`, `public-offer`) — footer links 404 until the owner publishes them or re-points the links; publishing is a content decision (Stage 8B keeps drafts unpublished by design).
4. **Optional brand og:image** — current og-cover is a real product-photo crop; a designed 1200×630 brand banner can replace it later (image generation was unavailable: 403 membership).

### 8.1 Supabase Free — recorded owner decision

**Decision (owner, 2026-11-03): remain on Supabase Free.**

Until development and technical preparation of the site are fully complete,
the following are **not required**: a Supabase Pro upgrade, paid monitoring
services, a separate monitoring infrastructure, Telegram availability alerts,
or a purchased backup service. The owner will reconsider the paid plan,
monitoring and backups **after** technical readiness.

Consequences for this document and for the runbook:

- The Free-plan status changes from a hard blocker to
  **`OWNER DECISION DEFERRED`**.
- Free plan does **not** block development, testing, or Stage 8B/9
  preparation. No Pro upgrade is a prerequisite for any of those.
- This decision does **not** mean the Free-plan risks are absent. They are
  carried in the separate pre-production checklist below (§8.2), not deleted.
- Immediately before the actual Production cutover the owner must give a
  **separate, explicit confirmation** that running Production on Free is
  acceptable given those risks, together with the agreed minimal data
  protection / recovery baseline.
- Production cutover is **not** automatically authorized by this document or
  by the decision to stay on Free.

No Supabase plan setting or project setting was changed.

### 8.2 Pre-production checklist — Free-plan risks (carried, not closed)

These are **not** development blockers. They must be acknowledged and given a
minimal mitigation before the cutover step, as part of the owner confirmation
in §8.1.

| # | risk | why it matters at cutover | minimal mitigation (owner to confirm) |
|---|---|---|---|
| 1 | Free-tier availability / resource limits | Production traffic shares the free pool; sustained load can degrade or pause the project | confirm current usage headroom before the window; agree a 24–72h burn-in watch on checkout success |
| 2 | No managed point-in-time recovery | an operator mistake or bad deploy cannot be rewound to an arbitrary minute | keep the T0 canonical export (8B §1) for the whole window + 7 days; treat it as the recovery floor |
| 3 | No uptime SLA / no alerting | an outage is discovered by customers, not by a monitor | agree who is on-call for the window and for burn-in; manual check cadence (owner to name the contact) |
| 4 | Backup retention on Free | automated backups are limited; long-term history lives only in this project | T0 export retained outside the project; Stage 10 must not destroy Directus until a Supabase-side export is verified |
| 5 | Single-project blast radius | no separate infra for monitoring or restore | all restore steps documented in the release runbook §7; rehearsed via the ROLLBACK drill |

## 9. Owner decisions requested

1. Approve (or amend) the maintenance-mode UX as the freeze mechanism (8B §2 Option A).
2. Approve Stage 8B plan **v2.1** (equality-first collisions + rollback 9A/9B).
3. Approve the Stage A Production pre-release (merge `dev → main` + deploy, flags unchanged) — `docs/SUPABASE_STAGE9_RELEASE_RUNBOOK.md` §3.
4. Confirm the public canonical domain (`carzo-storefront.vercel.app` vs a custom domain → `SITE_URL` value).
5. Decide on publishing `privacy-policy` / `public-offer` drafts before cutover.
6. **Immediately before cutover:** separate explicit confirmation of running Production on Supabase Free with the §8.2 risks, plus the minimal protection/recovery baseline. (The decision to *stay* on Free is already recorded §8.1.)
7. Propose/confirm the joint Stage 8B→9 window (date, ≤90 min, on-call).
8. Permission for one live Telegram smoke at G5 (until then: no real messages).
9. Secure export location + retention for the T0 snapshot (8B §1).

## 9.1 Stage 9 readiness matrix (final)

| Проверка | Требование | State |
|---|---|---|
| Supabase Content | PASS | PASS — 7/7 integration, zero Directus reads |
| Supabase Catalog | PASS | PASS — 8/8 integration, no Directus fallback |
| Supabase Orders | PASS | PASS — RPC + fingerprint rules effective |
| Supabase Customers | PASS | PASS — schema + merge rules + 5,994 rows preserved |
| Telegram Orders | PASS | PASS — Supabase settings + env-token path |
| Telegram Car-mat Quotes | PASS | PASS — 3/3 integration, zero Directus requests |
| Nova Poshta | PASS | PASS — code path unchanged; key present-check at cutover |
| Checkout Maintenance | PASS | PASS — 13/13, implemented in `dev`, enabled nowhere. Window sequencing fixed §5A.3: no control order while frozen, no bypass |
| Historical Import Tooling | PASS | PASS — 66/66 fixtures + live ROLLBACK drill. Complete paged reads (5,994 proven) + historical/live order verify (§5A.1–5A.2). `--apply` gated and not run |
| Production Release Plan | READY | READY — `docs/SUPABASE_STAGE9_RELEASE_RUNBOOK.md`, incl. release-branch procedure §3.3 (`main`/`dev` unrelated histories) |
| Rollback Plan | READY | READY — 9A/9B split in runbook §7; re-freeze-not-flag-revert rule §4.5 |
| SEO / Sitemap / Canonical | PASS | PASS — §5 |
| Cloudflare R2 | PASS | PASS — media URLs stable, no Directus UUID refs |
| Supabase Free Decision | DEFERRED — owner review before cutover | **OWNER DECISION DEFERRED** — §8.1; separate confirmation required at cutover |
| Combined 8B/9 Window | NOT SCHEDULED | **NOT SCHEDULED** — owner, G2 |

**Verdict on the matrix:** all technical checks are PASS and both plans are
READY. The two remaining rows are owner-scheduling and owner-acceptance items,
not engineering gaps.

## 10. Verdict

**TECHNICAL PREPARATION — COMPLETE. PRODUCTION CUTOVER — NOT AUTHORIZED.**

Per the rule «не объявлять READY при незакрытой критической зависимости», the
overall readiness state stays **`PREPARED — NOT READY`** while §8-1 (window +
G2 declaration) and §8-2 (Production secrets verification) are open, and while
the §8.1 pre-cutover owner confirmation on the Free plan has not been given.

Engineering preparation is complete: the quote-notification Directus
dependency is removed and proven, maintenance mode exists, the import/rollback
rules are corrected and tooled, SEO config is fixed, the migration filenames
are reconciled, the two-stage release plan is written, and the readiness
matrix is filled. READY can be declared once the owner closes §8-1…§8-2, gives
the §8.1 confirmation, and G2 confirms the window.

## 11. Safety ledger (this stage)

| action | count |
|---|---:|
| Supabase / Directus / R2 writes (real data) | 0 |
| Stage 8B apply (real) | 0 |
| ROLLBACK drills (no persistence) | 1 — counts unchanged, 0 rows |
| Real Telegram / notification sends | 0 |
| Nova Poshta shipments | 0 |
| Freeze / maintenance enabled anywhere | 0 |
| Vercel env or Production changes | 0 |
| Supabase plan / project setting changes | 0 |
| Stage 9 started | 0 |
| Stage 10 started | 0 |
| Migration history changes (remote) | 0 |
| Local migration files renamed (content unchanged) | 2 |
| `main` commits | 0 |

