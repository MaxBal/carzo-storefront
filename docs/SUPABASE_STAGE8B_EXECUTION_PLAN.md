# SUPABASE STAGE 8B — EXECUTION PLAN (PLAN ONLY — NOT AUTHORIZED TO RUN)

**Status: `READY FOR OWNER APPROVAL`** — reversible, order-safe runbook with approval gates.
Nothing in this document has been executed. No freeze has been scheduled or announced.
Stage 8 remains **NOT COMPLETE** until this plan is approved **and** applied in the
same operational window as the Stage 9 Production cutover.

- Prepared: 2026-11-03 (UTC); **revised 2026-11-03** after owner review of Stage 8A
  (v2: corrected control counts, historical-order import method, Stage 8B→9 sequence,
  stop conditions, rollback scope); **v2.1** after owner review of Stage 8B v2
  (equality-first collision handling, rollback split 9A/9B, `CHECKOUT_MAINTENANCE`
  freeze mechanism)
- Input delta (8A provisional snapshot, 2026-11-03): 1 Directus order + 3 items;
  3 registry customers; 0 catalog/content drift; 1 approved divergence (`delivery-and-payment`)
- Hard rule: **no write, flag change, or freeze may happen without gates G0–G6 below.**
- Hard rule: **Stage 8B delta transfer runs immediately before the Stage 9 Production
  cutover — never as a standalone earlier step.**

---

## 0. Runbook gates

| gate | meaning | who | unlocks |
|---|---|---|---|
| **G0** | Owner approves THIS document (v2) + merge precedence + order classification | owner | preparation tooling only |
| **G1** | Pre-freeze inventory captured & hashed; rollback artifacts staged | engineer | Stage 9 readiness review |
| **G2** | **Stage 9 declared ready to execute** (env plan, smoke checklist, on-call, rollback policy signed) **and** owner confirms the single combined window | owner | freeze announcement |
| **G3** | Freeze ACTIVE — all Directus-dependent writes paused; final delta rescan = clean or explained | engineer + owner | delta apply |
| **G4** | Delta apply + integrity checks green | engineer | Production switch (Stage 9) |
| **G5** | Stage 9 cutover done; orders & notifications verified; order intake resumed | engineer + owner | burn-in monitoring |
| **G6** | Owner accepts combined Stage 8B+9 result | owner | Stage 10+ planning |

**Freeze must not start until G2 is satisfied** — i.e. Stage 9 is ready to execute
in the same window. A freeze without an immediate cutover would strand Production
on Directus while Supabase already holds the delta — exactly the forbidden state (§7.1).

---

## 1. Pre-freeze source inventory (G1)

1. Run the read-only inventory (counts + content compare) at **T−24h** and again
   at **freeze start (T0)**. The T0 snapshot is the authoritative delta base.
2. For each snapshot record: exact `count(*)` for all 28 Supabase tables and the
   24 Directus collections + registry length; SHA-256 of a canonical export:
   - Directus: JSON export of `carzo_orders`, `carzo_order_items`, registry
     (`carzo_site_settings.customers`), `carzo_pages`, `carzo_page_blocks`,
     catalog and content collections (field-complete).
   - Supabase: SQL/CSV export of the same domains (SELECT-only).
   - Canonicalization: stable key sort, UTF-8, LF, no pretty-print drift.
3. **Secure storage outside git** (owner-provided encrypted location). Forbidden:
   git, chat uploads, public gists, screenshots, CI artifacts.
4. Export tooling: lossless in the vault copy; any copy shown in reports remains
   aggregate-only (no names, phones, emails, chat IDs, tokens, row dumps).
5. Record export permissions and retention (recommend: destroy after Stage 9 + 7 days
   unless an incident keeps it open).

**Rollback artifact (written before freeze):** pre-image of exactly the rows the
apply will touch (each delta order + items, each delta customer), keyed by their
final ids — for emergency revert of **only** the Stage 8B writes (§9).

---

## 2. Freeze window (G2→G3) — one combined window with Stage 9

Stage 8 in the master plan is a **short** freeze coordinated with the Stage 9
cutover. Prolonged freeze while Production depends on Directus can interrupt real
orders. This runbook therefore treats Stage 8B transfer and Stage 9 switch as
**one continuous window** (§7).

