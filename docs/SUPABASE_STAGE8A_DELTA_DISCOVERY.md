# SUPABASE STAGE 8A — READ-ONLY DELTA DISCOVERY (Directus → Supabase)

**Status: `READY FOR OWNER REVIEW`** — read-only discovery complete; no unexplained critical mismatches.
This document is a **discovery report only**. Stage 8 delta apply was **NOT** executed.
`Stage 8` as a whole remains **NOT COMPLETE** (transfer happens only in approved Stage 8B).

- Date: 2026-11-03 (UTC)
- Branch: `dev` (never `main`)
- HEAD before this report: `8ab752921cf0a512a12c8cb47bba8d64790892b9`
- Supabase project: `Carzo` / `kmhegysmtsjqtwwaacht`
- Baseline snapshot for delta: Stage 2 (2026-10-07T12:46:45Z–12:46:55Z), `docs/SUPABASE_STAGE2_RESULT.md`
- Safety: **0 mutations** on Directus, Supabase, R2, Vercel, Telegram, Nova Poshta (see §7)

---

## 1. Stage 7 gate — closed before 8A

The Stage 7 documentary gate is recorded in commit `8ab7529` (2026-11-04 local
/ 2026-11-03 22:47 UTC, owner-authored):

- `docs/SUPABASE_STAGE7_QA_REPORT.md` — `FINAL OWNER SIGN-OFF — STAGE 7`, `STAGE 7 = PASS`
- `docs/SUPABASE_STAGE7_1_VISUAL_QA_RESULT.md` — §14, same status

Stage 8A re-verified that record against the four mandatory §0 acceptance
conditions (visual owner acceptance, network-evidence owner acceptance,
owner-performed positive draft preview, D-1/D-2 closed). All four hold as
written: limitations (no exact-viewport automation, no DevTools Network panel,
no secret exposure) are preserved, not erased. No new P0/P1 failures were
found during Stage 8A read-only checks (parity script run 2026-11-03, see §3).

Therefore: **Stage 7 gate = closed** (`8ab7529`), Stage 8A proceeded.

---

## 2. Source-of-truth inventory (code + deployment, read-only)

### 2.1 Store flags

Resolution code: `product-page/lib/data/config.ts`, `product-page/lib/cart/customer-store/config.ts`,
`product-page/lib/data/notifications/index.ts`. Invalid values fail fast; empty → `directus`.

| Flag | Production (`main`) | Preview (`dev`) | Evidence |
|---|---|---|---|
| `CATALOG_STORE` | `directus` (default) | `supabase` | Stage 6 env read (`docs/SUPABASE_STAGE6_RESULT.md` §env table) |
| `CONTENT_STORE` | `directus` (default) | `supabase` | same + Stage 7 fetch-spy (0 Directus reads on switched domains) |
| `PAGE_STORE` | `directus` (default) | `supabase` | same + live check: Production still serves `/delivery-and-payment` (Directus mirror; Supabase target would 404) |
| `ORDER_STORE` | `directus` (default) | `supabase` | Stage 6 env read; Production order source remains Directus until Stage 9 |
| `NOTIFICATION_SETTINGS_STORE` | `directus` (default; falls back to `ORDER_STORE`) | `supabase` | Stage 6 env read |
| `CUSTOMER_STORE` | `directus` (default) | `directus` | Stage 6 env read — the known intentional exception |

Notes:

- Live Vercel env was **not** re-read in Stage 8A (no env access exercised; values
  confirmed from the Stage 6 runtime verification record + Stage 7 runtime tests).
- `TELEGRAM_BOT_TOKEN` stays in Vercel env only (Secret, in-runtime). It is absent
  from Supabase and from Directus-derived target rows — re-verified (§3).
- Deployment protection on Preview remains enabled; it was not touched.

### 2.2 Directus collections (GET-only, 2026-11-03)

The 24 Stage 2 collections all exist; counts are unchanged since the Stage 2
snapshot **except orders** (see §4.2):

