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

---

# Appendix A — Stage 6.1 Controlled Staging E2E Acceptance

Date: 2026-10-31. Scope: close the two remaining Stage 6 acceptance gates on
the shared Supabase project under an explicit owner authorization for
**exactly three traceable synthetic orders** plus exact-scope cleanup of those
orders and their items. Production/`main` untouched. Stage 7 not started.

## A.1 STATUS

**`PARTIAL / PASS-WITH-EXCEPTIONS`** — order E2E, idempotency and cleanup PASS.
Telegram acceptance remains **BLOCKED** (separate gate, no test bot/chat
configured). Stage 6 as a whole is therefore **not** a full PASS.

| Gate | Status |
|---|---|
| STEP 1 pre-flight / write-side-effect audit | PASS (see A.3 — `BLOCKED_CUSTOMER_SIDE_EFFECT` cleared by approved isolation) |
| STEP 2 evidence + cleanup plan | PASS |
| STEP 3 BRANCH / POSTOMAT / COURIER E2E | **PASS** (3/3, live UI checkout on Preview) |
| STEP 4 retry / fingerprint mismatch / timeout | **PASS** |
| STEP 5 Telegram acceptance | **BLOCKED** — Preview `TELEGRAM_BOT_TOKEN` is set but is not a valid bot token (17 chars, `getMe` 404); see A.10.3 |
| STEP 6 exact-scope cleanup | **PASS** |
| STEP 7 migration version reconciliation | PASS (read-only; discrepancy recorded, not repaired) |
| Production unchanged | **PASS** |

## A.2 Baseline

| Item | Value |
|---|---|
| Git HEAD (start) | `793e8d6d5012eb0a675ad1e8cd65206380448cac` on `dev` |
| Preview deployment | `dpl_9bQzCydg8fQRhUsbXbHEF8FAFMe8` → `carzo-storefront-hq0p7pa0r-yevgens-projects.vercel.app`, READY (24s build) |
| Preview env (branch `dev`, names + non-secret values) | `CATALOG_STORE=supabase`, `CONTENT_STORE=supabase`, `PAGE_STORE=supabase`, `ORDER_STORE=supabase`, `NOTIFICATION_SETTINGS_STORE=supabase`, `CUSTOMER_STORE=directus`. **`TELEGRAM_BOT_TOKEN` absent** |
| Supabase project | `Carzo`, `kmhegysmtsjqtwwaacht`, ACTIVE |
| Row counts (before) | orders **10**, order_items **17**, customers **5994** (all 10 orders `checkout_attempt_id = NULL`) |
| Production | `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9` — unchanged throughout |

## A.3 Preflight write-side-effect audit

Runtime paths inspected: `app/actions/checkout.ts` → `createOrderRecord`
(`create_order_with_items` RPC) → `runPostOrderSideEffects`
(`lib/cart/checkout-reliability.ts`) → `notifyNewOrder` + `upsertCustomerByPhone`.

| Write | Authorized? | Outcome |
|---|---|---|
| `orders` / `order_items` via RPC | **yes** (the 3-order authorization) | 3 orders + 3 items |
| Telegram send | separate gate | not attempted (no token, no approved chat) |
| Directus **order** write | **no** | none — `ORDER_STORE=supabase` writes only Supabase; verified 0 matches in Directus `carzo_orders` for all three order numbers |
| Directus **customer** write | **no** | none — see isolation below |
| Supabase **customer** write | **no** | none |

**`BLOCKED_CUSTOMER_SIDE_EFFECT` — resolved by owner-approved isolation.**
`runPostOrderSideEffects` calls `upsertCustomerByPhone` unconditionally after a
committed order. With `CUSTOMER_STORE=directus` that is `upsertByPhone`
(`lib/cart/customer-store/directus.ts`), which POSTs to `/items/customers` or
PATCHes the `carzo_site_settings` JSON registry **only when the phone is
unknown**. When the customer already exists it returns the existing row without
any write.

The owner approved the pre-existing synthetic registry record
**«Тестовий клієнт»** as the controlled test identity. Its phone is the
business's own public contact line (also published in the site footer), not a
third party's number; the value is withheld here. Pre-test verification
replicated `findByPhone` (directus collection 403 → registry fallback) and
confirmed exactly one match, so every post-order upsert was a **read-only
no-op**. Customer count stayed **5994** before, during and after all writes.

