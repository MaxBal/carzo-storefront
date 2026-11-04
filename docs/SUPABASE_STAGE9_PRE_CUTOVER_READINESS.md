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

## 6. Supabase migrations (P2-5) — audit only, nothing changed

Remote `supabase.schema_migrations` (9 rows) vs local `supabase/migrations/` (9 files):

| remote version / name | local file | state |
|---|---|---|
| 20261001203704 `rls_auto_enable` | same | match |
| 20261001211849 `create_customers` | same | match |
| 20261001213417 `tighten_customers_service_role_grants` | same | match |
| 20261007101747 `directus_exit_schema_foundation` | same | match |
| 20261007114221 `add_missing_fk_indexes` | same | match |
| **20261031164057** `create_order_with_items_rpc` | **20261101120000_create_order_with_items_rpc.sql** | **mismatch** |
| **20261031180954** `require_order_request_fingerprint` | **20261101200000_require_order_request_fingerprint.sql** | **mismatch** |
| 20261101172930 `stage7x_add_editorial_media_urls` | same | match |
| 20261103125918 `stage7x_drop_car_mat_placeholder_url` | same | match |

Both mismatched migrations are **applied and effective** on the remote side
(`create_order_with_items` RPC exists and was exercised; fingerprint rules
enforced at RPC level). Only the recorded version/filename pair differs.

**Proposed non-destructive sync (NOT executed — needs separate owner approval):**

1. `git mv` the two local files onto the remote versions:
   `20261101120000_create_order_with_items_rpc.sql` → `20261031164057_create_order_with_items_rpc.sql`,
   `20261101200000_require_order_request_fingerprint.sql` → `20261031180954_require_order_request_fingerprint.sql`.
   SQL content unchanged; no DB operation of any kind.
2. Commit to `dev` with a note referencing this audit.
3. Result: Git filenames match remote history 9/9; `supabase migration list`
   becomes consistent for every developer machine.

Explicitly rejected for now (and why): inserting registry rows to rewrite
history — mutates recorded history without approval; re-running `supabase db
push`/re-apply — forbidden (existing SQL functions must not be re-applied);
leaving it as-is forever — acceptable short-term (zero runtime impact) but keeps
P2-5 open.

---

## 7. Stage 9 readiness checklist

| # | item | state | notes |
|---|---|---|---|
| 1 | Six STORE flags | **ready** | Preview already 5×supabase + customers=directus; Stage 9 sets all six to `supabase` on Production in one step. Flag semantics + fail-fast validated by tests |
| 2 | Production secrets | **owner check required** | Needed on Production env at cutover: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `NOVA_POSHTA_API_KEY`, `DIRECTUS_URL`+`DIRECTUS_READ_TOKEN` (rollback only), `SITE_URL`. Values were never read into this work |
| 3 | Supabase customer store | **ready** | `customer-store/supabase.ts` exists (Stage 4/6); delta plan + merge precedence in 8B §5; current registry delta = 3 rows |
| 4 | Historical order import | **ready (plan v2.1)** | equality-first collisions, STOP rule, atomicity, replay proof — §3; tooling to be written at G1 prep inside the window |
| 5 | Telegram: orders + car-mat quotes | **ready** | both flows have Supabase settings + env-token paths; failure behavior tested; live smoke belongs to G5 (needs separate permission — no test messages sent here) |
| 6 | Nova Poshta | **owner check required** | code path unchanged; confirm `NOVA_POSHTA_API_KEY` present on Production env before G2 |
| 7 | Maintenance mode | **ready (dev)** | `CHECKOUT_MAINTENANCE=1` mechanism implemented + tested; not enabled anywhere |
| 8 | SEO / canonical / og / footer | **ready (dev)** | §5; remaining content decision: `privacy-policy` / `public-offer` are still **drafts** → those footer links 404 until published (owner content call) |
| 9 | Rollback | **ready (policy)** | 9A/9B split signed into the runbook (§4); applies at G4/G5 |
| 10 | Monitoring | **plan only** | Vercel logs (zero Directus host requests post-switch), checkout success, Telegram delivery, 24–72h burn-in; alerts/contacts to confirm at G2 |
| 11 | Supabase Free-plan decision | **BLOCKER — owner** | Production-on-Supabase availability/limits decision (Stage 7 backlog #10) is a hard prerequisite |
| 12 | Joint window Stage 8B → Stage 9 | **BLOCKER — owner** | one combined ≤90 min window (8B §7); G2 must declare Stage 9 executable before any freeze |

Supporting re-checks (all green on `dev` at 2026-11-03):
`pnpm exec tsc --noEmit` · `pnpm run lint` (pre-existing warnings only) ·
`pnpm run build` · unit suites 107/107 + 13/13 + 35/35 · integration 10/10 + 3/3.

---

## 8. What remains a blocker

1. **Supabase Free-plan / production-availability decision** (owner) — hard blocker.
2. **Joint window scheduling + Stage 9 readiness declaration** (owner, G2).
3. **Production env secrets verification** (owner/ops) — checklist §7-2/§7-6.
4. **P2-5 migration filename sync** (owner approval of the §6 proposal) — non-runtime blocker, must not be left silent.
5. **Draft legal pages** (`privacy-policy`, `public-offer`) — footer links 404 until the owner publishes them or re-points the links; publishing is a content decision (Stage 8B keeps drafts unpublished by design).
6. **Optional brand og:image** — current og-cover is a real product-photo crop; a designed 1200×630 brand banner can replace it later (image generation was unavailable: 403 membership).

## 9. Owner decisions requested

1. Approve (or amend) the maintenance-mode UX as the freeze mechanism (8B §2 Option A).
2. Approve Stage 8B plan **v2.1** (equality-first collisions + rollback 9A/9B).
3. Approve the §6 migration filename sync proposal (git rename only) — or accept P2-5 as documented-open.
4. Confirm the public canonical domain (`carzo-storefront.vercel.app` vs a custom domain → `SITE_URL` value).
5. Decide on publishing `privacy-policy` / `public-offer` drafts before cutover.
6. Supabase Free-plan decision.
7. Propose/confirm the joint Stage 8B→9 window (date, ≤90 min, on-call).
8. Permission for one live Telegram smoke at G5 (until then: no real messages).

## 10. Verdict

**NOT READY** — per the rule «не объявлять READY при незакрытой критической
зависимости», blockers §8-1…§8-3 are open. Engineering preparation is complete:
the quote-notification Directus dependency is removed and proven, maintenance
mode exists, the import/rollback rules are corrected, SEO config is fixed, and
the readiness matrix is filled. READY can be declared once the owner closes
§8-1…§8-3 and G2 confirms the window.

## 11. Safety ledger (this stage)

| action | count |
|---|---:|
| Supabase / Directus / R2 writes | 0 |
| Stage 8B apply | 0 |
| Real Telegram / notification sends | 0 |
| Freeze / maintenance enabled anywhere | 0 |
| Vercel env or Production changes | 0 |
| Stage 9 started | 0 |
| Migration history changes | 0 (proposal only) |
| `main` commits | 0 |
