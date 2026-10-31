# Supabase — Current State Handoff

**Дата:** 2026-10-02  
**Статус:** PHASE 0–5 + **PHASE 6 завершены** (staging/E2E/security/checkout reliability QA). PHASE 4B / 7 **не начаты**. Checkout/loyalty finalization + Telegram fixation завершены.  
**Проект:** Carzo Storefront (`product-page/`)  
**Supabase:** `Carzo` · `kmhegysmtsjqtwwaacht` · eu-west-1 · PostgreSQL 17

Цель документа: передать новой agent-сессии фактическое состояние Supabase-работы
без PII и без необходимости повторять bulk-импорт через контекст.

---

## TARGET ARCHITECTURE CHANGED

**Старый план customer-only Supabase cutover (PHASE 4B в узком виде) ОТМЕНЁН.**

Ранее предполагалось: Supabase только для customers, Directus остаётся основным backend.
**Эта конечная цель больше не актуальна.**

### Новая конечная архитектура

```
Next.js
   │
   ├── Supabase
   │   └── все application data / database / backend
   │
   └── Cloudflare R2
       └── media: фото / видео / файлы

Directus
   └── только временный migration source
       → после общего cutover удаляется из production runtime
```

### Правила для следующей сессии

1. **НЕ выполнять** PHASE 4B в customer-only виде (`CUSTOMER_STORE=supabase` flip отдельно).
2. **НЕ переносить** catalog / orders / content / settings точечно — только после общего плана.
3. Customers будут переключены на Supabase **вместе с общим backend cutover**.
4. Directus **не** является долгосрочным backend. После full migration — удалить из runtime.
5. Следующий этап (отдельная чистая сессия):
   **`FULL DIRECTUS → SUPABASE MIGRATION — INVENTORY + TARGET SCHEMA + MASTER PLAN`**
6. В рамках того audit/plan **никаких** migration/schema changes до review.
7. Текущий Directus storefront продолжает работать до общего cutover — не ломать.

### Checkout / loyalty finalization (эта сессия)

- Loyalty business logic **COMPLETE** (shared 5% calc, server re-check, authoritative total, PRICE_CHANGED / LOYALTY_CHANGED / LOYALTY_UNAVAILABLE).
- Telegram `items_summary` теперь включает human-readable `Фіксація: …` из server quote.
- Pure formatter: `lib/cart/order-items-summary.ts` (`formatOrderItemsSummary`).
- Telegram **discount breakdown** (следующий fix): `{{discounts_summary}}` = `Разом дешевше −X ₴` + `Знижку 5% застосовано −Y ₴` (conditional, authoritative amounts only). Pure: `lib/cart/order-discounts-summary.ts`. Custom Directus template без token — injection перед `Сума:`.
- Expected manual E2E total for the documented scenario: **3999 ₴** (4409 − 200 qty − 210 loyalty 5%).
- Не делать customer-only Supabase cutover; customers уедут с общим migration.

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
| 4A.1 | Adapter hardening: Directus write HTTP checks, strict phones, adapter mock tests, pinned supabase-js | `67fdf2f` |
| 5 | Authoritative server-side loyalty pricing + `PRICE_CHANGED`/`LOYALTY_CHANGED` | `3919a8b` |
| 6 | Staging / E2E / security / checkout reliability QA | (see §6.2) |

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
| 5 | **Done** — shared `calculateLoyaltyDiscount`, server eligibility re-check, authoritative totals, `PRICE_CHANGED`/`LOYALTY_CHANGED`, no silent price increase |
| 6 | **Done** — staging / E2E / security / checkout reliability QA (see §6.2) |
| Checkout finalization | **Done** — fixation in Telegram notifications + tests (this session) |
| ~~4B (customer-only)~~ | **CANCELLED** — see TARGET ARCHITECTURE CHANGED |
| Next | **FULL Directus → Supabase inventory + target schema + master plan** (new session; no schema changes until review) |
| 7 / full cutover | After master plan + implementation: switch application data to Supabase, R2 media, remove Directus from runtime |

Out of scope for now: Edge Functions, Auth, RPC customer helpers. Orders/catalog/content migrate only via the full-Supabase plan.

---

## 6.1 PHASE 5 — Authoritative loyalty pricing

**Status:** completed. Production customer backend remains **Directus** (`CUSTOMER_STORE` unchanged). No PHASE 4B, no cutover, no production deploy, no Supabase schema changes.

### Shared calculation
- `lib/cart/loyalty-math.ts` — `calculateLoyaltyDiscount({ subtotal, quantityDiscount, discountPercent })`
- Semantics preserved: `amount = trunc((subtotal - quantityDiscount) * percent / 100)`, `discountedTotal = baseTotal - amount` (whole UAH, truncation)
- Used by CartDrawer preview and server checkout (single formula; old duplicate removed)

### Server checkout (`lib/cart/checkout-pricing.ts`)
- Server rebuilds quote, re-checks eligibility via `findCustomerByPhone` (configured `CUSTOMER_STORE`)
- `loyaltyPhone != customerPhone` (canonical) → discount not applied
- Client `discount_percent` / amount are never authoritative
- `expectedTotal` = UI final (discounted when loyalty applied); `expectedBaseTotal` = quote.total for change classification
- Authoritative final total persisted as Directus `orders.total`
- Codes: `PRICE_CHANGED` (underlying quote), `LOYALTY_CHANGED` (loyalty state), `LOYALTY_UNAVAILABLE` (store outage — never silently full-price)
- Change / loyalty-failure paths return **before** order write / Telegram / post-order customer upsert

