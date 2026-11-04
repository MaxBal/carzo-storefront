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
2. Build the release branch from `main` and PR it into `main` — **not** `dev →
   main`; the two histories are unrelated (see §3.3). **Do not merge without
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
| all six STORE flags unset on Vercel | resolve to `directus` (fail-closed default) |

**Stage A does not switch anything.** It only guarantees that the freeze
switch exists and is verified before the window.

### 3.3 Git release strategy — `main` and `dev` have no common ancestor

**The problem.** `main` (2 commits, `7d6bd67` "Initial production baseline" →
`df8f353`) and `dev` (145+ commits) were started from unrelated roots.
`git merge-base main dev` exits `1` and GitHub reports *"No common ancestor
between main and dev"*. A normal PR `dev → main` is therefore impossible, and
`git merge --allow-unrelated-histories` would fabricate a shared history and
produce a whole-tree conflict.

**The strategy.** Release through a short-lived branch cut from `main`, carrying
only the verified state of the required paths. `main` history is never rewritten
and never force-pushed.

#### 3.3.1 Exact procedure

```bash
# 0. never touch main directly
git fetch origin
git switch dev

# 1. cut the release branch FROM MAIN (not from dev)
git switch -c release/stage9 main

# 2. bring over the verified state of the required paths from dev
git checkout dev -- product-page docs supabase

# 3. review the FULL diff against main
git diff --stat main...HEAD        # note: plain `main HEAD` once histories are unrelated
git diff --name-status main HEAD

# 4. exclusions — assert these are ABSENT from the diff (see 3.3.2)
git diff --name-only main HEAD | grep -iE '\.env|secret|credential|token|\.pem|\.key|id_rsa'

# 5. verify the release state (must be run with env present)
cd product-page
pnpm install
pnpm exec tsc --noEmit && pnpm run lint && pnpm run build
pnpm run test:stage8b-import && pnpm run test:customer-store \
  && pnpm run test:stage9-prep && pnpm run test:stage4 \
  && pnpm run test:supabase-catalog && pnpm run test:supabase-editorial

# 6. commit on the release branch
git add -A && git commit -m "release: stage 9 pre-release (Stage A) from dev"

# 7. push the release branch (no force, no main writes)
git push -u origin release/stage9

# 8. open a PR:  release/stage9  ->  main   (normal PR, normal merge commit)
gh pr create --base main --head release/stage9 \
  --title "release: Stage 9 pre-release (Stage A)" \
  --body "See docs/SUPABASE_STAGE9_RELEASE_RUNBOOK.md §3. No STORE flag change. Maintenance mode NOT enabled."
```

**Merge is owner-gated.** Do not merge the PR without explicit owner approval.
After merge, delete the release branch. Never `git push --force` to `main`, never
`git rebase` `main`, never amend a published `main` commit.

#### 3.3.2 What the release must contain — and what it must not

Bring over exactly these paths from `dev`:

| path | why |
|---|---|
| `product-page/` | the application under test (`app/`, `components/`, `lib/`, `scripts/`, `tests/`, `public/`, `package.json`) |
| `docs/` | Stage 5–9 documentation the runbook references |
| `supabase/` | migration files (file names aligned with the remote registry) |

Exclusions — assert none of these appear in the diff:

| excluded | why |
|---|---|
| `.env*` | secrets. `.gitignore` already covers `.env*`; verify with the grep in step 4 |
| `qa-artifacts/`, `.playwright-cli/`, `*.DS_Store` | local QA/temp artifacts, untracked in both trees |
| `product-page/node_modules/`, `.next/`, `tsconfig.tsbuildinfo` | build output |
| anything under `~/.config`, SSH keys, tokens | never in the tree |

Validated dry-run of this exact procedure (2026-11-04, local worktree, no
push, no merge):

| check | result |
|---|---|
| files changed vs `main` | 71 (38 added, 33 modified, **0 file deletions**) |
| diff size | 11,580 insertions / 773 deletions (line-level inside modified files) |
| secret scan of the full diff | 2 hits, both fake values inside test fixtures (`'integration-test-token'`, `'stage7x-fallback-test-placeholder'`) — **no real secret** |
| `.env*` in the diff | none |
| QA artifacts in the diff | none |
| `tsc --noEmit` | green |
| `next build` | green (13/13 routes; `llms.txt` + `sitemap.xml` need env at build time — they fail only in an env-less tree) |
| `test:stage8b-import` | 66/66 |
| `test:customer-store` | 32/32 |
| `test:stage9-prep` | 13/13 |
| `test:checkout-reliability` | 12/12 |
| `test:stage4` | 19/19 |
| STORE flags, unset | all six → `directus` (Stage A changes no data path) |
| STORE flags, all `supabase` | all six → `supabase` |
| STORE flags, invalid value | throws — fail-closed |

The dry-run worktree was discarded afterwards; no branch was pushed and `main`
is unchanged.