| collection | Stage 2 | 2026-11-03 | delta |
|---|---:|---:|---:|
| carzo_designs | 3 | 3 | 0 |
| carzo_sizes | 4 | 4 | 0 |
| carzo_brands | 26 | 26 | 0 |
| carzo_brand_pricing | 26 | 26 | 0 |
| carzo_variants | 12 | 12 | 0 |
| carzo_fixations | 4 | 4 | 0 |
| carzo_size_shipping | 0 | 0 | 0 |
| carzo_discount_tiers | 2 | 2 | 0 |
| carzo_gallery_images | 57 | 57 | 0 |
| carzo_content_sets | 16 | 16 | 0 |
| carzo_content_sections | 48 | 48 | 0 |
| carzo_faq_items | 8 | 8 | 0 |
| carzo_rich_sections | 4 | 4 | 0 |
| carzo_rich_section_images | 12 | 12 | 0 |
| carzo_benefit_modals | 6 | 6 | 0 |
| carzo_logo_settings | 1 | 1 | 0 |
| carzo_media_settings | 1 | 1 | 0 |
| carzo_site_settings | 1 | 1 | 0 |
| carzo_pages | 4 | 4 | 0 |
| carzo_page_blocks | 5 | 5 | 0 |
| **carzo_orders** | **10** | **11** | **+1** |
| **carzo_order_items** | **17** | **20** | **+3** |
| carzo_notification_settings | 1 | 1 | 0 |
| carzo_telegram_bot_settings | 1 | 1 | 0 |

`carzo_logo_placements`: 0 rows, not migrated (unchanged).

### 2.3 Customer sources — three distinct things (never conflated)

1. **Directus collection `customers`** — **does not exist**. Verified two ways:
   admin `GET /collections` lists no `customers`; read-token `GET /items/customers`
   returns 403 ("no permission … or it does not exist"). Runtime code
   (`lib/cart/customer-store/directus.ts`) therefore **falls back** to (2) on every read/write.
2. **Embedded JSON registry `carzo_site_settings.customers`** — **6 entries**.
   Precedence in code: real collection first, registry as fallback. Since (1) is
   absent, **this registry is the authoritative Production loyalty source today**
   (`CUSTOMER_STORE=directus`).
   - Fields: `phone`, `full_name`, `source`, `imported`, `legacy_*` (orders/products/city/delivery)
   - By `source`: `site` 3, `keycrm,wrike` 2, `wrike` 1
   - By `imported`: `true` 3 (legacy copies), `false` 3 (site enrollments)
3. **Supabase `customers`** — **5,994 rows**, the historical import
   (`scripts/migrate-customers.ts` from legacy CSV + registry, 2026-10-01/02).
   All `imported=true`, `source ∈ {import 4644, wrike 1322, "keycrm,wrike" 28}`,
   `full_name` present on 1,344, `legacy_*` on 1,327. 5,994 distinct normalized
   phones, 0 unnormalizable, 0 duplicate-phone rows. No rows created since the
   import window (max `updated_at` = 2026-10-02T00:07Z).

**Registry ↔ Supabase overlap (normalized with the canonical `+380XXXXXXXXX`
phone form, in-memory, no PII printed):**

| category | count | detail |
|---|---:|---|
| registry entries total | 6 | |
| overlap with Supabase (same phone) | 3 | field mismatches: `full_name` 0, `source` 0, `imported` 0, `legacy_*` 0 — **no conflicts** |
| registry-only (not in Supabase) | 3 | all `source=site`, `imported=false` — **new site loyalty enrollments** |
| Supabase-only (not in registry) | 5,991 | historical import population |

Test-customer check: the migration tooling excludes `--test-phone` (default = the
public business contact number hard-coded in `scripts/migrate-customers.ts`).
That number is **not present** in `public.customers` (count = 0) — exclusion held.
No other test-customer denylist exists in `product-page/lib`.

---

## 3. Supabase checkpoint (SELECT-only, 2026-11-03T22:57Z)

Exact `count(*)` (PostgREST pagination handled; no 1,000-row default-page
truncation — `customers` verified = 5,994 both via `count(*)` and via full
paginated fetch of 5,994 rows).

| table | 2026-11-04 external checkpoint | 2026-11-03 this run | verdict |
|---|---:|---:|---|
| customers | 5,994 | 5,994 | unchanged |
| orders | 10 | 10 | unchanged |
| order_items | 17 | 17 | unchanged |
| pages | 3 | 3 | unchanged |
| product_media | 17 | 17 | unchanged |
| variants | 12 | 12 | unchanged |

Full table counts (2026-11-03): designs 3, sizes 4, brands 26, variants 12,
fixations 4, fixation_size_extras 16, discount_tiers 2, gallery_images 57,
content_sets 16, content_sections 48, faq_items 8, rich_sections 4,
rich_section_images 12, benefit_modals 6, logo_settings 1, product_media 17,
site_settings 1, homepage_settings 1, about_settings 1, review_settings 1,
video_review_settings 1, car_mat_settings 1, pages 3, page_blocks 5,
orders 10, order_items 17, notification_settings 1, customers 5,994.

