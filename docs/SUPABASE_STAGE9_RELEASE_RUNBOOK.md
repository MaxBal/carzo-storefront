# SUPABASE STAGE 9 — PRODUCTION RELEASE RUNBOOK

**Status: `PLAN ONLY — NOT AUTHORIZED TO EXECUTE`**

This runbook is the operator-facing sequence for the two-stage Production
release that ends with the Directus → Supabase cutover. It is prepared in
`dev` only. **Nothing in it has been executed.** No Production change, no
maintenance mode, no data transfer, no message of any kind has been sent.

- Prepared: 2026-11-03 (UTC) · Branch: `dev` · Basis: `docs/SUPABASE_STAGE8B_EXECUTION_PLAN.md` v2.1
- Companion: `docs/SUPABASE_STAGE9_PRE_CUTOVER_READINESS.md`
- Every step below is gated. A gate that is not closed is a STOP, not a
  suggestion.

---

## 0. Non-negotiable constraints

| constraint | meaning |
|---|---|
| No Production change without owner approval | `main`, Production deployment, Production env vars are read-only for this preparation |
| No real `--apply` during preparation | the historical import tool is exercised on fixtures and ROLLBACK drills only |
| No real orders/customers transferred | only fixtures; real delta runs inside the Stage 8B window |
| No maintenance mode on Production | `CHECKOUT_MAINTENANCE` is implemented in `dev`, enabled nowhere |
| No Directus shutdown | Directus stays up through burn-in; retirement is Stage 10/11 |
| No Telegram / Nova Poshta side effects from the import | notification and shipment creation belong to live checkout only |
| No Supabase plan change | stays on **Free** until the owner re-decides (§7) |
| No Stage 10 | Directus removal is explicitly out of scope |

---

## 1. Current architecture (exact state at preparation time)

### Runtime data path

| domain | Production today | target after Stage 9 | flag |
|---|---|---|---|
| catalog / pricing | Directus | Supabase | `CATALOG_STORE` |
| editorial content | Directus | Supabase | `CONTENT_STORE` |
| CMS pages | Directus | Supabase | `PAGE_STORE` |
| order write | Directus | Supabase (RPC `create_order_with_items`) | `ORDER_STORE` |
| customer / loyalty | Directus JSON registry | Supabase `public.customers` | `CUSTOMER_STORE` |
| notification settings | Directus | Supabase | `NOTIFICATION_SETTINGS_STORE` |
| media files | Cloudflare R2 | Cloudflare R2 (unchanged) | — |
| Telegram bot token | Vercel env | Vercel env (unchanged, never in DB) | — |

All six flags resolve through a single `switch` per domain
(`lib/data/*/index.ts`, `lib/cart/customer-store/config.ts`). With every flag
set to `supabase` the Directus adapters are never constructed. Proven by
integration tests (§5).

### What is already implemented in `dev`

- Supabase schema for all 28 application tables.
- `create_order_with_items` RPC with idempotency (`checkout_attempt_id`) and
  fingerprint binding (`request_fingerprint`).
- Supabase readers for catalog, content, pages, notifications, customers.
- Supabase order writer.
- `CHECKOUT_MAINTENANCE` server-side freeze at the action boundary.
- Car-mat quote notification on the Supabase settings path with env-only bot
  token and test-chat routing on non-production.
- Historical import tooling (§2).

### Rollback code posture

The Directus adapters, `*/directus.ts`, and `/api/directus-assets/[id]` remain
in the codebase as the rollback path. They are inert while the flags read
`supabase`. **Do not delete them** — full removal is Stage 10 only.

---

## 2. Migration tooling readiness

Tool: `product-page/scripts/stage8b-historical-import/`

| capability | state |
|---|---|
| customer import from `carzo_site_settings.customers` | ready |
| phone normalization to `+380XXXXXXXXX` | ready |
| existing customers preserved (never mass-overwritten) | ready |
| `source` / `imported` / `legacy_*` preserved | ready |
| data conflict → STOP | ready |
| idempotent re-run | ready (fixture-proven) |
| order import `carzo_orders → orders` | ready |
| item import `carzo_order_items → order_items` | ready |
| original UUID / order_number / created_at / money preserved | ready |
| `checkout_attempt_id = NULL`, `request_fingerprint = NULL` | ready |
| INSERT-only (no upsert, no RPC) | ready |
| transactional atomicity (one transaction per unit) | ready |
| full payload compare on identity collision | ready |
| identical → skipped-identical | ready |
| different → STOP | ready |
| no Telegram / Nova Poshta side effects | ready |
| `--audit` / `--dry-run` / `--verify` / `--apply` | ready |
| `--apply` requires typed phrase + ack + `STAGE8B_ALLOW_APPLY=1` | ready |
| real `--apply` executed | **NOT DONE — forbidden in preparation** |