## A.4 Approval scope

Exactly **three** synthetic orders (one per delivery method) created through
the deployed Preview checkout flow, then **only** those three orders and their
owned `order_items` deleted by exact UUID allowlist. No fourth order. No
historical rows, no Directus data, no R2, no schema change beyond the bounded
RPC repair in A.7, no real shipments, no Nova Poshta booking calls (lookups
only).

## A.5 Case matrix (live UI checkout on Preview)

Server quote obtained from `POST /api/cart/quote` before each submit and
compared with the persisted order total.

| Case | Order number | Cart | Delivery snapshot | Quote → total | Result |
|---|---|---|---|---|---|
| **A. BRANCH** | `CZ-20261031-A46DB2` | 1 × L / design 4-0 / no logo / без фіксації | Київ → Відділення №1: вул. Пирогівський шлях, 135 (`type=branch`) | 2 590 → **2 590** | PASS |
| **B. POSTOMAT** | `CZ-20261031-D1891E` | 1 × M / design 2-0 / no logo / без фіксації (single line, qty 1 — satisfies `allowPostomat`) | Київ → Поштомат «Нова Пошта» №1001: вул. Сім'ї Кульженків, 31а (`type=postomat`) | 2 249 → **2 249** | PASS |
| **C. COURIER** | `CZ-20261031-3F83B7` | 1 × S / design 3-0 / no logo / без фіксації + loyalty | Київ → вул. Хрещатик, буд. 1 (courier) | 1 790 → **1 701** (loyalty −89) | PASS |

Per-case assertions (all three PASS):

- server quote equals the confirmed/persisted total;
- one order committed via `create_order_with_items`, exactly one linked
  `order_items` row;
- delivery + item snapshots match the live Nova Poshta lookup / catalog label;
- `checkout_attempt_id` non-null, unique, distinct per case;
- `loyalty_*` structured columns correct (A/B: all zero/NULL/false;
  C: `loyalty_phone` set, `eligible=true`, `percent=5`, `amount=89`,
  `phone_mismatch=false`);
- `manager_note` is `NULL` on all three — no loyalty JSON;
- customer fields did not contaminate any record (`customers` 5994 unchanged);
- no Directus order write (0 matches in `carzo_orders` per order number);
- success response returned the correct order number and total.

## A.6 Retry / fingerprint mismatch / timeout

Attempt used: `85840ada-f42f-4990-a159-59193a6d4864` (case A).

| Case | Expected | Observed |
|---|---|---|
| Replay identical request, identical `checkout_attempt_id` + fingerprint | `created:false`, same `id`/`order_number`/`total`, no new items | **PASS** — `created:false`, `5bac060a-…`, `CZ-20261031-A46DB2`, 2 590; `order_items` still 1 |
| Retry after lost HTTP response / client timeout (same persisted intent) | same as above | **PASS** — the replay path is the retry path; no additional order |
| Same `checkout_attempt_id`, **changed** material fingerprint | reject, leak no order data | **PASS** — `create_order_with_items: ATTEMPT_FINGERPRINT_MISMATCH` |
| Same `checkout_attempt_id`, **NULL** fingerprint | reject (unverifiable binding) | **PASS** — `ATTEMPT_FINGERPRINT_MISMATCH` |
| Best-effort side effects never flip a committed order to failed | order stays success | **PASS** — `runPostOrderSideEffects` semantics unchanged; notification/customer errors isolated |
| Replay must not resend notifications | no repeat send | **PASS** — side effects run only when `created:true` |

No duplicate order appeared at any point.

## A.7 Bounded repair — RPC request-fingerprint binding

**Defect found in Stage 6.1** (owner-directed repair): an order whose
`request_fingerprint` was `NULL` was replayable with *any* material intent —
the RPC returned `created:false` instead of rejecting, so a retry could
silently answer for a different cart than the one that created the order.

**Fix** (separate, verifiable, additive — function body only, no schema
change):

1. New orders must carry a non-empty `request_fingerprint`, else
   `INVALID_FINGERPRINT`.
2. A replay is accepted only when **both** sides have a fingerprint and they
   are equal. NULL on either side is treated as a mismatch
   (`ATTEMPT_FINGERPRINT_MISMATCH`), leaking no order data.