Additional invariants (read-only):

- orders: `checkout_attempt_id` set = 0, `request_fingerprint` set = 0,
  `manager_note` non-null = 0, `loyalty_eligible` = 3, `customer_id` linked = 0,
  10 distinct `order_number`, created 2026-07-28 … 2026-10-02.
  Preview synthetic order rows are **confirmed cleaned**.
- `product_media` = 17/17 canonical slots; 0 critical gaps; 0 Directus asset UUID
  refs; 28 public R2 URL checks = 0 failures (script `verify-directus-supabase-parity.ts`).
- notification settings: 0 mismatches vs Directus; `bot_token` and
  `directus_user_ids` **absent** in target.

---

## 4. Delta discovery — categorized differences

Method: pure in-memory comparison (ephemeral read-only tooling; nothing written),
cross-checked by the existing read-only `scripts/verify-directus-supabase-parity.ts`
(`--all`, run 2026-11-03: catalog 0 mismatch, pricing fixtures 27/0, content
mismatch 1 (see 4.3), historical orders 0 field mismatches, loyalty transform 0,
media 17/17, notification 0).

### 4.1 Summary

| domain | result | category |
|---|---|---|
| Catalog (designs, sizes, brands+logo_extra, variants, fixations+extras, discount tiers) | **0 drift** | parity |
| Content/CMS/settings (homepage, about, reviews, video reviews, car-mat, galleries, rich, FAQ, benefit modals, page blocks, notification) | **0 drift** | parity |
| Pages | `delivery-and-payment` present in Directus, absent in Supabase | **approved intentional divergence** |
| Orders | +1 Directus order not in Supabase (+3 items) | **live delta — to apply in Stage 8B** |
| Customers | +3 registry entries not in Supabase; 3 overlap with 0 conflicts | **live delta — to apply in Stage 8B** |
| Migrations | 2 remote/local filename mismatches (P2-5) | **documented, unrepaired** |

### 4.2 Orders and order_items (highest integrity concern)

Source is authoritative before Stage 9: Production `ORDER_STORE=directus` — all
live orders land in `carzo_orders`. Supabase `orders` holds only the Stage 2
historical import (10/17).

**Field-by-field parity of the 10 shared orders (compared by `order_number`):**
0 mismatches on status, created_at, all delivery-snapshot fields, all PII fields
(compared in memory only — values never printed), items_quantity, subtotal,
quantity_discount, total, discount_tier_key, contact_method, delivery_method.
Loyalty transform parity: 3 nested `{loyalty:{…}}` JSON `manager_note`s →
`loyalty_*` columns = 0 mismatches; `manager_note` NULL for those 3; 7 empty on
both sides; 0 unknown JSON. Item-level parity of the 17 shared items
(matched by `item_key`): 0 field mismatches (title, design/size/brand/fixation
labels+slugs, unit_price, quantity, line_total, quantity_discount_eligible).

**New since the Stage 2 snapshot (exactly one order):**

| attribute | value |
|---|---|
| order_number | `CZ-20261013-BD3D52` |
| created_at | 2026-10-13T19:43:37.705Z |
| status | `new` |
| contact / delivery | `phone` / `BRANCH` |
| items_quantity / rows | 4 units / 3 item rows |
| item keys | `L:4-0:none:both`, `L:4-0:none:wall`, `M:4-0:kia:both` |
| subtotal / quantity_discount / total | 10518 / 500 (`quantity-3`) / 10018 |
| manager_note | empty (no loyalty JSON) |
| email / comment | absent |

Internally consistent (item line totals sum to subtotal; total = subtotal − tier
discount). No `updated_at` exists on `carzo_orders` — per instructions, delta was
detected by **full compare on stable keys** (`order_number`, item `item_key`),
not timestamps.

**Snapshot is PROVISIONAL.** A live order can appear or change status at any
moment while Production keeps taking real orders. The final Stage 8B apply must
re-scan inside the approved freeze window and replay the comparison before write.

No exact-copy risks observed: historical rows were **not** recalculated
(prices preserved as snapshots; parity confirms), `checkout_attempt_id` /
`request_fingerprint` were not touched (all NULL, none written), no Preview
orders exist in target to overwrite.

### 4.3 Pages — approved intentional divergence (NOT a data error)

