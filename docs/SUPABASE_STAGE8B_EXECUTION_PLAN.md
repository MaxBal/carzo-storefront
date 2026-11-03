# SUPABASE STAGE 8B — EXECUTION PLAN (PLAN ONLY — NOT AUTHORIZED TO RUN)

**Status: `AWAITING OWNER APPROVAL`** — reversible, order-safe runbook with approval checkpoints.
Nothing in this document has been executed. No freeze has been scheduled or announced.
Stage 8 remains **NOT COMPLETE** until this plan is approved **and** applied in a
coordinated freeze window, and verified afterwards.

- Prepared: 2026-11-03 (UTC) on `dev` after `docs/SUPABASE_STAGE8A_DELTA_DISCOVERY.md`
- Input delta (as of 2026-11-03 provisional snapshot): 1 Directus order + 3 items;
  3 registry customers; 0 catalog/content drift; 1 approved divergence (`delivery-and-payment`)
- Hard rule: **no write, flag change, or freeze may happen without Gate G0–G5 below.**

---

## 0. Runbook phases and gates

| gate | meaning | who | unlocks |
|---|---|---|---|
| **G0** | Owner approves THIS document + merge precedence + order classification | owner | preparation tooling only |
| **G1** | Pre-freeze inventory captured & hashed; rollback artifacts staged | engineer | freeze announcement draft |
| **G2** | Owner confirms freeze window time & on-call | owner | freeze start |
| **G3** | Freeze ACTIVE — writes paused; final delta rescan = clean or explained | engineer + owner | delta apply |
| **G4** | Apply + post-checks green (counts, keys, integrity, prices, media, parity) | engineer | unfreeze / Stage 9 prep |
| **G5** | Owner accepts Stage 8B result | owner | Stage 9 scheduling (separate) |

Every gate is a hard stop. Failure at any gate → rollback path (§9), never
"fix counts" by live manual edits.

---

## 1. Pre-freeze source inventory (G1)

1. Re-run the read-only inventory (counts + content compare) at **T−24h** and at
   **T−5min** (freeze start). Two snapshots make the true delta window explicit.
2. For each snapshot record: exact `count(*)` for all 28 Supabase tables and the
   24 Directus collections + registry length; SHA-256 of a canonical export:
   - Directus: JSON export of `carzo_orders`, `carzo_order_items`, registry
     (`carzo_site_settings.customers`), `carzo_pages`, `carzo_page_blocks`,
     catalog and content collections (field-complete).
   - Supabase: SQL/CSV export of the same domains (SELECT-only).
   - Canonicalization: stable key sort, UTF-8, LF, no pretty-print drift.