Applied as its own migration entry `require_order_request_fingerprint`
(`CREATE OR REPLACE FUNCTION`, grants re-applied: `service_role` only). Git
file: `supabase/migrations/20261101200000_require_order_request_fingerprint.sql`.

App layer aligned: `lib/cart/checkout-attempt.ts` gained
`isFingerprintBound(stored, request)` (missing stored fingerprint never binds),
used by `app/actions/checkout.ts` for the replay probe.

Verification:

- 6 rollback-only PostgreSQL cases (`BEGIN … ROLLBACK`, zero persistent rows):
  new + NULL fp → `INVALID_FINGERPRINT`; new + empty fp → `INVALID_FINGERPRINT`;
  new + valid fp → `created:true`; replay same fp → `created:false`; replay
  changed fp → `ATTEMPT_FINGERPRINT_MISMATCH`; replay NULL fp →
  `ATTEMPT_FINGERPRINT_MISMATCH`. **All PASS.**
- 3 new unit tests on `isFingerprintBound`; full suite 121 tests green
  (`test:stage6`, `checkout-attempt`, `test:loyalty`, `test:customer-store`,
  `test:checkout-reliability`, `test:order-notifications`).
- `tsc --noEmit` clean; `next lint` clean (pre-existing `no-img-element` /
  `alt-text` warnings only).
- The live case-A replay (A.6) exercises the repaired function on the shared
  project.

## A.8 Allowlisted UUIDs and cleanup outcome (no PII)

| Case | order_id | checkout_attempt_id | order_number | items |
|---|---|---|---|---|
| A | `5bac060a-5aad-4df0-98b1-4946bcc78614` | `85840ada-f42f-4990-a159-59193a6d4864` | `CZ-20261031-A46DB2` | 1 |
| B | `a682ae8d-0f63-4e82-a621-64586b056e3a` | `7461382b-d711-4650-ab46-36c9e3cbd018` | `CZ-20261031-D1891E` | 1 |
| C | `fcb4f326-276b-44c4-8a93-e829f2454334` | `f337ff94-e31b-416d-ac4b-d40b0b3d4562` | `CZ-20261031-3F83B7` | 1 |

Cleanup: single transaction, ownership assertions (each id ↔ expected
`order_number` + `checkout_attempt_id`), exact `WHERE id = ANY(<three>)` for
items then orders, row-count assertions, no date/name/phone/marker-wide
deletes. Result: 3 `order_items` + 3 `orders` deleted; nothing else touched.

An additional incident order (`b4c059f2-c99b-49d6-b13f-26ab8ccc27e6` /
`CZ-20261031-7DEEFE`) was created accidentally while probing RPC
discoverability before the test plan was executed. It used placeholder
delivery refs and a NULL fingerprint (it demonstrated the A.7 defect). It was
recorded, then deleted first under the same exact-UUID discipline, and its
counters confirmed restored before any acceptance order was placed. No
customer write and no Directus order write ever resulted from it.

## A.9 Row counts and cleanup proof

| Counter | Baseline | Peak (3 orders) | After cleanup |
|---|---|---|---|
| `orders` | 10 | 13 | **10** |
| `order_items` | 17 | 20 | **17** |
| `customers` | 5994 | 5994 | **5994** |
| synthetic orders (`checkout_attempt_id IS NOT NULL`) | 0 | 3 | **0** |
| legacy orders (`checkout_attempt_id IS NULL`) | 10 | 10 | **10** |
| target order_ids remaining | 0 | 3 | **0** |

## A.10 Telegram acceptance — BLOCKED

Status as of the A.10.3 attempt: `TELEGRAM_TEST_CHAT_IDS` is configured with
two owner-approved recipients and routing resolves to exactly those two, but
the Preview `TELEGRAM_BOT_TOKEN` is **not a valid Telegram bot token**, so the
control send could not be delivered. See A.10.3.

Earlier state (before the owner configured Preview): `TELEGRAM_BOT_TOKEN` was
absent from the Preview environment (confirmed by env
pull of the `dev` branch scope). `notification_settings` has
`channel = 'telegram'` and a non-empty `telegram_chat_ids` value that has
**not** been owner-approved as a test recipient (it is the production team's
chat) — it must not be used. No notification was sent.