| source (Directus) | target (Supabase) | note |
|---|---|---|
| `home` (published) | `home` (published) | match |
| `privacy-policy` (draft) | `privacy-policy` (draft) | match; draft preserved unpublished |
| `public-offer` (draft) | `public-offer` (draft) | match; draft preserved unpublished |
| `delivery-and-payment` (published) | **absent** | **owner-approved removal** (D-1 closed) |

Page `id`s match 1:1 for the 3 common pages. `page_blocks` = 5 on both sides.
**Reconciliation must NOT re-create `delivery-and-payment` in Supabase.** The
Directus mirror of it stays until a separately scheduled production-safe removal
(Production still serves it — verified 2026-11-03: HTTP 200 from Directus).

### 4.4 Catalog, pricing, discounts

All 12 `design × size` variants compared by natural key `"{design}:{size}"`:
price, old_price, status, in_stock, quantity_discount_eligible — **12/12 identical**
(prices 1790/2249/2590/2990, old 2100/2600/2900/3400).
Brands 26/26 incl. `carzo_brand_pricing.logo_extra → brands.logo_extra` (0 mismatch).
Fixations 4/4 + 16 `fixation_size_extras` rows; `extra_by_size` expansion intact.
Discount tiers 2/2 (`min_quantity`/`amount` identical).
**No unexplained pricing/stock/SKU/relations drift → no BLOCKED condition.**

### 4.5 Content, CMS, media, settings

Full compare through the accepted target-schema transformations
(`carzo_site_settings` → 6 settings tables, `carzo_media_settings` → `product_media`,
`carzo_brand_pricing` → `brands.logo_extra`, `carzo_fixations.extra_by_size` →
`fixation_size_extras`, Directus file UUIDs never stored as URLs):

- galleries 57, content_sets 16, content_sections 48, faq_items 8,
  rich_sections 4, rich_section_images 12, benefit_modals 6 — key parity 100%
- singleton settings (site/homepage/about/review/video_review/car_mat): 0 mismatches
  vs Directus source fields (compared via parity script field checks)
- retired car-mat `landscape-placeholder.svg` / `car_mat_placeholder_url`: **stays
  removed** (drop migration `20261103125918_stage7x_drop_car_mat_placeholder_url`
  present both in git and remote history; media checks show 0 references)
- notification settings parity 0; Telegram recipients unchanged; bot token not copied
- drafts stayed drafts (2 drafts unpublished on both sides)

### 4.6 Customers — merge precedence for Stage 8B (explicit)

Only additive delta exists (3 rows). Proposed field-level precedence —
**to be approved before apply**:

| field | rule |
|---|---|
| `phone` (canonical `+380XXXXXXXXX`) | identity key; insert-only for new; never rewrite existing |
| `full_name` | keep existing non-null; fill only when target empty |
| `source` | keep existing; new rows take registry value (`site`) |
| `imported` | keep existing; new rows take registry value (`false`) |
| `legacy_*` | keep existing (none of the 3 new rows carry legacy data) |
| `created_at` | preserve original (registry has no timestamps → use freeze-window ingest time, flagged) |
| `updated_at` | set at ingest only |

Collision counts to re-check at apply time: expect 0 (current overlap = 3, all
field-identical). If a phone collides with different `full_name`, apply must stop
and report the category, never overwrite.

---

## 5. Migration tooling audit (read-only — nothing reused/executed)

| # | finding | evidence | risk if `--apply` re-run blindly |
|---|---|---|---|
| 1 | Stale expected counts in parity script: `pages: 4`, `orders: 10`, `order_items: 17` | `verify-directus-supabase-parity.ts` EXPECTED map | false FAIL noise (4 failures observed: pages count, pages key set, order_number set, order_items count — all explained in §4) |
| 2 | Deprecated car-mat placeholder fields | drop migration `20261103125918`; parity intentional-transforms allow-list | low — transform allow-list documents the drop |
| 3 | Old CMS projection names / mapped statuses | `migrate-directus-to-supabase/transform.ts` (pre-7.x) | content rows could be re-upserted with outdated projection |
| 4 | Stage 6 order RPC schema & immutable history | target expects `create_order_with_items` RPC + `request_fingerprint`; `migrate-directus-to-supabase.ts:566-567` raw-upserts `orders`/`order_items` | raw upsert bypasses RPC constraints; payload contains `checkout_attempt_id: null` which would blank non-null values on conflict |
| 5 | Customer registry precedence + stale `5994` guard | `migrate-directus-to-supabase.ts:511` `if (customers !== 5994) BLOCKED` | verify-mode hard-fails after any legitimate customer delta |
| 6 | Pagination/truncation | `migrate-directus-to-supabase.ts` `limit(-1)` + `limit(20000)` customers | PostgREST default-page trap exists in ad-hoc tooling (hit and corrected during 8A); official script OK at current scale |
| 7 | **Resurrection risk**: `upsert(db, 'pages', pages, 'id')` | `migrate-directus-to-supabase.ts:544` | **would re-create the intentionally deleted `delivery-and-payment`** — forbidden |
| 8 | Stage 6 local/remote migration version mismatch (P2-5) | see below | replay/repair **not** performed (discovery only) |