### Loyalty audit storage
- Current `carzo_orders` has **no** loyalty columns and **no** JSON metadata field
- `customer_comment` intentionally untouched
- Chosen fallback: structured JSON in internal `manager_note` (new orders only) via `lib/cart/order-audit.ts`
- Proposal for later (optional, after staging): dedicated columns `loyalty_phone`, `loyalty_eligible`, `loyalty_discount_percent`, `loyalty_discount_amount` on `carzo_orders` — **not applied** (no live Directus schema mutation in PHASE 5)

### Validation
- `pnpm run test:loyalty` — 37 tests (math truncation, eligibility, phone mismatch, tamper, LOYALTY_CHANGED both directions, store outage, side-effect gates)
- `pnpm run test:customer-store` — 32 tests (regression)
- `pnpm exec tsc -p tsconfig.loyalty.json` — scoped typecheck
- Full `tsc --noEmit` / `next lint` not used as gate in this environment (pre-existing unrelated errors in `scripts/migrate-customers.ts` / test env types; no PHASE 5 type errors)

### Security notes (PHASE 5)
- Server re-validates loyalty; browser cannot grant 5% by payload edit
- Store outage → `LOYALTY_UNAVAILABLE`, not `eligible:false`
- No PII/secrets in commit; no bulk customer data through context
- Public `POST /api/customer-discount/check` contract unchanged

---

## 6.2 PHASE 6 — Staging / E2E / security / checkout reliability QA

**Status:** completed (code + live Supabase + staging HTTP/API smoke). Production customer backend remains **Directus**. No PHASE 4B, no cutover, no production deploy, no live customer writes, no test orders.

### Checkout reliability (fixed)
- **Bug closed:** notification / customer-upsert failure after a successful Directus `writeOrder` can no longer surface as client `FAILED` (false failure → duplicate submit risk).
- New module: `lib/cart/checkout-reliability.ts` (`runPostOrderSideEffects`, `safeErrorDetail`).
- Semantics: order write is the success boundary; notify + upsert are best-effort; errors logged without dumping response bodies / control chars.
- `writeOrder` non-2xx throws HTTP status only (no response body / possible PII echo).
- Tests: `pnpm run test:checkout-reliability` (9).

### Regression / types
- `pnpm run test:customer-store` — 32 green
- `pnpm run test:loyalty` — 37 green
- `pnpm run test:checkout-reliability` — 9 green
- scoped `tsc` (`tsconfig.customer-store.json`, `tsconfig.loyalty.json`) — green
- full `tsc --noEmit` — **green** (fixed legacy Map iteration + test ProcessEnv typing)

### Staging
- Live `https://carzo-eight-staging.vercel.app` HTTP 200, `x-robots-tag: noindex`.
- Loyalty API: invalid / unknown phone → `{eligible:false, discount_percent:0}` (no PII).
- Rate limit: in-memory 20/min → HTTP 429 `{error:"Too many requests"}`.
- Local `next build` still hangs (pre-existing); Vercel is build source of truth.
- **Staging deploy confirmed (this session):** `carzo-eight-staging` READY, branch `dev`, SHA `cbec2d4b86ced545fed10412572afb89d1b30ba4` (discount breakdown + prior fixation). Loyalty API smoke green on previous `bbef4eb` build.
- Staging Directus appears shared with production → **no real test orders** (per policy). Live browser checkout E2E limited (IAB zero-width viewport). Manual eligible-customer E2E left for the user.

### Security (live)
- Supabase `public.customers`: 5994 rows / 5994 unique phones / 0 invalid.
- RLS enabled, **0 policies** (intentional deny-by-default).
- Grants: `postgres` + `service_role` DML only (SELECT/INSERT/UPDATE/DELETE). No `anon` / `authenticated`.
- Migrations: exactly 3 expected.
- Security Advisor: only intentional INFO `rls_enabled_no_policy`.
- Performance Advisor: 0 issues.
- No `NEXT_PUBLIC_*` secrets; no committed `.env`; Supabase admin client is `server-only`.
- Client cart items contain **no prices** — `quoteCartItems()` reads Directus variants.

### manager_note loyalty audit
- Verdict: **ACCEPT TEMPORARILY** for staging QA; **RECOMMEND dedicated fields before production cutover** (`loyalty_phone`, `loyalty_eligible`, `loyalty_discount_percent`, `loyalty_discount_amount`).
- Not exposed on public frontend; `customer_comment` untouched. Staff overwrite of JSON remains residual risk.

### Idempotency / duplicate orders
- UI `submitting` reduces double-click; **no server idempotency key**.
- Residual risk: network retry / browser retry after timeout can still create a second order.
- **Do not mutate Directus schema in QA.** Future: unique checkout-attempt id / order key (separate controlled change).

### PHASE 4B readiness
**READY** (architecture + tests + security). Operational preconditions still required before flip: fresh Directus delta, valid Vercel auth for staging deploy confirmation, controlled `CUSTOMER_STORE=supabase` cutover with rollback plan.

Rollback remains: `CUSTOMER_STORE=directus`. Directus customer JSON retained.

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
6. Discount percent is server-authoritative (PHASE 5); do not trust client.

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
| PHASE 4A.1 | `67fdf2f` | Directus write HTTP validation, strict phones, adapter tests, pinned dep |
| PHASE 5 | `3919a8b` | authoritative server-side loyalty pricing |
| PHASE 6 | `c87f33c` | checkout reliability + staging/security QA |
| Checkout finalization | `542d42e` | fixation in order notifications + pure summary formatter |
| Target architecture | `bbef4eb` | TARGET ARCHITECTURE CHANGED + remaining work rewrite |
| Staging SHA stamp | `9287bde` | staging deploy confirmation (`bbef4eb` live on carzo-eight-staging) |
| Discount breakdown | `cbec2d4` | Telegram quantity + loyalty discount rows (authoritative amounts) |

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