To close this gate the owner must configure, **directly in Preview settings**,
a dedicated TEST bot token plus an explicitly approved test chat id, and
confirm there are no real customer chat ids on the Preview notification route.
Then at most one controlled message may be sent (ideally from one of the three
authorized orders) and checked for number / items / quantity discount / loyalty
discount / total and absence of Directus admin links; a repeat must not resend;
channel `email` must be reported `UNSUPPORTED`. Passing order E2E alone is not
a full Stage 6 PASS.

### A.10.1 Preview-only test configuration (prepared, not applied)

Nothing below has been applied. No message was sent, no `TELEGRAM_BOT_TOKEN`
was created or set, and `notification_settings` — including its
`telegram_chat_ids` — was **not** modified. The gate stays **BLOCKED** until
the test-message routing below is owner-agreed.

**Why the shared table is unsafe.** The Supabase notification reader
(`lib/data/notifications/supabase.ts`) takes the bot token from
`process.env.TELEGRAM_BOT_TOKEN` (environment-scoped — already safe) but takes
recipients from `notification_settings.telegram_chat_ids`, a **single row
shared by Preview and Production** in the same project. Putting a test chat id
there would also route production notifications; removing the production id
would break them. Neither is acceptable.

**Routing implemented.** Recipients are now environment-scoped so a test send
can only reach the approved test chat. The shipped mechanism (see
`lib/data/notifications/recipients.ts`, used by `notifyNewOrderSupabase`):

- **Non-production (Preview/development) → `TELEGRAM_TEST_CHAT_IDS` only.**
  A Preview-only variable of comma-separated numeric chat ids. It **fully
  replaces** the recipients — never merged with `notification_settings`.
  If it is missing, empty or malformed the send is **blocked**
  (`TEST_RECIPIENTS_UNAVAILABLE`); there is **no fallback** to the work chats.
- **Production → unchanged.** It keeps the historical
  `notification_settings` routing and ignores `TELEGRAM_TEST_CHAT_IDS` even if
  that variable is ever set there, so production behaviour is impossible to
  disturb by misconfiguration.

Not taken: an environment-keyed `notification_settings` row (cleaner long-term,
but needs a schema change and migration — deliberately out of scope for
Stage 6.1).

**Configuration to apply once routing is agreed** (values never entered in
chat, logs, or git — owner sets them in Vercel directly):

| Where | Key | Value | Visibility |
|---|---|---|---|
| Vercel → Preview (`dev` branch) | `TELEGRAM_BOT_TOKEN` | token of the **dedicated test bot** | Secret |
| Vercel → Preview (`dev` branch) | `TELEGRAM_TEST_CHAT_IDS` | numeric id of the **approved test chat** | Plain |
| `notification_settings` (Supabase) | — | **unchanged** | — |
| Vercel → Production | `TELEGRAM_BOT_TOKEN` | **not set** (unchanged) | — |

**Owner preparation steps.** Create a dedicated test bot (e.g. BotFather) and
a dedicated test chat/group to which **only** that bot is added; read the
chat's numeric id; confirm the Preview notification route contains no real
customer chat ids. Then set the two Preview variables above and redeploy.

**Acceptance once configured.** Exactly one controlled message, ideally arising
from one of the three authorized orders. Verify order number, items, quantity
discount, loyalty discount, total, and absence of Directus admin links. A
repeat attempt must not resend. Channel `email` must be reported `UNSUPPORTED`
rather than claiming delivery. Tokens and chat ids must never be printed.

### A.10.2 Test bot + test chat setup in Vercel (operator runbook)

Step-by-step for the owner. Nothing here has been executed by the agent; the
agent never creates bots, never joins chats, and never enters token or chat id
values anywhere.

**1. Create the dedicated test bot**

1. In Telegram open `@BotFather` → `/newbot`.
2. Choose a name and a username that clearly marks it as a test bot (for
   example `carzo_stage_test_bot`) so it cannot be mistaken for the production
   bot.
3. BotFather replies with the **bot token**. Treat it as a secret: do not paste
   it into chat, tickets, git or logs. Store it in a password manager until it
   is entered in Vercel.

**2. Create the dedicated test chat**

1. Create a new **private group** (or a channel) used only for Stage 6/7
   acceptance. Do **not** reuse the Carzo work chat.
2. Add **only** the new test bot to that chat. Do not add the production bot
   and do not add real customers.