### 5.1 Migration history (remote) vs local files — documented only

Remote (`supabase.schema_migrations`, 9 rows) vs `supabase/migrations/` (9 files):

| remote version / name | local file | state |
|---|---|---|
| 20261001203704 `rls_auto_enable` | `20261001203704_rls_auto_enable.sql` | match |
| 20261001211849 `create_customers` | `20261001211849_create_customers.sql` | match |
| 20261001213417 `tighten_customers_service_role_grants` | `20261001213417_…` | match |
| 20261007101747 `directus_exit_schema_foundation` | `20261007101747_…` | match |
| 20261007114221 `add_missing_fk_indexes` | `20261007114221_…` | match |
| **20261031164057** `create_order_with_items_rpc` | **`20261101120000_create_order_with_items_rpc.sql`** | **P2-5 mismatch (version+filename)** |
| **20261031180954** `require_order_request_fingerprint` | **`20261101200000_require_order_request_fingerprint.sql`** | **P2-5 mismatch (version+filename)** |
| 20261101172930 `stage7x_add_editorial_media_urls` | `20261101172930_…` | match |
| 20261103125918 `stage7x_drop_car_mat_placeholder_url` | `20261103125918_…` | match |

Content is applied on the remote side; only the recorded version/filename pair
differs for 2 entries. **No replay, no repair, no rename performed** (§1 boundary).
Reconciliation (rename local files or re-register) is a Stage 8B/9 prerequisite
item owned by the owner.

---

## 6. Confidentiality & evidence dates

- No raw names, phones, emails, chat IDs, tokens, CSV snapshots, or row
  contents are present in this document or in any commit of this stage.
- All sensitive field comparisons were performed **in memory**; only aggregate
  mismatch counts are reported.
- `PREVIEW_SECRET` was never requested, read, or printed; no URL containing it
  was opened or stored.
- Telegram bot token: not read, not copied, not logged.
- Evidence captured 2026-11-03 (UTC): Supabase counts 22:57Z; Directus counts
  and parity run within the same session. Stage 2 baseline: 2026-10-07.
- Ephemeral comparison scripts were executed outside the repository (`/tmp`)
  and are **not** committed; no data dumps exist in the working tree.

---

## 7. Mutation ledger (Stage 8A)

| target | attempted | performed |
|---|---:|---:|
| Supabase writes (INSERT/UPDATE/DELETE/UPSERT/RPC/migration) | 0 | 0 |
| Directus writes (incl. permissions/publish) | 0 | 0 |
| R2 writes/renames/deletes | 0 | 0 |
| Orders/customers/Telegram/Nova Poshta side effects | 0 | 0 |
| Vercel env / flags / protection / promotions | 0 | 0 |
| `main` branch commits | 0 | 0 |

---

## 8. Final status

**`READY FOR OWNER REVIEW`**

- Read-only discovery is complete with full source coverage (24 collections +
  customer registry + Supabase 28 tables).
- Differences are fully categorized: 2 live-delta items (1 order + 3 items;
  3 customers), 1 approved intentional divergence (`delivery-and-payment`),
  1 documented tooling mismatch (P2-5). **No unexplained critical mismatch.**
- **This is NOT `Stage 8 PASS`.** Stage 8 completes only when an approved
  Stage 8B applies the delta inside the coordinated freeze window.

Owner decisions required before any write (see `docs/SUPABASE_STAGE8B_EXECUTION_PLAN.md`):

1. Approve the Stage 8B runbook and the customer merge precedence (§4.6).
2. Classify order `CZ-20261013-BD3D52` (real customer vs test) — default assumption: real.
3. Schedule the short freeze window (Stage 8B + Stage 9 coordination) and confirm
   Supabase Free-plan/production-availability decision (Stage 7 backlog item 10).
4. Decide P2-5 migration-filename reconciliation method.
