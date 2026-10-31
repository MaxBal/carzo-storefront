# Supabase Stage 6 Result — Atomic Order Writes (staging first)

Date: 2026-10-31  
Scope: Stage 6 of the Directus → Supabase migration — Supabase becomes the
authoritative writer for new orders and order items **on staging**, with
idempotency, structured loyalty audit and a safe notification path.
Production/`main` untouched. Directus retained (not retired).

## 1. STATUS

**`IMPLEMENTED / STAGING WRITE ACCEPTANCE BLOCKED`**

Reason (exact remaining gates):

1. **Live checkout E2E not run.** The shared Supabase project
   (`kmhegysmtsjqtwwaacht`) is referenced by both Preview and Production.
   Per the execution contract §2.4, no synthetic order may be written to the
   shared database and no fabricated customer data may be created without
   explicit authorization for a traceable synthetic order + controlled
   cleanup, or an isolated test target. Awaiting that authorization for
   BRANCH / POSTOMAT / COURIER E2E.
2. **`TELEGRAM_BOT_TOKEN` is not set** in the Preview environment (same as
   Stage 5). Live Telegram delivery for Supabase orders cannot be accepted;
   mocked/unit coverage only. Needs a configured Preview bot token and
   explicitly approved test recipients.

Everything else is implemented, migrated, and verified against real PostgreSQL
transactions (rolled back), plus a deployed Preview (build READY, read-path
smoke green).

## 2. Git

| Item | Value |
|---|---|
| Baseline (Stage 5 PASS) | `36b00315001f97e63c420460593fd7314c80e758` |
| Feature commit (code/tests/SQL) | `08d9b0da80866c593b38414d534bdb1ea0f7371b` — `feat: supabase authoritative order writes with idempotency` |
| Deploy trigger commit | `2f1eae6` — `chore: trigger preview deploy with stage 6 order store flags` (empty) |
| Docs commit | this file (see log) |
| Branch | `dev` |
| Pushed | yes (`36b0031..08d9b0d`, `08d9b0d..2f1eae6`) |
| Tree | clean (only `.DS_Store` untracked) |
| Diff | 18 files, +1552/−156 (feature commit) |

Files: `app/actions/checkout.ts`, `components/cart/{CartDrawer,CartProvider,cart-context}.tsx|ts`,
`lib/cart/{types,validation,checkout-attempt}.ts`, `lib/data/orders/{types,index,directus,supabase}.ts`,
`lib/order-notifications.ts`, `package.json`, tests (`stage4-orders`,
`checkout-attempt`, `checkout-input-contract`), `docs/SUPABASE_STAGE6_DESIGN.md`,
`supabase/migrations/20261101120000_create_order_with_items_rpc.sql`.

## 3. Supabase

| Item | Value |
|---|---|
| Project | `Carzo`, ref `kmhegysmtsjqtwwaacht`, `eu-west-1`, ACTIVE (Free plan — no upgrades/branches created) |
| Migration file | `supabase/migrations/20261101120000_create_order_with_items_rpc.sql` |
| Migration history entry | `20261031164057_create_order_with_items_rpc` (applied exactly once via MCP `apply_migration`) |
| Schema changes | **additive only**: `orders.request_fingerprint text NULL` + function `create_order_with_items` |
| Function | `public.create_order_with_items(...) RETURNS jsonb`, `SECURITY INVOKER` (`prosecdef=false`), `VOLATILE`, `SET search_path = public` |
| Grants | `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`; `GRANT EXECUTE … TO service_role`. Verified: `has_function_privilege('anon'|'authenticated') = false`, `('service_role') = true`; `routine_privileges` shows only `postgres`+`service_role` |
| Table grants | unchanged — `orders`/`order_items`: `service_role` DML only; zero grants to `anon`/`authenticated`/`public` |
| RLS | unchanged, enabled with no policies (server-only posture). Advisor `rls_enabled_no_policy` ×28 (INFO) is intentional — deny-by-default, not a gap |
| Advisor (post) | one `function_search_path_mutable` WARN found on the new function and **fixed** (`SET search_path = public`); re-run clean |
| Historical rows | untouched: 10 orders / 17 order_items / 5,994 customers before and after; all 10 legacy orders keep `checkout_attempt_id = NULL`, `request_fingerprint = NULL` |

## 4. RPC — `create_order_with_items`