Evidence:
- 40/40 fixture tests (`pnpm run test:stage8b-import`).
- ROLLBACK drill executed against live Supabase: the generated script inserted
  a fixture customer + order + item inside `BEGIN … ROLLBACK`; counts
  `customers=5994, orders=10, order_items=17` were identical before and after,
  and 0 drill rows persisted.

Execution model: the tool emits a **transactional SQL script**
(`--out-sql`), always with a matching `.drill.sql` that ends in `ROLLBACK`.
Real execution happens through the trusted admin channel (psql / Supabase SQL
editor) inside the Stage 8B window — the tool never writes silently. This is
deliberate: PostgREST cannot express a multi-statement transaction, so the
atomic unit lives in the SQL script, not in the client.

---

## 3. Stage A — pre-release of a compatible Production build

**Purpose:** get the freeze mechanism and the rollback-safe code shape onto
Production **before** any data migration, while Directus is still the active
backend and nothing about the data path changes.

### What Stage A is

A normal Production deploy of the `dev` codebase with **all six STORE flags
left at `directus`** (or left unset — unset resolves to `directus`, which is
the documented production default; no silent switch).

### What Stage A must contain

| requirement | how it is met |
|---|---|
| new maintenance mechanism present | `lib/checkout-maintenance.ts` + enforcement in `createOrder` / `submitCarMatQuote` |
| Directus still the active backend | flags untouched |
| order source unchanged | `ORDER_STORE` still `directus` |
| customer registry unchanged | `CUSTOMER_STORE` still `directus` |
| all site functions preserved | full regression (§3.2) |
| verified order-blocking mechanism | `CHECKOUT_MAINTENANCE=1` test on a staging deploy |

### 3.1 Stage A sequence

1. Confirm `dev` is green: `pnpm exec tsc --noEmit`, `pnpm run lint`,
   `pnpm run build`, unit suites, integration suites.
2. Open a PR `dev → main` with this runbook linked. **Do not merge without
   owner approval.**
3. On merge, deploy Production (`npx vercel --prod --yes`).
4. Verify the deploy:
   - homepage, catalog, PDP, cart, CMS pages render as before;
   - a checkout **completes** and lands in Directus as before;
   - no new env var is set — `CHECKOUT_MAINTENANCE` must be **absent**;
   - no Directus behavior change (this build is flag-compatible).
5. Verify the freeze switch **without enabling it in Production**: on a
   staging deploy set `CHECKOUT_MAINTENANCE=1` and confirm a submit returns
   the maintenance message and writes nothing. Then unset it.
6. Record the Production deploy URL + commit SHA in the window log.

### 3.2 Stage A regression checklist

| check | expected |
|---|---|
| homepage / about / car-mat / reviews | render, content correct |
| catalog + pricing | prices match Directus values |
| product page + gallery | images load (R2) |
| CMS pages / sitemap / robots / llms.txt | serve correctly |
| cart + checkout happy path | order created in **Directus** |
| customer loyalty lookup/upsert | registry unchanged in shape |
| Telegram order notification | delivers |
| car-mat quote | submits and notifies |
| Nova Poshta point search | returns points |
| footer modals | open; no 404 hrefs |
| `CHECKOUT_MAINTENANCE` absent | checkout works |

**Stage A does not switch anything.** It only guarantees that the freeze
switch exists and is verified before the window.

---

## 4. Stage B — the combined Stage 8B → Stage 9 window

**One continuous window, ≤ 90 minutes.** Stage 8B transfer and Stage 9 switch
must never be separated: a transfer done earlier while Production still writes
to Directus loses the gap between transfer and cutover.

### 4.1 Budget

| block | minutes |
|---|---:|
| readiness confirm | 10 |
| freeze + rescan | 15 |
| transfer | 15 |
| integrity | 15 |
| cutover | 15 |
| verify | 15 |
| buffer | 5 |
| **total** | **≤ 90** |

Overrun → §6 stop conditions.

### 4.2 Ordered sequence

