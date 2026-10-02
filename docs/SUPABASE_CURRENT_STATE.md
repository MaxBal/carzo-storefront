# Supabase — Current State Handoff

**Дата:** 2026-10-02  
**Статус:** PHASE 0–3 + **PHASE 4A / 4A.1 завершены** (adapter + hardening, no cutover). PHASE 5+ **не начаты**.  
**Проект:** Carzo Storefront (`product-page/`)  
**Supabase:** `Carzo` · `kmhegysmtsjqtwwaacht` · eu-west-1 · PostgreSQL 17

Цель документа: передать новой agent-сессии фактическое состояние Supabase-работы
без PII и без необходимости повторять bulk-импорт через контекст.

---

## 1. Completed

| PHASE | Что сделано | Commit |
|---|---|---|
| 0 | Baseline storefront/R2/UI + loyalty (Directus JSON) + docs | `22b1d86`, `c6c8be4`, `4f058fa` |
| 1 | RLS automation under migration history + REVOKE EXECUTE | `355354d` |
| 2 | `public.customers` schema + RLS + grants | `e41a203` |
| 2 fix | Least-privilege: service_role = DML only | `34411eb` |
| 3 | Customer migration tooling + primary data import | `37217be` + live data |
| 4A | Server-only Supabase client + customer-store abstraction + adapters (no cutover) | `9391c90` |
| 4A.1 | Adapter hardening: Directus write HTTP checks, strict phones, adapter mock tests, pinned supabase-js | *(this commit)* |

---

## 2. Verified live Supabase state

| Check | Value |
|---|---|
| `public.customers` rows | **5994** |
| unique phones | **5994** |
| invalid canonical phones | **0** |
| duplicate phones | **0** |
| RLS enabled | **yes** |
| FORCE RLS | no (intentional) |
| public policies | **0** (intentional deny-by-default) |
| `service_role` grants | SELECT, INSERT, UPDATE, DELETE |
| `service_role` TRUNCATE / REFERENCES / TRIGGER | revoked |
| `anon` / `authenticated` table access | **none** |
| Edge Functions | **0** |
| Security Advisor | only intentional INFO `rls_enabled_no_policy` |
| Performance Advisor | **0 issues** |

### Migration history (live == repo)

| Version | Name | Repo file |
|---|---|---|
| `20261001203704` | `rls_auto_enable` | `supabase/migrations/20261001203704_rls_auto_enable.sql` |
| `20261001211849` | `create_customers` | `supabase/migrations/20261001211849_create_customers.sql` |
| `20261001213417` | `tighten_customers_service_role_grants` | `supabase/migrations/20261001213417_tighten_customers_service_role_grants.sql` |

Also present: `public.rls_auto_enable()` + event trigger `ensure_rls`
(auto-ENABLE RLS on new public tables). EXECUTE revoked from PUBLIC/anon/authenticated.

---

## 3. Schema `public.customers` (summary)

```
id                  uuid PK default gen_random_uuid()
phone               text NOT NULL UNIQUE          -- canonical +380XXXXXXXXX
full_name           text
source              text NOT NULL default 'site'  -- first-appearance provenance
imported            boolean NOT NULL default false
legacy_orders_count integer NULL                  -- CHECK >= 0
legacy_products_count integer NULL                -- CHECK >= 0
legacy_city         text NULL
legacy_delivery     text NULL
created_at          timestamptz NOT NULL default now()
updated_at          timestamptz NOT NULL default now()
CHECK customers_phone_canonical (phone ~ '^\+380[0-9]{9}$')
```

No `raw_phone`. No extra indexes (only PK + UNIQUE phone).

### Import merge-policy (used in PHASE 3)

- `phone` = canonical identity (UNIQUE).
- `source` = first appearance; not overwritten by later site-upsert.
- `imported` / `legacy_*` / `created_at` not overwritten by site-upsert.
- `full_name` updated only when new non-empty value arrives.
- Site upsert later must follow the same policy (PHASE 4).

---

## 4. Current architecture

**Supabase is NOT yet application source of truth.**

| Data | Source of truth |
|---|---|
| Customers / loyalty eligibility | Supabase (imported snapshot) |
| Catalog, prices, variants, content | Directus |
| Orders | Directus |
| Notifications | Directus |
| Media | Cloudflare R2 |

Production storefront still runs on the existing Directus-backed path
(`lib/cart/customers.ts` JSON/collection fallback). No application cutover yet.

**Env (PHASE 4A, production still `directus`):**

```
SUPABASE_URL=...
SUPABASE_SECRET_KEY=sb_secret_...   # never NEXT_PUBLIC_*
CUSTOMER_STORE=directus|supabase    # missing → directus; invalid → fail fast
```

Modern Supabase secret key (`sb_secret_...`) is preferred over legacy `service_role` JWT.
Set `SUPABASE_URL` / `SUPABASE_SECRET_KEY` before flipping `CUSTOMER_STORE=supabase`.

### PHASE 4A application modules