Contract (see `docs/SUPABASE_STAGE6_DESIGN.md` §1–2):

- Server-assembled snapshot (order columns + `p_items jsonb`) — browser prices/
  discounts never trusted; the RPC re-checks `line_total = unit_price × qty`,
  `items_quantity = Σ qty`, `subtotal = Σ line_total`,
  `total = subtotal − quantity_discount − loyalty_discount_amount`,
  non-negative amounts, non-empty items, valid enums (cast to
  `contact_method`/`delivery_method` rejects `email` etc.).
- **Idempotency**: non-null `checkout_attempt_id` mandatory in the RPC body
  (legacy NULL rows unreachable through it). Transaction-scoped advisory lock
  on the attempt id → lookup → insert with `UNIQUE (checkout_attempt_id)`
  backstop + order-number collision retry (12×, `CZ-YYYYMMDD-` + 6 hex, same
  presentation as the legacy generator).
- Returns `{id, order_number, total, created}` only. Replay returns the
  persisted values with `created:false` — no new items, no new number.
- **Fingerprint binding**: reused attempt + materially different intent
  (`request_fingerprint` mismatch) → `ATTEMPT_FINGERPRINT_MISMATCH` rejection,
  no order data leaked. Prices excluded from the fingerprint so a successful
  prior order stays retrievable after catalog drift (§6.7).
- Loyalty: five structured `loyalty_*` columns; `manager_note` human-only
  (loyalty JSON remains a Directus-only serialization).

**Transaction proof (real PostgreSQL, every test wrapped in `BEGIN … ROLLBACK`;
zero persistent rows):**

| # | Case | Result |
|---|---|---|
| 1 | New attempt → 1 order + 2 items, totals 5500/500/250/4750 | PASS |
| 2 | Same attempt replay → `created:false`, same id/number/total, still 2 items | PASS |
| 3 | Different attempt → distinct id/number | PASS |
| 4 | Same attempt + different fingerprint → rejected | PASS |
| 5 | NULL attempt id → `INVALID_ATTEMPT_ID` (SQL + PostgREST) | PASS |
| 6 | `line_total ≠ unit_price×qty` → `INVALID_ITEM_ARITHMETIC` | PASS |
| 7 | `items_quantity ≠ Σ qty` → `TOTALS_MISMATCH` | PASS |
| 8 | `total ≠ subtotal − discounts` → `TOTAL_FORMULA_MISMATCH` | PASS |
| 9 | Empty items → rejected | PASS |
| 10 | Negative discount → `INVALID_AMOUNTS` | PASS |
| 11 | Invalid enum (`email`) → rejected at cast boundary | PASS |
| 12 | Item insert failure (NULL sort) → order insert rolled back, zero orphans | PASS |
| 13 | Loyalty columns exact; `manager_note` free of loyalty JSON | PASS |
| 14 | Legacy NULL-attempt rows intact (10) | PASS |
| 15 | PostgREST discoverability: `POST /rest/v1/rpc/…` returns function error `22023` (not 404) | PASS |
| 16 | anon key via PostgREST → HTTP 401 `permission denied for function` (42501) | PASS |
| 17 | Order number format `CZ-[0-9]{8}-[0-9A-F]{6}` | PASS |

Cross-session concurrency: the advisory xact lock serializes same-attempt
callers before the lookup; the loser observes the winner and replays
(`created:false`), enforced by the unique constraint. A **committed** two-live-
session race proof requires a persistent test order on the shared project —
kept behind the E2E authorization gate (§1, §9). In-transaction double-call
replay (the same code path the loser takes) is verified (case 2).

## 5. Loyalty

Policy unchanged: normalized `+380XXXXXXXXX` phones, global 5% applied after
the quantity discount (≥2 → 200 ₴, ≥3 → 500 ₴; live rules authoritative).
`buildAuthoritativePricing` / `resolveLoyaltyState` untouched; their unit
coverage (37 tests) is green. New persistence mapping:

| Case | `loyalty_phone` | `eligible` | `percent` | `amount` | `phone_mismatch` |
|---|---|---|---|---|---|
| No loyalty phone | NULL | false | 0 | 0 | false |
| Mismatch phone | normalized | false | 0 | 0 | true |
| Eligible match | phone | true | 5 | 5% of (subtotal − qty disc.) | false |
| Non-existing phone | phone | false | 0 | 0 | false |
| Lookup outage | — | — | — | — | fail-closed `LOYALTY_UNAVAILABLE` (unchanged) |