#### 3.3.3 Why this is safe

- `main` receives a **normal merge commit** from a branch that descends from
  `main`, so `main` history stays linear and is never rewritten.
- Only named paths enter `main`; anything untracked in `dev` cannot leak in
  because the bring-over uses `git checkout dev -- <path>`, which only copies
  **tracked** content.
- The release branch is a review artifact: the PR diff is exactly the 71 files
  above, so review is bounded.
- If the PR must be abandoned, just delete the branch. `main` is untouched
  either way.

---

## 4. Stage B — the combined Stage 8B → Stage 9 window

**One continuous window, ≤ 90 minutes.** Stage 8B transfer and Stage 9 switch
must never be separated: a transfer done earlier while Production still writes
to Directus loses the gap between transfer and cutover.

### 4.1 Budget

| block | minutes | covers step |
|---|---:|---|
| readiness confirm | 10 | 1 |
| freeze + rescan | 15 | 2–4 |
| transfer | 15 | 5–6 |
| integrity | 15 | 7 |
| cutover (flags + deploy) | 15 | 8–9 |
| read-only verification | 10 | 10 |
| go / no-go | 5 | 11 |
| unfreeze + control order | 10 | 12–13 |
| re-freeze reserve | 5 | 14 (only on failure) |
| **total** | **≤ 90** | |

The re-freeze reserve is not slack to be consumed by a slow transfer — if it
is needed, the window is at its limit and step 15 (monitoring) starts after
the window closes. Overrun → §6 stop conditions.

### 4.2 Ordered sequence

| # | step | owner/engineer | gate | detail |
|---|---|---|---|---|
| 1 | **Production readiness check** | engineer | G1 | Stage A deploy confirmed live; secrets present on Production env: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `NOVA_POSHTA_API_KEY`, `SITE_URL`, plus `DIRECTUS_URL` + `DIRECTUS_READ_TOKEN` kept for rollback. Values never read into reports. |
| 2 | **Enable maintenance mode** | engineer | G3 | Set `CHECKOUT_MAINTENANCE=1` on Production env **and redeploy**. Confirm a submit is rejected server-side and writes nothing. |
| 3 | **Confirm no new orders reach Directus** | engineer | G3 | Submit a checkout attempt → expect the maintenance message, and confirm `carzo_orders` count is unchanged. |
| 4 | **Final Directus ↔ Supabase comparison** | engineer | G3 | T0 rescan inside the freeze: counts + SHA-256 of canonical exports (8B §1/§3). Nothing may change while it runs. |
| 5 | **Transfer current customers** | engineer | G4 | `stage8b:import --dry-run` → review → emit SQL → execute via admin channel. Registry → `public.customers`, insert-only, existing rows untouched. |
| 6 | **Transfer missing historical orders** | engineer | G4 | Same tool, orders + items. INSERT-only, one transaction per order, NULL fingerprints. |
| 7 | **Count + integrity verification** | engineer | G4 | `stage8b:import --verify` + the 8B §6 checklist: counts, unique keys, FK integrity, history hashes, PII scan. All green or STOP. |
| 8 | **Switch the six STORE flags** | engineer | G4→G5 | Set `CATALOG_STORE`, `CONTENT_STORE`, `PAGE_STORE`, `ORDER_STORE`, `CUSTOMER_STORE`, `NOTIFICATION_SETTINGS_STORE` = `supabase` on Production env. |
| 9 | **Deploy Production** | engineer | G4→G5 | `npx vercel --prod --yes`. Env changes only take effect on the new deploy. |
| 10 | **Read-only verification of the switched stack** | engineer | G5 | **No order write. No Telegram send.** See §4.3. All of it is `GET`/render only. |
| 11 | **Go / no-go on resuming intake** | owner + engineer | G5 | Explicit decision. If no-go → stay frozen and go to §6/§7. |
| 12 | **Disable maintenance mode** | engineer | G5 | Unset `CHECKOUT_MAINTENANCE`, **redeploy**. Order intake resumes **on Supabase**. |
| 13 | **Controlled verification order** | engineer | G5 | Exactly one test order through the now-open live path. See §4.4. |
| 14 | **Re-freeze on any failure** | engineer | G5 | If 13 fails at any point → `CHECKOUT_MAINTENANCE=1` **and redeploy** immediately. See §4.5. |
| 15 | **Monitor new orders** | engineer + owner | G5→G6 | 24–72h burn-in: zero Directus host requests in Vercel logs, checkout success rate, Telegram delivery. |

### 4.3 Step 10 — read-only checks while intake is still frozen

Maintenance mode blocks `createOrder` / `submitCarMatQuote` at the server-action
boundary, **before any validation, persistence or notification**. Therefore no
step before 13 may create an order. Step 10 is strictly read-only:

| check | how | must not |
|---|---|---|
| homepage / about / car-mat / reviews | page renders from Supabase content | — |
| catalog + pricing | prices match the T0 snapshot | — |
| product page + gallery | images load from R2 | — |
| CMS pages / sitemap / robots / llms.txt | serve correctly | — |
| customer loyalty lookup | read-only `findCustomerByPhone` | no upsert |
| notification settings load | settings render from Supabase | no send |
| Nova Poshta | city/point search responds | no shipment created |
| Vercel logs | zero Directus host requests for the above | — |
| maintenance gate itself | submit attempt returns the maintenance message and writes nothing | no order created |

If any read-only check fails: stop, stay frozen, and go to §6/§7. Do not lift
maintenance to "try an order anyway".

### 4.4 Step 13 — controlled verification order (only after intake is open)

Maintenance is lifted by the ordinary mechanism (step 12: unset the variable,
redeploy). There is **no bypass** of maintenance mode — no test hook, no admin
override, no special header, no direct RPC call to force an order through a
frozen deploy. This is deliberate: a hidden bypass would make the freeze
untrustworthy for the whole window.

Pre-agreed before the window (owner decision #10):

- **exactly one** live test order is authorized;
- **exactly one** live Telegram notification tied to that order is authorized;
- the order is a real checkout on the live path, so it lands in Supabase via
  `create_order_with_items` with a real `checkout_attempt_id` and
  `request_fingerprint` (that is the point of the check).

Sequence inside step 13:

1. Place the order.
2. Confirm the row exists in `public.orders` + `public.order_items` with both
   binding fields populated, and that `stage8b:import --verify` now reports
   `historical = N, live = 1, inconsistent = 0`.
3. Confirm the Telegram order notification delivered.
4. Confirm the Nova Poshta path responds (quote/point search — a shipment is
   not required and is not created by default).

### 4.5 Step 14 — what to do when step 13 fails

**Re-freeze immediately.** Set `CHECKOUT_MAINTENANCE=1` and **redeploy**. Order
intake stops.

Then:

- **Do not** flip the `*_STORE` flags back to `directus`. A naive revert after
  the cutover splits the ledger (the test order exists only in Supabase) — that
  is rollback case 9B, not a fix.
- **Do not** resume the old Directus order write path.
- Preferred: forward-fix on Supabase (rollback 9B "preferred").
- Only if forward-fix is impossible: full reconciliation of the Supabase-only
  order into Directus (exact snapshot), verified counts on both sides, and a
  fresh owner gate before any flag revert (rollback 9B "alternative").
- **Order loss is prevented by construction:** maintenance blocks before any
  persistence, so a rejected submit writes nothing and can be retried. There is
  no client-side queue to flush (8B §2 Option B is rejected). The frozen state
  loses no orders; it only defers them.

### 4.6 Vercel environment note

Changing a Vercel environment variable does **not** affect a running deploy.
Every flag change (step 8) and every maintenance toggle (steps 2, 12, 14)
requires a **new deploy** to take effect. Budget the redeploy time into the
window; do not assume the change is live because the dashboard saved it. A
maintenance toggle that has not been redeployed is not a freeze.

### 4.7 Invariant

**No Directus write may happen between step 4 (final comparison) and the moment
intake resumes on Supabase (after step 12).** That is the invariant the whole
sequence exists to protect.

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
| 1 | Approve Stage A release — merge the PR `release/stage9 → main` (procedure §3.3; `dev → main` is impossible) and then deploy Production | before Stage A |
| 2 | Approve this runbook and 8B plan v2.1 (G0) | before window |
| 3 | Approve customer merge precedence + STOP-on-name-conflict | before window |
| 4 | Confirm classification of order `CZ-20261013-BD3D52` | before window |
| 5 | Approve the migration filename sync (already executed as file-only rename; see readiness §6) | now |
| 6 | Confirm public canonical domain → `SITE_URL` value | before Stage A |
| 7 | Decide on publishing `privacy-policy` / `public-offer` drafts | before cutover |
| 8 | **Explicit acceptance of running Production on Supabase Free and its availability/backup risks** | **immediately before cutover** |
| 9 | Propose/confirm the combined window (date, ≤90 min, on-call) (G2) | before window |
| 10 | Permission for **exactly one** live test order and **exactly one** live Telegram notification tied to it (step 13). Until that permission is given, no real messages and no test order | before step 13 |
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
| `release/*` branch pushed | 0 (dry-run branch created locally and deleted) |
| PR opened against `main` | 0 |
| Vercel env changes | 0 |
| Supabase / Directus writes (real data) | 0 |
| Stage 8B apply (real) | 0 |
| Maintenance enabled anywhere | 0 |
| Telegram / Nova Poshta activity | 0 |
| Supabase plan changes | 0 |
| Directus shutdown | 0 |
| Stage 9 cutover started | 0 |
| Stage 10 started | 0 |
| force-push / history rewrite of `main` | 0 |