3. Make the test bot an admin with permission to post messages.
4. Obtain the chat's numeric id:
   - add `@RawDataBot` (or `@userinfobot`) to the chat temporarily, read the
     `chat.id`, then remove it; or
   - call `https://api.telegram.org/bot<TOKEN>/getUpdates` after posting one
     message in the chat and read `message.chat.id`.
   The id is a negative number for groups/channels (for example
   `-100xxxxxxxxxx`). It is not a secret, but it must not be mixed with the
   production chat list, so keep it in the same password-manager entry as the
   token rather than in chat.

**3. Confirm the Preview route is isolated**

Before setting anything, re-verify that `notification_settings.telegram_chat_ids`
still contains **only** the production chat and that it is **not** modified by
this setup. The test chat id must never be written into that row — the Supabase
project is shared with production.

**4. Set the two Preview-only variables in Vercel**

Vercel → project `carzo-storefront` → Settings → Environment Variables, scope
**Preview** and the git branch **`dev`** only. Never Production, never
`All environments`.

| Name | Value | Type |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | the test bot token from step 1 | Secret |
| `TELEGRAM_TEST_CHAT_IDS` | the numeric test chat id from step 2 | Plain |

Notes:
- `TELEGRAM_TEST_CHAT_IDS` accepts one id or a comma-separated list; each entry
  must be digits with an optional leading `-`. Anything else is ignored and the
  send is blocked (by design).
- Do not set `TELEGRAM_BOT_TOKEN` on Production — the production notification
  path must keep working exactly as before.

**5. Redeploy Preview**

Push an empty commit or redeploy the `dev` branch so the new variables reach
the running build. Confirm the deployment is `READY` before testing.

**6. Behaviour after setup (already enforced by code)**

- Preview sends **only** to `TELEGRAM_TEST_CHAT_IDS` — a full replacement, never
  merged with `notification_settings.telegram_chat_ids`.
- If `TELEGRAM_TEST_CHAT_IDS` is missing, empty or malformed on Preview, the
  send is **blocked** and logged with reason `TEST_RECIPIENTS_UNAVAILABLE`; there
  is no fallback to the work chats.
- Production routing is unchanged and ignores `TELEGRAM_TEST_CHAT_IDS` even if
  it is ever set there.
- A replayed order (`created:false`) runs no follow-ups, so a retry cannot send
  a second message.

**7. Acceptance send**

See A.10.3 — executed against the Preview runtime and **not delivered**; the
configured `TELEGRAM_BOT_TOKEN` is not a valid bot token. The Telegram gate
remains **BLOCKED**.

### A.10.3 Telegram acceptance attempt — BLOCKED (invalid bot token)

Date: 2026-10-31. Owner authorised one controlled TEST message to the two
approved recipients, sent from the Preview runtime using the runtime
`TELEGRAM_BOT_TOKEN`, without creating orders and without changing Supabase or
Directus.

**Configuration verified (no secret values disclosed):**

| Check | Result |
|---|---|
| `VERCEL_ENV` on Preview (`dev`) | `preview` |
| `ORDER_STORE` / `NOTIFICATION_SETTINGS_STORE` | `supabase` / `supabase` |
| `TELEGRAM_BOT_TOKEN` present in Preview runtime | yes (Secret — not retrievable via `vercel env pull`/`env run`, used only in-runtime) |
| `TELEGRAM_TEST_CHAT_IDS` | 2 entries, both valid numeric chat ids |

**Routing verified with production code and live values.**
`resolveTelegramRecipients` (the function the Supabase notification path uses)
was evaluated with the real Preview env and the real `notification_settings`
row: it resolves to **exactly** the two `TELEGRAM_TEST_CHAT_IDS` entries
(`ROUTING_EQUALS_DECLARED = true`), full replacement — the shared
`notification_settings` list is never merged in. So notifications are directed
only to the two approved recipients.

Observed and recorded: the two approved recipients are **identical** to the
existing `notification_settings.telegram_chat_ids` entries (same SHA of the
sorted id set, overlap 2/2). `notification_settings` itself was never modified
(`updated_at = created_at = 2026-10-07 13:32:21`). Consequence: a Preview send
and a Production send would reach the same two destinations — the isolation
property holds in code but is not exercised by distinct destinations in this
configuration.