| # | step | owner/engineer | gate | detail |
|---|---|---|---|---|
| 1 | **Production readiness check** | engineer | G1 | Stage A deploy confirmed live; secrets present on Production env: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `NOVA_POSHTA_API_KEY`, `SITE_URL`, plus `DIRECTUS_URL` + `DIRECTUS_READ_TOKEN` kept for rollback. Values never read into reports. |
| 2 | **Enable maintenance mode** | engineer | G3 | Set `CHECKOUT_MAINTENANCE=1` on Production env **and redeploy** (Vercel env changes need a new deploy). Confirm a submit is rejected server-side and writes nothing. |
| 3 | **Confirm no new orders reach Directus** | engineer | G3 | Submit a test checkout attempt → expect the maintenance message, and confirm `carzo_orders` count is unchanged. |
| 4 | **Final Directus ↔ Supabase comparison** | engineer | G3 | T0 rescan inside the freeze: counts + SHA-256 of canonical exports (8B §1/§3). Nothing may change while it runs. |
| 5 | **Transfer current customers** | engineer | G4 | `stage8b:import --dry-run` → review → emit SQL → execute via admin channel. Registry → `public.customers`, insert-only, existing rows untouched. |
| 6 | **Transfer missing historical orders** | engineer | G4 | Same tool, orders + items. INSERT-only, one transaction per order, NULL fingerprints. |
| 7 | **Count + integrity verification** | engineer | G4 | `stage8b:import --verify` + the 8B §6 checklist: counts, unique keys, FK integrity, history hashes, PII scan. All green or STOP. |
| 8 | **Switch the six STORE flags** | engineer | G4→G5 | Set `CATALOG_STORE`, `CONTENT_STORE`, `PAGE_STORE`, `ORDER_STORE`, `CUSTOMER_STORE`, `NOTIFICATION_SETTINGS_STORE` = `supabase` on Production env. |
| 9 | **Deploy Production** | engineer | G4→G5 | `npx vercel --prod --yes`. Env changes only take effect on the new deploy. |
| 10 | **Verify a new checkout** | engineer | G5 | Unfreeze first? No — see step 13. While frozen, this step uses a controlled verification order: see §4.3. |
| 11 | **Verify Telegram** | engineer | G5 | Order notification delivers. **One live smoke only, with explicit owner permission.** Until then: no real messages. |
| 12 | **Verify Nova Poshta** | engineer | G5 | Point search / shipment path responds. No shipment is created by the import itself. |
| 13 | **Disable maintenance mode** | engineer | G5 | Unset `CHECKOUT_MAINTENANCE`, redeploy. Order intake resumes **on Supabase**. |
| 14 | **Monitor new orders** | engineer + owner | G5→G6 | 24–72h burn-in: zero Directus host requests in Vercel logs, checkout success rate, Telegram delivery. |

### 4.3 Order of steps 10–13 (why verification precedes unfreeze)

Steps 10–12 verify the switched stack **while intake is still frozen** using a
single controlled test order created through the live RPC path after the flag
switch and deploy (step 9), granted explicit permission for exactly one test
order. If any of 10–12 fails, intake is never reopened and §6/§7 apply.
Only after 10–12 are green does step 13 lift the freeze.

**No Directus write may happen between step 4 (final comparison) and step 13
(intake resumed on Supabase).** That is the invariant the whole sequence
exists to protect.

### 4.4 Vercel environment note

Changing a Vercel environment variable does **not** affect a running deploy.
Every flag change in step 8 and every maintenance toggle (steps 2, 13)
requires a **new deploy** to take effect. Budget the redeploy time into the
window; do not assume the change is live because the dashboard saved it.

---

## 5. Verification evidence (already collected in `dev`)

| area | test | result |
|---|---|---|
| historical import core | `test:stage8b-import` | 40/40 |
| import atomicity | ROLLBACK drill on live Supabase | counts unchanged, 0 rows |
| editorial → Supabase | `test:supabase-editorial` | 7/7, zero Directus reads |
| catalog → Supabase | `test:supabase-catalog` | 8/8, no Directus fallback |
| car-mat quote → Supabase | `test:carmat-supabase` | 3/3, zero Directus requests |
| checkout maintenance | `test:stage9-prep` | 13/13 |
| customer store / loyalty | `test:customer-store`, `test:loyalty` | 32/32, 37/37 |
| typecheck / lint / build | `tsc --noEmit`, `lint`, `build` | green |

---

## 6. STOP criteria (abort the window immediately)

Do not continue to the next step if **any** of:

1. A write lands in Directus after the freeze timestamp that is not in the T0
   rescan.
2. The delta rescan shows `changed-during-window` rows without owner
   confirmation.