Writes paused from freeze start until order intake is restored after cutover:

1. Storefront orders (checkout) — Directus order intake
2. Customer enrollment / loyalty registry edits (`carzo_site_settings.customers`)
3. Car-mat quote notifications intake
4. Manual CMS edits in Directus (all content collections)
5. Any admin/ops Directus writes (status changes, publishes)

**User-facing checkout behavior during freeze (owner picks one):**

- Option A (preferred; **implemented in `dev` as `CHECKOUT_MAINTENANCE=1`**):
  server-side block at the `createOrder` / `submitCarMatQuote` actions (before
  any validation, write or notification), maintenance banner message on submit,
  homepage and catalog stay up. Zero order-loss risk: nothing is written, so
  nothing can be lost or duplicated. Re-enable = unset the variable.
  Message: «Оформлення замовлень тимчасово недоступне — ми оновлюємо систему…».
- Option B: keep checkout open and queue orders client-side — **rejected**
  (loss/corruption risk on flush).

Telegram/Nova Poshta: no shipments or notifications are created by the import
itself (§4); the notification *pipeline* stays configured, and post-cutover
notification behavior is verified at G5.

**Budget:** ≤ 90 minutes total window (readiness confirm 10, freeze+rescan 15,
transfer 15, integrity 15, cutover 15, verify 15, buffer 5). Overrun → stop
conditions (§8).

---

## 3. Delta detection & source-of-truth precedence (G3)

Final rescan inside the freeze (nothing may change while it runs):

1. **Orders**: full compare by stable keys (`order_number`, item `item_key`) —
   `carzo_orders` has **no `updated_at`**; timestamps are not a valid delta filter.
   Result = the T0 inventory + anything that appeared before freeze start.
   Any order that *changed* fields since the T0 export → category
   `changed-during-window`; owner must confirm before apply.
2. **Customers**: registry vs `public.customers` by canonical phone
   (`+380XXXXXXXXX`, `lib/cart/customer-phone.ts`).
3. **Pages**: source rows absent from target are **not** a delta —
   `delivery-and-payment` is an approved exclusion (never upsert it).
4. **Catalog/content**: compare only; any drift found in freeze = abort (§8).

Precedence (source of truth = Directus until G5 cutover completes):

| domain | source of truth | target rule |
|---|---|---|
| orders / order_items | Directus (`ORDER_STORE=directus` on Production) | **insert-only**, history preserved as-is |
| customers / loyalty | Directus JSON registry (`CUSTOMER_STORE=directus`) | field-level merge (§5); insert-only identity |
| catalog, content, pages | Directus published state | upsert only for owner-approved drift; approved exclusions skipped |
| media URLs | Cloudflare R2 | URL validation only; no re-upload; no placeholder restore |
| Telegram secrets | Vercel env | never copy into Supabase |

Deletes: nothing is deleted by Stage 8B. Old drafts stay unpublished.
Approved exclusions: `delivery-and-payment` (Supabase), `landscape-placeholder.svg`
(removed field/asset), `carzo_logo_placements`, `directus_user_ids`, `bot_token`.

---

## 4. Historical order import algorithm (G4) — insert-only, NOT the RPC

### 4.1 Why NOT `create_order_with_items`

The Stage 6 RPC is for **new checkout attempts only**. Verified in
`supabase/migrations/20261101120000_create_order_with_items_rpc.sql`:

- it **generates** `order_number` (`'CZ-' || to_char(now()…) || random suffix`) —
  the caller cannot supply the historical number;
- `created_at` falls to `now()` — the historical date would be lost;
- it enforces `request_fingerprint` / `checkout_attempt_id` semantics of a live
  checkout attempt, which historical rows must not carry.

Historical rows must keep their original identity and money values byte-for-byte.

### 4.2 What is preserved per historical order (lossless)