| Module | Role |
|---|---|
| `lib/supabase/server.ts` | server-only admin client (`sb_secret_`, no browser exposure) |
| `lib/cart/customer-phone.ts` | shared canonical `normalizeCustomerPhone` (+380XXXXXXXXX) |
| `lib/cart/customer-store/` | abstraction + `directus` / `supabase` adapters + merge policy |
| `lib/cart/customers.ts` | stable facade: `findCustomerByPhone` / `upsertCustomerByPhone` / `isCustomerEligible` |
| `app/api/customer-discount/check/route.ts` | same success contract; store outage → HTTP 502 (not `eligible:false`) |

`CUSTOMER_STORE` selects exactly one backend. **No silent write fallback** (split-brain forbidden).
Production cutover still requires a fresh Directus delta sync (see §5).

---

## 5. Critical cutover rule

The current **5994 rows are a snapshot/import**.
Production Directus may keep receiving customers after this snapshot.

**Immediately before application cutover (PHASE 4B):**

1. take a **fresh** Directus customer snapshot;
2. run delta / reconciliation against Supabase;
3. upsert only new/changed records (same merge-policy);
4. verify aggregate counts / conflicts;
5. only then switch `CUSTOMER_STORE=supabase`.

Do not treat PHASE 3 as final sync.

---

## 6. Remaining work

| PHASE | Scope |
|---|---|
| 4A | **Done** — server-only Supabase adapter, `CUSTOMER_STORE`, no silent write fallback. Production still Directus. |
| 4B | Final Directus snapshot + delta/reconciliation + aggregate validation, then `CUSTOMER_STORE=supabase` |
| 5 | Authoritative server-side loyalty: shared `calculateLoyaltyDiscount`, server re-check eligibility, `PRICE_CHANGED`/`LOYALTY_CHANGED`, no silent price increase, order audit fields |
| 6 | Staging / E2E / security QA checklist |
| 7 | Cleanup Directus fallback after stability window |

Out of scope for now: orders in Supabase, Edge Functions, Auth, RPC customer helpers.

---

## 7. Context-efficiency rule (important)

**Never send bulk customer datasets through agent/MCP context again.**

For bulk / delta operations:

```
local script/file  →  Directus / Supabase
```

The agent should receive / output **aggregate statistics only**
(counts, conflicts, invalid phones, idempotency deltas).

Never print, serialize, paste or reason over thousands of individual customer rows.

Admin tooling entrypoint:

`product-page/scripts/migrate-customers.ts`

- `--dry-run` / `--apply --out-sql ...`
- normalizes phones, deterministic merge, emits SQL
- does **not** silently write via app runtime

Private snapshots / SQL / reports live **outside git**:
`/Users/qq/.carzo-private/` (not in repository).

---

## 8. Security notes

1. RLS deny-by-default + revoked table grants for `anon`/`authenticated`.
2. Elevated keys bypass RLS — RLS is **not** protection against secret-key leak.
3. `rls_auto_enable` EXECUTE revoked from public roles (Advisor WARN closed).
4. No customer PII in git, docs, or migration files.
5. API `POST /api/customer-discount/check` contract stays: `{phone}` → `{eligible, discount_percent}`; no PII in response.
6. Discount percent is server-authoritative after PHASE 5; do not trust client.

---

## 9. Rollback

| Layer | How |
|---|---|
| PHASE 3 data | `TRUNCATE public.customers;` then re-import (admin) |
| PHASE 2 schema | `DROP TABLE public.customers;` |
| PHASE 1 | restore previous function/grants (see migration comments) |
| Application cutover | `CUSTOMER_STORE=directus` |

Directus JSON registry remains the production backup until PHASE 7.

---

## 10. Git baseline pointer

| Ref | SHA | Notes |
|---|---|---|
| pre-Supabase baseline | `4f058fa` | docs + loyalty (Directus) |
| PHASE 1 | `355354d` | rls_auto_enable migration |
| PHASE 2 | `e41a203` | create_customers |
| PHASE 2 fix | `34411eb` | service_role DML-only |
| PHASE 3 tooling | `37217be` | migrate-customers.ts |
| PHASE 4A | `9391c90` | customer-store abstraction + Supabase adapter, no cutover |
| PHASE 4A.1 | *(this commit)* | Directus write HTTP validation, strict phones, adapter tests, pinned dep |

Validation notes (4A.1):
- `pnpm run test:customer-store` — 32 tests (phone strictness, store selection, merge policy, Supabase adapter mocks, Directus write failures)
- `pnpm exec tsc -p tsconfig.customer-store.json` — scoped typecheck (full `tsc --noEmit` hangs on this project)
- `next lint` / full `tsc --noEmit` hang in this environment — not used as a gate

4A.1 corrections:
- Directus registry PATCH / collection writes require real 2xx (`WRITE_FAILED` otherwise)
- `normalizeCustomerPhone` accepts only 12 (`380…`), 10 (`0…`), or 9 digit UA forms — no `slice(-9)`
- `createSupabaseCustomerStore(getClient)` DI for mock tests; production still `getSupabaseAdminClient`
- `@supabase/supabase-js` pinned to exact `2.110.8`
- no cutover, no live customer writes, production still Directus

Do not mix PHASE 5 / cutover changes into these commits.

---

*End of handoff. No customer PII in this document.*