3. A customer name conflict (8B §5) is detected.
4. Any count / unique / FK invariant fails at step 7.
5. A historical row cannot be inserted without altering identity or money.
6. A pre-existing order hash differs pre/post (history mutation attempt).
7. The 90-minute budget is exceeded.
8. Stage 9 deploy/smoke fails and cannot be fixed inside budget.
9. Any of `--audit` / `--dry-run` / `--verify` reports `stopped=true`.

On abort: follow §7 rollback, keep flags unchanged, unfreeze **only** after
source/target consistency is re-verified against the T0 baseline.

---

## 7. Rollback — two distinct cases

The dividing line is **the first real Supabase order** (a production checkout
written by the live RPC path after the switch — not a Stage 8B import row).

### 7A. Before the first real Supabase order

Controlled return to Directus is allowed after a consistency check:

1. The apply log names every inserted id. Nothing outside that log is touched.
2. Delete/restore **only what this run created** — `order_items` cascade with
   their order; an inserted customer is deleted only if unreferenced, else
   kept + reported.
3. Restore pre-images if any pre-existing row was modified (must not happen;
   if it does → §6 abort + owner escalation).
4. Re-run the step-7 checklist against T0 and re-compare Directus ↔ Supabase
   counts. Only then restore the `*_STORE` flags and unfreeze.
5. File the delta report (`BLOCKED` if root cause unknown) and re-plan.

### 7B. After the first real Supabase order

- **Forbidden:** any naive `*_STORE → directus` flag flip.
- **Forbidden:** automatically resuming the old Directus order write path.
- **Preferred:** forward-fix on Supabase.
- **Alternative:** full reconciliation first — export every Supabase-only
  order + items into Directus as exact snapshots, verify counts and keys on
  both sides, and only then — with a fresh owner gate — flip flags back.

Forbidden "fixes" in both cases: manual edits to make counts match; re-running
`--apply` to "clean up"; deleting customers; any migration apply during
rollback.

---

## 8. Owner decisions required

| # | decision | needed at |
|---|---|---|
| 1 | Approve Stage A release (merge `dev → main` + Production deploy) | before Stage A |
| 2 | Approve this runbook and 8B plan v2.1 (G0) | before window |
| 3 | Approve customer merge precedence + STOP-on-name-conflict | before window |
| 4 | Confirm classification of order `CZ-20261013-BD3D52` | before window |
| 5 | Approve the migration filename sync (already executed as file-only rename; see readiness §6) | now |
| 6 | Confirm public canonical domain → `SITE_URL` value | before Stage A |
| 7 | Decide on publishing `privacy-policy` / `public-offer` drafts | before cutover |
| 8 | **Explicit acceptance of running Production on Supabase Free and its availability/backup risks** | **immediately before cutover** |
| 9 | Propose/confirm the combined window (date, ≤90 min, on-call) (G2) | before window |
| 10 | Permission for exactly one live Telegram smoke at step 11 | at step 11 |
| 11 | Secure export location + retention for the T0 snapshot | before window |
| 12 | Confirm Production env secrets are in place | before window |

### 8.1 Supabase Free — recorded owner decision

The owner has decided: **remain on Supabase Free** for the remainder of
development and technical preparation. No Pro upgrade, no paid monitoring, no
separate monitoring infrastructure, no Telegram uptime alerts, and no paid
backup service are required before technical readiness is complete.

This decision is recorded, not resolved. The Free-plan risks (availability
limits, no managed point-in-time recovery, no SLA) remain real. Therefore:

- Free plan does **not** block development, testing, or Stage 8B/9 preparation.
- The Free-plan status is `OWNER DECISION DEFERRED`.
- Immediately before the actual Production cutover the owner must give a
  **separate, explicit confirmation** that running Production on Free is
  acceptable given those risks, together with a minimal agreed protection and
  data-recovery baseline (T0 export + its retention is the floor).
- Production cutover is **not** automatically authorized by this document.

---

## 9. Confirmation of non-action

This runbook preparation changed nothing outside `dev`:

| action | count |
|---|---:|
| Production / `main` commits | 0 |
| Production deployments | 0 |
| Vercel env changes | 0 |
| Supabase / Directus writes (real data) | 0 |
| Stage 8B apply (real) | 0 |
| Maintenance enabled anywhere | 0 |
| Telegram / Nova Poshta activity | 0 |
| Supabase plan changes | 0 |
| Directus shutdown | 0 |
| Stage 9 cutover started | 0 |
| Stage 10 started | 0 |