| field group | rule |
|---|---|
| `id` | keep the Directus id — all 11 source order ids and 20 item ids are uuid-compatible (verified 2026-11-03). If an id were incompatible: generate a uuid and record the mapping in the apply log |
| `order_number` | keep exactly (unique natural key). **Never generate new numbers for history** |
| `created_at` | keep exactly (source `created_at`) |
| `status`, `customer_name`, `customer_phone`, `customer_email`, `customer_comment`, `contact_method` | keep as snapshot |
| delivery snapshot (`delivery_*`) | keep as snapshot |
| `items_quantity`, `subtotal`, `quantity_discount`, `total`, `discount_tier_key` | keep — **never recalculate prices or apply current catalog rates** |
| `loyalty_*` | keep (from nested `manager_note` JSON via the accepted transform; genuine freeform `manager_note` kept as text; never store loyalty JSON in `manager_note`) |
| `checkout_attempt_id`, `request_fingerprint` | **explicit NULL** for legacy imports (schema allows NULL; the non-empty-fingerprint rule is RPC-level only) |
| items (`order_items`) | full snapshot per row: `id`, `sort`, `item_key`, `title`, design/size/brand/fixation labels+slugs, `unit_price`, `quantity`, `line_total`, `quantity_discount_eligible` |

### 4.3 Method

1. **Plain transactional INSERT — insert-only.** No `upsert` on business fields,
   no RPC, no `ON CONFLICT DO UPDATE`.
2. **Idempotent safe replay — equality-first collision handling** (re-running must
   never duplicate and never silently diverge):
   - identity collision = source `order_number` already in target, **or** source
     `id` already in target, **or** item `(order_id, item_key)` already present;
   - on collision the importer must compare the **full historical payload**
     (id, order_number, created_at, status, customer fields, delivery snapshot,
     prices/discounts/totals, loyalty_*, `checkout_attempt_id`,
     `request_fingerprint`, and for items: all snapshot fields including
     unit_price/quantity/line_total);
     - equal → `skipped-already-present` (logged);
     - **different → STOP the window (abort criteria §8). Never a silent skip,
       never an overwrite.** A same-key-different-data row is a consistency
       incident, not a merge candidate.
   - `order_items` uniqueness inside one order is mandatory: duplicate
     `item_key` within the same source order → STOP before any insert;
   - apply log records: attempted / inserted / skipped-identical / stopped rows.
3. **Atomicity:** one transaction per order (order row + its items) with the
   customer inserts in their own earlier transaction; a failure rolls back the
   incomplete unit only. Repeatability: re-running the same import after a
   successful apply must produce `inserted=0, skipped-identical=N, stopped=0`.
4. **No side effects on import:** no Telegram messages, no Nova Poshta calls, no
   cache purges, no `updated_at` rewriting of untouched rows. Notification sending
   is a property of live checkout (G5 verification), not of this import.
5. **Customer link:** `customer_id` resolved by canonical phone; if absent → NULL
   (historical rows in Supabase are already all unlinked — do not invent links).

### 4.4 Customers insert (before orders)

- 3 expected rows (8A snapshot): `INSERT` with `ON CONFLICT (phone) DO NOTHING`
  plus merge rules of §5 for the rare case a conflict appeared since 8A.
- `created_at` = ingest time (registry has no timestamps); flag in apply log.

---

## 5. Customer merge & loyalty reconciliation (G4)

Identity: canonical phone `+380XXXXXXXXX`.

| field | rule | collision behavior |
|---|---|---|
| `phone` | identity; insert-only | phone exists → merge path below |
| `full_name` | keep target non-null; fill only if target empty | name conflict (both non-null, different) → **STOP, report category, owner decides** |
| `source` | keep target; new rows take registry value | mismatch on overlap → report only (8A: 0) |
| `imported` | keep target; new rows take registry value | same |
| `legacy_*` | keep target untouched | same |
| `created_at` | preserve target; new rows = ingest time | — |
| `updated_at` | touch at ingest only | — |

Do **not** overwrite provenance from a smaller/staler source. Test exclusions
(`--test-phone` denylist) are re-applied at ingest; such phones are skipped and
counted. No loyalty state migrates here (order-level `loyalty_*` is part of the
order snapshot).

---

## 6. Pre/post checks (G4 checklist)

**Reference counts** (8A snapshot 2026-11-03 + unchanged delta):

| table | before | delta | expected after |
|---|---:|---:|---:|
| `customers` | 5,994 | +3 | **5,997** |
| `orders` | 10 | +1 | **11** |
| `order_items` | 17 | +3 | **20** |
| `pages` | 3 | 0 | **3** (never 4) |