Verified persisted-structured (RPC test 13): 5500/500/250/4750 with
`manager_note = NULL`. `customer_email` is never written for new orders
(historical field only). Quantity-tier key persisted in `discount_tier_key`.

## 6. Notifications

| Path | Behavior |
|---|---|
| `ORDER_STORE=directus` | Existing `notifyNewOrder` unchanged — Directus settings, Directus inbox (email), Directus Telegram bot settings, Directus admin order URL. Rollback + production path intact |
| `ORDER_STORE=supabase` | New `notifyNewOrderSupabase`: settings/templates/chat IDs from `notification_settings` via `lib/data/notifications/supabase.ts`; bot token **only** from server-side `TELEGRAM_BOT_TOKEN`. No Directus inbox, no Directus bot-token table, no Directus admin URL (message references the order number only) |
| Channel `email`/`both` (Supabase path) | **Explicitly unsupported** (no email provider): `email` → logged `UNSUPPORTED` + nothing sent; `both` → Telegram only + same log. Emails are never claimed sent |
| Replays | `runPostOrderSideEffects` runs only when `created:true` — no repeat Telegram, no repeat customer upsert on retry/double-click |
| Failure isolation | Notification/customer errors never flip a committed order to `FAILED` (unchanged `runPostOrderSideEffects`; sanitized `safeErrorDetail` logs — no chat ids, phones, tokens) |
| Live delivery | **Not accepted**: `TELEGRAM_BOT_TOKEN` absent on Preview; approved test recipients not configured. Acceptance gate open (§1) |
| Car-mat quote notifier | Untouched — still reads Directus settings. **Remaining Directus notification dependency**, documented for later stages |

Best-effort delivery can be lost after a process crash between commit and send
— documented gap; no durable outbox in this stage (would be a separate reviewed
design with unique event keys + bounded retry worker).

## 7. Customer backend

**Decision: `CUSTOMER_STORE` stays `directus` on Preview** (explicit, matches
master-plan sequencing — the plan moves customer store at Stage 9).

Consequences recorded:

- Loyalty lookup reads Directus customers (policy unchanged; the 5,994-row
  Supabase import is an Oct 13 snapshot and is **not** authoritative for
  loyalty).
- Post-order upsert writes Directus → **cross-store dependency**: Supabase
  orders + Directus customers. A later delta-reconciliation obligation exists
  (Supabase↔Directus customers) before any customer-store cutover.
- Never claimed: customers fully cut over. No cross-store silent failover.

`orders.customer_id` linkage remains optional and is not populated by the RPC
(post-commit linkage is a controlled later mechanism; FK
`ON DELETE SET NULL` untouched).

## 8. Preview