3. **Secure storage outside git** (owner-provided encrypted location, e.g.
   owner's password-manager vault or encrypted volume). Explicitly forbidden:
   git, chat uploads, public gists, screenshots, CI artifacts.
4. Export tooling must mask/omit nothing in the *vault copy* (lossless), but any
   copy shown in reports remains aggregate-only.
5. Record export permissions (who can read) and retention/expiry (recommend:
   destroy after Stage 9 + 7 days unless an incident keeps it open).

**Rollback artifact (written before freeze):** one-way "restore snapshot" SQL for
rows this runbook will touch (the 3 customers, 1 order + 3 items), generated from
the pre-image of those keys — for emergency revert of *only* Stage 8B writes.

---

## 2. Freeze window (G2→G3) — coordinated with Stage 9, kept SHORT

Stage 8 in the master plan is a **short** freeze tied to the Stage 9 cutover.
Prolonged freeze while Production depends on Directus can interrupt real orders.

Scope of paused writes (announcement lists all five):

1. Storefront orders (checkout) — Directus order intake
2. Customer enrollment / loyalty registry edits
3. Car-mat quote notifications intake
4. Manual CMS edits in Directus (all content collections)
5. Any admin/ops Directus writes (status changes, publishes)

**User-facing checkout behavior during freeze (recommended, owner picks one):**

- Option A (preferred): maintenance banner on checkout + disabled submit, homepage
  and catalog stay up; message: «Оформлення тимчасово недоступне — повертаємось
  за кілька хвилин». Zero order-loss risk.
- Option B: keep checkout open and queue orders client-side — **rejected** in this
  plan (loss/corruption risk on flush).

Telegram/Nova Poshta remain untouched (no shipments are created by this plan).

**Expected freeze duration:** ≤ 60 minutes (final rescan 10 min, apply 10 min,
post-checks 20 min, buffer 20 min). If exceeded → G3 abort criteria (§9).

**No freeze is started by Stage 8A/8B preparation.** Freeze starts only after G2.

---

## 3. Delta detection & source-of-truth precedence (G3)

Final rescan inside the freeze (nothing may change while it runs):

1. **Orders**: full compare by stable keys (`order_number`, item `item_key`) —
   `carzo_orders` has **no `updated_at`**, timestamps are not a valid delta filter.
   Expect: the already-inventoried set + any orders created during the provisional
   window (label each new one, aggregate only). Any order that *changed* fields
   since the G1 export → category `changed-during-window`, owner must confirm
   before apply.
2. **Customers**: registry (6 at 8A time) vs `public.customers` by canonical phone.
3. **Pages**: source rows absent from target are **not** a delta to fix —
   `delivery-and-payment` is an approved exclusion (never upsert it).
4. **Catalog/content**: compare only; any drift found in freeze = G3 abort.

Precedence (source-of-truth before Stage 9 cutover):

| domain | source of truth | target rule |
|---|---|---|
| orders / order_items | Directus (`ORDER_STORE=directus` on Production) | insert-only for missing rows; never update existing history |
| customers / loyalty | Directus JSON registry (`CUSTOMER_STORE=directus`) | field-level merge (§5); insert-only identity |
| catalog, content, pages | Directus published state (read domains already on Supabase via Preview; Production still Directus) | upsert allowed only for drift found by compare; approved exclusions skipped |
| media URLs | Cloudflare R2 | R2 URL validation only; no re-upload; no placeholder restore |
| Telegram secrets | Vercel env | never copy into Supabase |

Deletes: nothing is deleted by Stage 8B. Old drafts stay unpublished.
Approved exclusions: `delivery-and-payment` (Supabase), `landscape-placeholder.svg`
(removed field/asset), `carzo_logo_placements` (never migrated), `directus_user_ids`
(dropped), `bot_token` (env-only).

---

## 4. Dependency-ordered apply plan (G4)

Order of operations (all inside one decision window; each step idempotent):

1. `customers` (3 inserts) — before orders, so `customer_id` links exist.
2. `orders` (1 insert) — insert-only via the Stage 6 RPC
   `create_order_with_items` **or** a reviewed insert that sets
   `request_fingerprint` per current constraints; **never** raw upsert of history.
3. `order_items` (3 inserts) — via the same RPC payload (children after parent).
4. Nothing else expected. If content/catalog drift was found and owner-approved,
   apply it **before** orders (parents before children: brands/designs/sizes →
   variants/fixations; pages → page_blocks).

Conflict keys: `customers.phone` (unique), `orders.order_number` (unique),
`order_items.order_id + item_key`. On-conflict strategy: **DO NOTHING + report**
for orders/items (never overwrite); customers per §5 merge.

Transactions/rollback scope: wrap the 3-customer batch in one transaction; the
order RPC is already atomic (order + items). Rollback = delete the exact inserted
rows by `id` from the §1 restore artifact (ids recorded at apply time), plus
restore any pre-existing rows if an update ever happened (it must not).

**Single-writer policy (orders):** after Supabase receives its first live order
(Stage 9), a naive `ORDER_STORE=directus` flip is **forbidden** — reverting would
split the ledger (orders written to Supabase disappear from a Directus-backed
storefront). Recovery then = forward-fix on Supabase or a scripted reconciliation
exporting Supabase-only orders back into Directus before any flag revert. This
policy is recorded here so the rollback decision is made before Stage 9, not mid-incident.

---

## 5. Customer merge & loyalty reconciliation (G4)

Identity: canonical phone `+380XXXXXXXXX` (`lib/cart/customer-phone.ts`).

| field | rule | collision behavior |
|---|---|---|
| `phone` | identity; insert-only | phone exists → merge path below |
| `full_name` | keep target non-null; fill only if target empty | name conflict (both non-null, different) → **STOP, report category, owner decides** |
| `source` | keep target; new rows take registry value | mismatch on overlap → report only (8A: 0) |
| `imported` | keep target; new rows take registry value | same |
| `legacy_*` | keep target untouched | same |
| `created_at` | preserve target; new rows = ingest time (registry lacks timestamps) | — |
| `updated_at` | touch at ingest only | — |

Do **not** overwrite provenance from a smaller/staler source. The 3 known overlaps
are field-identical (8A) — expect 0 conflicts; any new conflict aborts the customer
step.

Loyalty: no loyalty state is migrated (registry rows carry only identity/provenance;
order loyalty lives in `loyalty_*` on orders — historical 3 already transformed and
parity-clean). Phone canonicalization applied to all 3 new rows before insert.

Test exclusions: `--test-phone` denylist (default: public business contact) must be
re-applied at ingest; such phones are skipped and counted.

---

## 6. Pre/post checks (G4 checklist)

Run before unfreeze. All must be green or G4 fails.

| check | expected |
|---|---|
| counts | orders 11 (or +live-delta count), order_items 20 (or +), customers 6,000 (5,994+3, or +live), pages **3** (never 4) |
| unique keys | `order_number` dups 0; `phone` dups 0; `item_key` per order dups 0 |
| referential integrity | order_items→orders 0 orphans; customer_id links valid |
| price integrity | historical orders unchanged byte-for-byte (pre/post hash of the 10) |
| new order | totals/quantity internally consistent; loyalty fields NULL per source |
| product_media | 17/17 canonical slots; 0 Directus UUID refs |
| R2 | changed/required URLs HEAD 200; no `landscape-placeholder` |
| customer parity | registry ⊆ customers after merge; field rules respected |
| PII | reports/logs contain no raw PII (automated scanner on tool output) |
| notification | recipients unchanged; no token in DB |
| drafts | `privacy-policy`, `public-offer` still unpublished |
| approved exclusion | `delivery-and-payment` still absent in Supabase |

Distinguish modes explicitly in tooling: `--dry-run` (default), `--apply`
(requires typed confirmation phrase), `--verify`, `--audit` (read-only report).
An immediate human confirmation gate sits before: any write, any flag change,
any maintenance-mode toggle.

---

## 7. Failure & rollback (G9 criteria)

Abort immediately if: freeze-violation write detected (source changed mid-run),
unexplained order/customer conflict, any count/price invariant fails, RPC rejects
historical insert, or freeze budget (60 min) exceeded.

Rollback procedure:

1. Stop; do not unfreeze until source/target consistency re-verified.
2. Delete Stage 8B-inserted rows by recorded ids (customers, order, items) — or
   restore pre-images from the §1 artifact if any field was updated (should not happen).
3. Re-run pre/post checks against the G1 baseline.
4. Unfreeze Directus writes; keep `*_STORE` flags exactly as before (no flips).
5. File a delta report (`BLOCKED` if root cause unknown) and re-plan.

Forbidden "fixes": live manual edits to make counts match; re-running
`migrate-directus-to-supabase.ts --apply` (would resurrect `delivery-and-payment`
and raw-upsert order history); deleting customers rows to "clean up"; any
Supabase migration apply during rollback.

Resumption conditions: root cause documented + owner re-approves G3.

---

## 8. What the owner must approve before ANY writing/freezing

1. This runbook (G0) including checkout freeze UX choice (Option A recommended).
2. Customer merge precedence table (§5) and the STOP-on-name-conflict rule.
3. Classification of order `CZ-20261013-BD3D52` (8A assumption: real customer order).
4. Freeze window time + on-call contact + the ≤60 min budget (G2).
5. Secure export location & retention for pre-freeze snapshots (§1).
6. Supabase Free-plan / production-availability decision (Stage 7 backlog #10).
7. P2-5 migration filename reconciliation method (rename local files vs re-register;
   documented in 8A §5.1 — still unrepaired by design).

---

## 9. Stage 9 timing & operations (proposal only — Stage 9 NOT started)

- Sequence: Stage 8B apply + verify (G4) → short burn-in with Directus frozen →
  Stage 9 cutover in the same operational window if possible (master plan keeps
  Stage 8's freeze tied to Stage 9) — owner sets the date.
- Monitoring during/after: Vercel function logs (zero Directus host requests after
  Stage 9), checkout success rate, Telegram notification delivery, error budget 24–72h.
- Contacts: owner (decision), engineer on-call (execution), manager duty (checkout
  UX during freeze — answers customer messages).
- Prerequisites before Stage 9 (from Stage 7 backlog): SEO canonical/`SITE_URL`
  (`lib/seo.ts`, `app/layout.tsx`), footer hrefs, og:image, notification outbox,
  migration filename reconciliation, Free-plan decision.

---

## 10. Explicit non-actions of this document

- No freeze scheduled or announced.
- No writes to Directus, Supabase, R2, Vercel, Telegram, Nova Poshta.
- No `*_STORE` flag changes; no merges to `main`; Deployment Protection untouched.
- Stage 9 not started.