**Final control counts are NOT taken from this table.** Immediately before the
transfer, the T0 rescan (§3) defines the actual base and the actual delta; the
expected-after numbers are `T0 count + applied delta` computed in the apply log.
The table above is the 2026-11-03 expectation against which any drift must be
explained. (`customers = 6,000` from the previous revision was an arithmetic
error and is withdrawn.)

Checks — all must pass before the Production switch (G4→G5):

| check | expected |
|---|---|
| counts | per apply log (see above); pages **3** |
| unique keys | `order_number` dups 0; `phone` dups 0; `(order_id,item_key)` dups 0 |
| referential integrity | order_items→orders 0 orphans; `customer_id` links valid or NULL |
| history integrity | the 10 pre-existing orders byte-identical pre/post (hash compare); **no recalculation** |
| new historical rows | fields equal source snapshot (id, order_number, created_at, money, loyalty, delivery); `checkout_attempt_id`/`request_fingerprint` NULL |
| product_media | 17/17 canonical slots; 0 Directus UUID refs |
| R2 | required URLs HEAD 200; no `landscape-placeholder` |
| customer parity | registry ⊆ customers after merge; §5 rules respected |
| PII | reports/logs contain no raw PII |
| notification config | recipients unchanged; no token in DB |
| drafts | `privacy-policy`, `public-offer` still unpublished |
| approved exclusion | `delivery-and-payment` still absent in Supabase |
| idempotency drill | dry-run reports `inserted`/`skipped` plan; re-run of dry-run is stable |

Modes in tooling: `--dry-run` (default), `--apply` (typed confirmation phrase),
`--verify`, `--audit` (read-only). A human confirmation gate sits immediately
before: any write, any flag change, any maintenance-mode toggle.

---

## 7. Coordinated Stage 8B → Stage 9 sequence (single window)

**Forbidden intermediate state** (the reason this sequence exists):

1. delta already transferred into Supabase, **and**
2. Production keeps writing new orders/customers into Directus, **and**
3. Stage 9 runs later without a fresh re-sync.

That state loses the gap between transfer and cutover. Prevention: Stage 8B
transfer happens **only** inside the same window in which Stage 9 completes.

Ordered steps:

| # | step | gate |
|---|---|---|
| 1 | **Preparation**: tooling ready (dry-run green), rollback artifact staged, exports hashed, owner approvals collected | G0–G1 |
| 2 | **Stage 9 readiness review**: env-change plan for Production flags, deploy plan, smoke checklist (PDP, homepage, checkout, notification), monitoring, on-call, rollback policy (§9) — declared READY | **G2** |
| 3 | **Coordinated stop of new writes**: announce + enable checkout freeze (Option A) + stop Directus edits (list in §2). Record freeze timestamp | G3 start |
| 4 | **Delta re-detection**: T0 rescan inside freeze; expected = 8A delta (+ anything pre-freeze); anomalies → §8 | G3 |
| 5 | **Transfer**: customers (§4.4) → historical orders+items (§4) — insert-only, transactional | G4 |
| 6 | **Integrity checks**: full §6 checklist | G4 |
| 7 | **Production switch (Stage 9)**: set `CATALOG_STORE`/`CONTENT_STORE`/`PAGE_STORE`/`ORDER_STORE`/`NOTIFICATION_SETTINGS_STORE`/`CUSTOMER_STORE=supabase` on Production, deploy, runtime Directus dependency = zero | G4→G5 |
| 8 | **Verify orders & notifications**: checkout happy path on Production creates an order in Supabase (via RPC — live path, not the historical import), Telegram notification delivers, no Directus host requests in logs | G5 |
| 9 | **Restore order intake**: remove checkout freeze; monitor 24–72h | G5 |
| 10 | **Owner acceptance** of the combined run | G6 |

If step 7–9 fail, the rollback policy (§9) applies. Directus stays frozen/read-only
through burn-in per the master plan; it is not destroyed (Stage 10/11 handle
retirement).

---

## 8. Exact stop conditions (abort the window)

Abort immediately — do not continue to the next step — if **any** of:

1. Freeze violation: a write lands in Directus after freeze timestamp
   (order, registry, CMS) that is not in the T0 rescan.