**Controlled send attempted from the Preview runtime.** A temporary
authorization-gated handler was deployed to Preview so the send would use the
runtime secret exactly as production does. It was triple-gated — Vercel
Deployment Protection, `VERCEL_ENV === 'preview'` only, and a one-time nonce
held in a temporary Preview env var — never wrote to Supabase or Directus,
never created orders, and emitted only masked chat references. Authorization
was verified: a request with no nonce and a request with a wrong nonce both
returned **404**.

**Delivery result — NOT DELIVERED.** Exactly one control message per recipient
was attempted (2 attempts, 2 recipients). Telegram rejected both with
**HTTP 404**. Runtime diagnostics (values never emitted):

| Diagnostic | Value |
|---|---|
| token present in runtime | yes |
| token length | **17** characters |
| matches bot-token shape `<digits>:<35 chars>` | **no** |
| stray quotes/spaces in value | no |
| `bot<token>/getMe` | **404**, `ok:false` |

A real Telegram bot token is ~46 characters (`<bot id>:<35-char secret>`). The
configured value is 17 characters and Telegram's `getMe` rejects it, so the
Preview `TELEGRAM_BOT_TOKEN` is **not a valid bot token**. Zero messages were
delivered to either recipient.

**Temporary mechanism removed completely.** The handler file was deleted and
untracked from git, its one-time nonce env var `STAGE6_CHECK_NONCE` was removed
from Vercel, and the redeployed Preview returns the application 404 page for
the former path. Verified: `git ls-files` has no trace of the handler,
`vercel env ls` has no `STAGE6_CHECK_NONCE`, and a POST to the former path
returns `404 NEXT_NOT_FOUND`.

**Safety held throughout.** No orders and no customers were created (orders
10, order_items 17, customers 5994, synthetic 0 — unchanged). No Supabase or
Directus writes. No real personal data was sent — the control text carries only
an explicit TEST marking. No token or chat id was printed, logged or committed.
Production/`main` untouched (`dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9`).

**Remaining action to close the gate.** Replace the Preview
`TELEGRAM_BOT_TOKEN` with a **valid** bot token (the full
`<bot id>:<secret>` string from BotFather, ~46 characters) and confirm
`getMe` returns `ok:true`. Then re-run the single control send; only after both
recipients confirm delivery may the Telegram gate move to PASS.

## A.11 Migration version reconciliation (read-only)

| Source | Entry |
|---|---|
| Git | `supabase/migrations/20261101120000_create_order_with_items_rpc.sql` |
| Remote history | `20261031164057_create_order_with_items_rpc` |
| Added by Stage 6.1 | remote `require_order_request_fingerprint` ↔ git `20261101200000_require_order_request_fingerprint.sql` |

The first pair is a **filename/version mismatch only** — identical content
(additive `orders.request_fingerprint` + `create_order_with_items`). Per the
acceptance contract the historical remote entry was **not** renamed and the
RPC was **not** re-applied as part of acceptance. Safe resolution: treat the
remote version as authoritative history and align the git filename in a later
non-acceptance chore commit, or record the mapping in the master plan. No
action taken here.

## A.12 Production unchanged

`main` deployment still `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9`
(`carzo-storefront-f3up8jypj`), created before this run and untouched
throughout. No `--prod` deploy, no push/merge to `main`, no production env
change. Keys remained server-only; no secrets, phone numbers, tokens or chat
ids printed in this document or in logs.

## A.13 Remaining blockers and next step

1. **Telegram acceptance** — BLOCKED on a **valid** Preview `TELEGRAM_BOT_TOKEN`
   (A.10.3). Routing and the two approved recipients are already in place and
   verified; the configured token is 17 characters and rejected by Telegram
   (`getMe` 404), so the control send could not be delivered. Until a real
   `<bot id>:<secret>` token is set and both recipients confirm delivery,
   Stage 6 is `PARTIAL`.
2. Migration filename mismatch (A.11) — cosmetic, needs a chore commit.
3. Nothing else. All order-side gates (E2E matrix, idempotency, fingerprint
   binding, cleanup, customer-store isolation) are closed.

**Next step:** replace the Preview `TELEGRAM_BOT_TOKEN` with a valid bot token
→ re-run the single control send (A.10.3) → once both approved recipients
confirm, the Telegram gate closes and Stage 6 may be declared PASS; only then
may Stage 7 begin. Directus is not retired; `CUSTOMER_STORE` stays
`directus`.