| Item | Value |
|---|---|
| Branch | `dev` |
| Env (names + non-secret values, branch-scoped `dev`) | `CATALOG_STORE=supabase`, `CONTENT_STORE=supabase`, `PAGE_STORE=supabase`, `ORDER_STORE=supabase` (**new**), `NOTIFICATION_SETTINGS_STORE=supabase` (**new**), `CUSTOMER_STORE=directus` (explicit). Secrets present: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DIRECTUS_URL`, `DIRECTUS_READ_TOKEN`, `NOVA_POSHTA_API_KEY`, `PREVIEW_SECRET`. **`TELEGRAM_BOT_TOKEN` absent** (gate §1) |
| Deployed code | commit `2f1eae6` (content = `08d9b0d`) via git auto-deploy; **no** `--prod` |
| Deployment | `dpl_HkAZ62M2zYcku1yaJ7DpjFiH5mFR` → `carzo-storefront-49ep6dnz1-yevgens-projects.vercel.app` |
| Build status | **READY** (26s) |
| Git alias | `carzo-storefront-git-dev-yevgens-projects.vercel.app` |
| Protection | Deployment Protection **ON**; smoke used `vercel curl` (automation bypass, secret never printed/echoed) |

Read-path smoke (no writes): homepage full render (R2 media, benefit modals
from Supabase), PDP `/case/design/l/4-0` (164KB), `/sitemap.xml`, and
`POST /api/cart/quote` live pricing (2 690 ₴ for L/4-0) — all served correctly
from the deployed Preview.

Note: local `next build` hangs under Node 23 (webpack build worker deadlock,
reproduced on the untouched baseline — environmental, not caused by this
change). Build verified green under Node 22.11 locally and on Vercel's builder.

## 9. E2E

| Case | Status |
|---|---|
| BRANCH / POSTOMAT / COURIER live checkout | **BLOCKED** — awaiting authorization for a traceable synthetic order + controlled cleanup (or isolated target) |
| Retry under simulated timeout returns the same order | verified at RPC level (replay cases); live end-to-end retry with the deployed UI needs the same authorization |
| Price-changed / loyalty-unavailable flows | covered by unit tests (`checkout-pricing`, 37 green); live re-confirm flow needs the E2E gate |
| Telegram delivery + post-commit failure handling | mocked/unit path implemented; live delivery **BLOCKED** on `TELEGRAM_BOT_TOKEN` + approved recipients |
| No unintended Directus order writes | Supabase order writer calls RPC only (zero `.from('orders').insert()`); Directus writer untouched and unreachable with `ORDER_STORE=supabase`; verified no non-legacy rows exist |

## 10. Safety

- **Production untouched**: `main` deployment still `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9`
  (`carzo-storefront-f3up8jypj`), same production env (names inspected, values
  never printed). No `--prod` deploy, no merge/cherry-pick to `main`.
- **Zero unauthorized persistent writes**: all integration tests transaction-
  wrapped and rolled back; counts unchanged (10/17/5,994/1). No synthetic
  orders, no fabricated customers, no historical cleanup.
- Historical orders/items untouched (10/17; `checkout_attempt_id` NULL intact).
- R2 and `/api/directus-assets` untouched; Directus runtime adapters intact.
- Keys server-only (`lib/supabase/server.ts`, `server-only`); no `NEXT_PUBLIC_*`
  exposure; no secrets in logs/docs (error logging sanitized; automation
  bypass used via `vercel curl`, never echoed — Stage 5 echo incident not
  repeated).
- No `DIRECTUS_ADMIN_TOKEN` / R2 write keys added to Preview runtime.
- Rate limiting: checkout server action now uses the repo's existing
  in-memory per-IP convention (20/min, same as `customer-discount/check`).
  Idempotency does not replace rate limiting (contract §13).
- No `SECURITY DEFINER`, no anon/auth policies, no public browser writes.
- Free-plan project only; no paid branches/projects created.

## 11. Rollback

Current state: **no Supabase-only orders exist** → a simple flag rollback is
viable (contract §12):

1. Preview/env: `ORDER_STORE=directus`, `NOTIFICATION_SETTINGS_STORE=directus`
   (restore `CUSTOMER_STORE=directus` — unchanged), redeploy Preview.
2. Keep `CATALOG_STORE`/`CONTENT_STORE`/`PAGE_STORE=supabase` (Stage 5 reads
   healthy). Production untouched.
3. Schema rollback if ever needed (additive): `DROP FUNCTION
   public.create_order_with_items(…)`; `ALTER TABLE public.orders DROP COLUMN
   request_fingerprint` — both zero-impact on historical rows.

After any Supabase-only order exists, flag rollback requires the §12
reconciliation plan first (freeze test submissions, identify UUIDs/counts
privately, no blind flips, no row deletion, `BLOCKED / RECONCILIATION REQUIRED`
until approved).

## 12. Next

- **Stage 7 QA only after Stage 6 PASS** — and Stage 6 PASS requires the two
  gates in §1 to close (authorized synthetic/isolated E2E with correct
  snapshots per delivery type + retry evidence; configured Preview
  `TELEGRAM_BOT_TOKEN` with approved test recipients for live delivery).
- No Stage 9/11/12 work started. Directus not retired.
- Recommended gate-closing sequence: (a) authorize a traceable synthetic order
  plan (or provide an isolated DB/branch with matching migrations) → run
  BRANCH/POSTOMAT/COURIER E2E + retry + snapshot comparison → record counts
  (no PII); (b) configure Preview `TELEGRAM_BOT_TOKEN` + dedicated test chat →
  accept one live message → document channel gaps (`email` unsupported).
- Known follow-ups (unchanged from earlier stages): OG image, product alt
  text, About-page Directus hardcode, car-mat quote notifications (Directus),
  customer delta reconciliation (before any `CUSTOMER_STORE` switch).