2. Delta rescan shows `changed-during-window` rows without owner confirmation.
3. Customer name conflict per §5 (STOP-on-name-conflict).
4. Any count/unique/FK invariant fails at §6.
5. Historical row cannot be inserted without altering its identity or money
   values (id/order_number/created_at/price/totals).
6. Pre-existing order hash differs pre/post (history mutation attempt).
7. Window budget (90 min) exceeded.
8. Stage 9 switch pre-requisites fail deploy/smoke and cannot be fixed inside budget.

On abort: follow §9 rollback; keep flags unchanged; unfreeze only after
source/target consistency is re-verified against the T0 baseline.

---

## 9. Rollback plan — two distinct cases

The dividing line is **the first real Supabase order** (a production checkout
written by the live RPC path after the Stage 9 switch — not a Stage 8B
historical import row).

### 9A. Before the first real Supabase order

Controlled return to Directus is allowed, only after a consistency check:

1. Record in the apply log every inserted id (customers, orders, items) and every
   skipped row. Nothing outside that log is touched.
2. Delete/restore **only what this run created**: `DELETE FROM orders WHERE id IN
   (…inserted ids…)` — `order_items` cascade with their order; an inserted
   customer is deleted only if no row references it, otherwise kept + reported.
3. Restore pre-images if any field of a pre-existing row was modified (must not
   happen; if it does → §8 abort + owner escalation).
4. **Consistency check before unfreeze:** re-run the §6 checklist against the T0
   baseline and re-compare Directus ↔ Supabase counts for orders/customers;
   only then restore `*_STORE` flags to their pre-window values and unfreeze.
5. File the delta report (`BLOCKED` if root cause unknown) and re-plan.

### 9B. After the first real Supabase order

- **Forbidden:** any naive `*_STORE` → `directus` flag flip.
- **Forbidden:** automatically unfreezing Directus and resuming the old order
  write path — that splits the ledger (Supabase-only orders vanish from a
  Directus-backed storefront).
- **Preferred:** forward-fix on Supabase (fix the defect in place, keep
  Supabase as the single writer).
- **Alternative rollback** (only if forward-fix is impossible): a **full
  reconciliation** first — export every Supabase-only order + items into Directus
  as exact snapshots (ids/numbers/dates/money preserved), verify counts and keys
  on both sides, and only then — with owner approval at a fresh G2 — flip flags
  back. Anything less than full reconciliation is not a rollback; it is data loss.

Resumption after abort: root cause documented + owner re-approves G2/G3.

Forbidden "fixes" in both cases: live manual edits to make counts match;
re-running `migrate-directus-to-supabase.ts --apply` (resurrects
`delivery-and-payment`, raw-upserts history); deleting customers to "clean up";
any migration apply during rollback.

---

## 10. Decisions required from the owner

1. Approve this runbook v2 (G0), including checkout freeze UX (Option A recommended).
2. Customer merge precedence (§5) and the STOP-on-name-conflict rule.
3. Classification of order `CZ-20261013-BD3D52` (8A assumption: real customer order).
4. **Single combined window** for Stage 8B + Stage 9 (G2): date/time, ≤90 min budget,
   on-call contact — and confirmation that Stage 9 will be ready to execute in it.
5. Secure export location & retention (§1).
6. Supabase Free-plan / production-availability decision (Stage 7 backlog #10).
7. P2-5 migration filename reconciliation method (rename local files vs re-register;
   documented in 8A §5.1 — still unrepaired by design).

---

## 11. Stage 9 notes (execution happens in the §7 window)

- Production env at step 7: all six flags → `supabase` (master plan Stage 9);
  `TELEGRAM_BOT_TOKEN` stays in Vercel env only.
- Do not immediately revoke Directus tokens (Stage 10 forensic/rollback access);
  runtime must not use them after G5.
- Monitoring: Vercel logs (zero Directus host requests), checkout success rate,
  Telegram delivery, 24–72h burn-in.
- Pre Stage 9 backlog (from Stage 7): SEO canonical/`SITE_URL`, footer hrefs,
  og:image, notification outbox, migration filename reconciliation, Free-plan decision.

---

## 12. Explicit non-actions of this document

- No data transferred; no Supabase or Directus changes; no R2 writes.
- No checkout stop, no freeze scheduled/announced, no Vercel env changes.
- No Production switch; Stage 9 not started.
- `main` untouched; doc commits on `dev` only.
