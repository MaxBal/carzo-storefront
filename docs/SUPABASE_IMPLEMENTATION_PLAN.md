# Supabase Integration — Audit & Implementation Plan

**Дата:** 2026-10-01  
**Редакция:** v2 — обновлено по результатам независимого архитектурного review  
**Статус:** ТОЛЬКО ПЛАН. Реализация не начата.  
**Проект:** Carzo Storefront (`product-page/`)  
**Supabase Project:** `Carzo` · `kmhegysmtsjqtwwaacht` · `eu-west-1` · PostgreSQL **17.11**

**Правило реализации:** строго одна PHASE за раз → отчёт → независимая проверка → PASS → только затем следующая. Изменения будущих фаз не выполнять «заодно». Переход к PHASE 0 — только после явного разрешения.

---

## 1. Результаты аудита

### 1.1 Git

| Параметр | Факт |
|---|---|
| Worktree | `/Users/qq/Documents/GitHub/carzo-storefront` |
| Branch | `dev` @ `872e505` (`fix: cart badge color #5ce4ab → #ca423d`) |
| Remote | `origin/dev` — up to date |
| Staged | нет |
| Modified (unstaged) | **22 файла** |
| Untracked | **9 путей** |
| Worktrees | `audit/r2-media-mapping` @ `/private/tmp/carzo-media-audit-wt`; `feature/r2-media-migration` @ `/Users/qq/Documents/GitHub/carzo-storefront-r2-migration` @ `1174c06` |
| Сломанный ref | `refs/heads/dev 2` — git warning, не влияет на работу |

**Modified (22):** `checkout.ts`, `ProductPageClient.tsx`, `CarmatPageContent.tsx`, `catalog-carmat/page.tsx`, `homepage.css`, `BenefitCards.tsx`, `BenefitModal.tsx`, `LogoModal.tsx`, `ProductOptions.tsx`, `ProductRichContent.tsx`, `CartDrawer.tsx`, `carzo-content.seed.json`, `loyalty.ts`, `cart/server.ts`, `car-mat-designs.ts`, `default-source.ts`, `directus.ts`, `global-modals.ts`, `homepage.ts`, `resolver.ts`, `types.ts`, `product-data.ts`

**Untracked (9):** `docs/SUPABASE_HANDOFF.md`, `product-page/lib/cart/customers.ts`, `product-page/app/api/customer-discount/check/route.ts`, `product-page/components/VideoReviewsSection.tsx`, `product-page/components/ProductSectionNav.tsx`, `product-page/components/MobileStickyBuy.tsx`, `product-page/app/video-reviews.css`, `product-page/app/product-nav.css`, `.DS_Store` (не коммитить)

### 1.2 Customers / Loyalty (текущая реализация)

**Поток лояльности:**

```
CartDrawer → checkLoyaltyDiscount(phone)
           → POST /api/customer-discount/check
           → normalizeCustomerPhone + findCustomerByPhone
           → { eligible: bool, discount_percent: 0|5 }

UI: amount = trunc((subtotal - quantityDiscount) * 5/100)
   total_shown = quote.total - amount

Checkout: createOrder({ expectedTotal: quote.total, ... })
        → server: quote.total !== expectedTotal → PRICE_CHANGED
        → upsertCustomerByPhone (после заказа, non-fatal)
```

**`lib/cart/customers.ts`:**
- `normalizeCustomerPhone` → canonical `+380XXXXXXXXX` (9 цифр)
- `findCustomerByPhone`: сначала Directus collection `customers`, fallback JSON `carzo_site_settings.customers[]`
- `upsertCustomerByPhone`: check-then-insert; при conflict → treat as exists; fallback JSON push
- Race condition на JSON-пути: **не защищён** (read-modify-write всего массива)

**`app/api/customer-discount/check/route.ts`:** rate limit 20 req/min/IP (in-memory Map), не возвращает PII, hardcoded `discount_percent: 5`.

**`app/actions/checkout.ts`:** `upsertCustomerByPhone` после `writeOrder` + `notifyNewOrder`, в try/catch; `expectedTotal` сверяется с `quote.total` **без** loyalty.

**`components/cart/CartDrawer.tsx`:** показывает `quote.total - loyaltyDiscount.amount`, отправляет `expectedTotal: cart.quote.total` (без вычета); сброс loyalty при расхождении `loyaltyPhone` vs `customerPhone` (клиент-side).

### 1.3 Directus dependencies

| Область | Источник |
|---|---|
| Каталог (designs, sizes, brands, variants, gallery) | Directus |
| Контент страниц, benefit modals, FAQ | Directus |
| Prices / brand_pricing / fixations / size_shipping | Directus |
| Orders (`carzo_orders`, `carzo_order_items`) | Directus |
| Notifications (Telegram settings) | Directus |
| Customers | Directus JSON `carzo_site_settings.customers` (collection **не создана** — collections limit) |
| Media | R2 primary → Directus File fallback → local `public/` |

Env: `DIRECTUS_URL`, `DIRECTUS_READ_TOKEN` (server-only), `DIRECTUS_ADMIN_TOKEN` (scripts), `NOVA_POSHTA_API_KEY`, `TELEGRAM_BOT_TOKEN`.  
`SUPABASE_*` в `.env.example` **не описаны**. В коде **упоминаний Supabase нет**.

### 1.4 Supabase project (перепроверено)

| Проверка | Результат |
|---|---|
| Project URL | `https://kmhegysmtsjqtwwaacht.supabase.co` |
| Region / engine | eu-west-1 · PostgreSQL **17.11** |
| Tables в `public` | **0** |
| Tables в других схемах | только системные (`auth`, `storage`, `realtime`, `extensions`, `vault`, `pgbouncer`) |
| Migrations (tracked) | **0** |
| Edge Functions | **0** |
| App-level functions | только `public.rls_auto_enable()` |
| Auth | не используется приложением |
| Performance advisors | чисто |
| Security advisors | **2 WARN** (см. ниже) |
| API keys | legacy `anon` + modern `sb_publishable_...` (`default`). **Secret key (`sb_secret_...`) ещё НЕ создан** |

**`public.rls_auto_enable()`:**
- `LANGUAGE plpgsql`, `SECURITY DEFINER`, `RETURNS event_trigger`
- `SET search_path TO 'pg_catalog'`
- Event trigger `ensure_rls` на `ddl_command_end`, tags: `CREATE TABLE`, `CREATE TABLE AS`, `SELECT INTO`
- Поведение: при создании таблицы в `public` автоматически `ENABLE ROW LEVEL SECURITY`
- `proacl = NULL` → default `PUBLIC EXECUTE`
- `has_function_privilege`: `anon=true`, `authenticated=true`, `service_role=true`, `postgres=true`
- **Security Advisor WARN ×2:** anon и authenticated могут выполнить эту SECURITY DEFINER функцию через `/rest/v1/rpc/rls_auto_enable`

**Schema drift (ключевая проблема):** `rls_auto_enable()` и `ensure_rls` существуют в живой БД, но **не зафиксированы в tracked migrations**. Чистая БД, восстановленная только из migrations репозитория, не получит ни функцию, ни event trigger.

### 1.5 Расхождения с handoff

| # | Handoff | Факт | Комментарий |
|---|---|---|---|
| 1 | Untracked **7 файлов** | **9 путей** (+`.DS_Store`, +`docs/SUPABASE_HANDOFF.md`) | Handoff не считал сам handoff и DS_Store |
| 2 | Supabase «project нет подтверждения» | Project **существует**, URL/keys доступны | Handoff писался до проверки dashboard/MCP |
| 3 | Functions «нет» | Есть `public.rls_auto_enable()` + event trigger `ensure_rls` | Handoff имел в виду app/Edge Functions |
| 4 | Migrations «нет» | Подтверждено: 0 tracked migrations | `rls_auto_enable` создана вне migration-системы |
| 5 | bulk-import из CRM не выполнен | Подтверждено | В seed JSON тоже **нет** `customers` — данные только в live Directus |
| 6 | Loyalty UI vs server total | Подтверждено | Точное совпадение с handoff |
| 7 | Rate limit ~20/min | Подтверждено in-memory Map | Сбрасывается на cold start |
| 8 | `carzo_group_notifications` удалена | Не проверялось в Directus (вне scope) | Open item, не блокирует Supabase |

---

## 2. Целевая архитектура

### 2.1 Принцип

**Supabase = source of truth только для customers / loyalty eligibility.**  
Каталог, контент, цены, заказы, уведомления — Directus. Media — R2. Не смешивать CMS и operational customer data.

| Данные | Source of truth |
|---|---|
| Customers / loyalty eligibility | **Supabase** |
| Catalog, prices, variants, gallery | Directus |
| Site content, modals, FAQ | Directus |
| Orders | **Directus** (в рамках этой задачи не переносить) |
| Notifications | Directus |
| Media | Cloudflare R2 |

### 2.2 Schema `public.customers`

```sql
CREATE TABLE public.customers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                 text NOT NULL UNIQUE,          -- canonical +380XXXXXXXXX
  full_name             text,
  source                text NOT NULL DEFAULT 'site',  -- источник ПЕРВОГО появления
  imported              boolean NOT NULL DEFAULT false,
  legacy_orders_count   integer,
  legacy_products_count integer,
  legacy_city           text,
  legacy_delivery       text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_phone_canonical
    CHECK (phone ~ '^\+380[0-9]{9}$')
);
```

**Почему `id uuid PK` + `UNIQUE(phone)`, а не `phone` как PK:**
- Телефон — lookup key и атрибут клиента, а не immutable identity
- В будущем: смена телефона, несколько телефонов, merge дублей, CRM customer ID, order/customer relations, loyalty ledger
- `UNIQUE(phone)` создаёт индекс — lookup по телефону не деградирует
- Стабильный `id` позволяет ссылаться из связанных сущностей без каскадных изменений при смене телефона

**Без `raw_phone`:** canonical phone достаточен для operational-модели. Хранение исходного форматирования — лишняя PII без бизнес-пользы. Для migration/import — временный отчёт `input_phone / canonical_phone / status` (файл, не таблица).

**Без преждевременных индексов:** на старте достаточно `PRIMARY KEY (id)` + `UNIQUE (phone)`. Индексы на `source`, `imported` и др. — только когда появится конкретный query pattern. Отдельный индекс на boolean `imported` — не создавать без performance-case.

### 2.3 Merge-policy при upsert (явная)

**Запрещён слепой last-write-wins.**

Проблема: CRM-импорт (`source=keycrm`, `imported=true`, `legacy_orders_count=7`) не должен превращаться в `source=site`, `imported=false` после обычного site-upsert.

| Поле | Site upsert (после заказа) | Import / CRM upsert |
|---|---|---|
| `full_name` | Обновить **только если** передано новое непустое значение; иначе оставить существующее | Обновить, если передано непустое; иначе оставить |
| `updated_at` | Всегда `now()` | Всегда `now()` |
| `source` | **НЕ трогать** (первое появление) | Установить только при **insert** (новая строка) |
| `imported` | **НЕ трогать** | Установить только при **insert** |
| `legacy_*` | **НЕ трогать** | Установить только при **insert**, либо обновить если было NULL |
| `created_at` | **НЕ трогать** | **НЕ трогать** |

**`source` = источник первого появления customer, immutable после insert.**

Не вводим `first_source` / `last_source` сейчас: текущий `CustomerRecord` уже имеет `source`, use-case для `last_source` отсутствует. При появлении CRM-синка — добавить `last_seen_at` / `last_source` отдельной migration.

**Реализация upsert (server-side):**

```
INSERT INTO customers (phone, full_name, source, imported, legacy_*)
VALUES ($1, $2, $3, $4, $5, ...)
ON CONFLICT (phone) DO UPDATE SET
  full_name = CASE
    WHEN EXCLUDED.full_name IS NOT NULL AND EXCLUDED.full_name <> ''
      THEN EXCLUDED.full_name
    ELSE customers.full_name
  END,
  updated_at = now()
-- source, imported, legacy_*, created_at не в SET
```

### 2.4 RLS и grants

**Обоснование RLS (исправленное):**  
RLS **не защищает от утечки elevated secret/service-role key** — такие ключи имеют elevated access и bypass RLS. RLS здесь нужен для:
- deny-by-default для `anon` и `authenticated`;
- защиты exposed `public` schema;
- защиты от случайного будущего frontend access;
- defense-in-depth относительно обычных ролей.

```sql
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;
-- НИКАКИХ policies для anon/authenticated — deny by default
-- elevated secret key / service_role: BYPASSRLS

REVOKE ALL ON public.customers FROM PUBLIC;
REVOKE ALL ON public.customers FROM anon;
REVOKE ALL ON public.customers FROM authenticated;
GRANT  ALL ON public.customers TO service_role;
GRANT  ALL ON public.customers TO postgres;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role, postgres;
```

### 2.5 RPC не использовать

`find_customer_by_phone` / `upsert_customer_by_phone` RPC **не нужны**. Достаточно server-side Supabase client + `select().eq('phone')` / upsert с `ON CONFLICT (phone)`.

RPC добавить позднее, только если появится атомарная multi-table операция (customer + loyalty ledger + order discount audit).

### 2.6 Нормализация телефона — комбинация

| Слой | Что делает |
|---|---|
| **Application** (`normalizeCustomerPhone`) | Основная нормализация → `+380XXXXXXXXX` |
| **Database** (`CHECK phone ~ '^\+380[0-9]{9}$'`) | Defense-in-depth от бага в коде / прямых SQL-вставок / импорта |

Не делать trigger-based re-normalization.

### 2.7 Keys и env

По актуальной документации Supabase («Migrating to publishable and secret API keys»):

| Legacy | Modern | Где |
|---|---|---|
| `anon` | `sb_publishable_...` | browser / public |
| `service_role` | `sb_secret_...` | server / Edge Functions |

**Использовать modern secret key:**

```
SUPABASE_URL=https://kmhegysmtsjqtwwaacht.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
CUSTOMER_STORE=directus   # до cutover; после — supabase
```

- **Никогда** `NEXT_PUBLIC_*` для secret key
- Secret key только в server-side коде
- Legacy `service_role` использовать **только** при конкретной технической необходимости (в рамках этого проекта такой необходимости нет)
- Modern keys: header `apikey`, **не** `Authorization: Bearer <key>` (platform rejects `sb_` in Authorization as Invalid JWT). `@supabase/supabase-js` `createClient(url, 'sb_secret_...')` обрабатывает это корректно
- Secret keys bypass RLS и дают полный доступ — хранить вне source control и client code
- **Действие:** secret key в проекте **ещё не создан** — создать в Dashboard → Settings → API Keys («Create new API keys») до PHASE 4

### 2.8 `public.rls_auto_enable()` — взять под migrations, ограничить EXECUTE

| Вариант | Вердикт | Обоснование |
|---|---|---|
| Оставить как есть | ❌ | WARN + schema drift |
| Удалить | ❌ | Потеряем safety net авто-RLS |
| Перенести в другую схему | ⚠️ опционально позже | Чище для PostgREST, не блокер |
| Только REVOKE | ❌ | Не решает schema drift — migration невоспроизводима на чистой БД |
| **Декларативная migration + REVOKE** | ✅ | Воспроизводимо + закрывает WARN |
| SECURITY INVOKER | ❌ | Сломает event trigger (`ALTER TABLE` от имени владельца) |

**PHASE 1 обязана декларативно обеспечить** существование function + event trigger + REVOKE, а не только REVOKE.

---

## 3. Итоговый Master Plan (структура PHASE)

```
PHASE 0  Git Baseline
PHASE 1  Supabase Baseline + Security (RLS automation under migrations)
PHASE 2  Customers Schema
PHASE 3  Data Migration
PHASE 4  Application Adapter + Cutover
PHASE 5  Authoritative Server-side Loyalty
PHASE 6  E2E / Staging / Security Audit
PHASE 7  Cleanup
```

Порядок **schema → data migration → validation → application cutover** (не наоборот).

---

## PHASE 0 — Git Baseline

| | |
|---|---|
| **Цель** | Зафиксировать storefront / R2 / UI / loyalty до начала Supabase |
| **Scope** | Только git commits существующего uncommitted/untracked состояния |
| **Конкретные изменения** | 3 логичных коммита (см. ниже) |
| **Файлы** | Существующие modified/untracked (кроме `.DS_Store`) |
| **Supabase** | — |
| **Migrations** | — |
| **Security/RLS** | — |
| **Data migration impact** | — |
| **Тесты** | `pnpm exec tsc --noEmit` |
| **PASS criteria** | clean working tree; 3 коммита на `dev`; точный rollback возможен |
| **Rollback** | `git reset --hard 872e505` (до push) |
| **НЕ входит** | Любые Supabase-изменения; push без review; `.DS_Store` |

**Commit 1 — storefront / R2 / UI:** 22 modified + `VideoReviewsSection.tsx`, `ProductSectionNav.tsx`, `MobileStickyBuy.tsx`, `video-reviews.css`, `product-nav.css`, seed, CSS.  
**Commit 2 — loyalty foundation (без Supabase):** `lib/cart/customers.ts`, `app/api/customer-discount/check/route.ts`, `loyalty.ts`, `checkout.ts` (upsert), `CartDrawer.tsx` (loyalty UI).  
**Commit 3 — docs:** `docs/SUPABASE_HANDOFF.md`, `docs/SUPABASE_IMPLEMENTATION_PLAN.md`.

Не смешивать R2/UI и Supabase-schema/RLS. Далее — ветка `feature/supabase-customers` от `dev`.

---

## PHASE 1 — Supabase Baseline + Security

| | |
|---|---|
| **Цель** | Взять существующую RLS automation под управление migrations и закрыть Security Advisor WARN |
| **Scope** | Только `rls_auto_enable()` + `ensure_rls` + REVOKE EXECUTE |
| **Supabase** | Декларативное создание/обновление function + event trigger; REVOKE |
| **Migrations** | 1 migration, воспроизводимая на чистой БД |
| **Security/RLS** | Сохранить auto-enable RLS; закрыть public EXECUTE |
| **Data migration impact** | — |
| **Файлы** | `supabase/migrations/<ts>_rls_auto_enable.sql` |
| **НЕ входит** | `customers` schema; grants на таблицы; app-код; keys |

### Migration (декларативная)

```sql
-- 1. Function: create-or-replace, воспроизводимо на чистой БД
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog'
AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table', 'partitioned table')
  LOOP
    IF cmd.schema_name IS NOT NULL
       AND cmd.schema_name IN ('public')
       AND cmd.schema_name NOT IN ('pg_catalog', 'information_schema')
       AND cmd.schema_name NOT LIKE 'pg_toast%'
       AND cmd.schema_name NOT LIKE 'pg_temp%'
    THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
    ELSE
      RAISE LOG 'rls_auto_enable: skip % (schema %)', cmd.object_identity, cmd.schema_name;
    END IF;
  END LOOP;
END;
$$;

-- 2. Event trigger: drop-if-exists + create (идемпотентно, воспроизводимо)
DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end
  WHEN TAGS IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();

-- 3. Close public EXECUTE (Security Advisor WARN)
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
```

### Целевое состояние

```
public.rls_auto_enable()
    SECURITY DEFINER
    SET search_path = pg_catalog
    RETURNS event_trigger

ensure_rls
    ddl_command_end
    WHEN TAGS IN (CREATE TABLE, CREATE TABLE AS, SELECT INTO)

EXECUTE:
    PUBLIC          -> revoked
    anon            -> revoked
    authenticated   -> revoked
    postgres        -> available (default)
```

Auto-enable RLS для новых таблиц `public` **сохраняется**.

### Тесты / проверки

1. `SELECT` definition `public.rls_auto_enable()` — существует, SECURITY DEFINER, search_path=pg_catalog
2. `pg_event_trigger` — `ensure_rls` существует, enabled, tags корректны
3. `CREATE TABLE public._rls_probe(x int)` → `relrowsecurity = true`; затем `DROP TABLE`
4. Security Advisor → 0 WARN по `anon_security_definer_function_executable` / `authenticated_security_definer_function_executable`
5. **Воспроизводимость:** на чистой/тестовой БД выполнить только эту migration → пп. 1–3 проходят

### PASS criteria

- Function + event trigger существуют и работают
- Новая public table автоматически получает RLS
- Security Advisor WARN исчезли
- Migration воспроизводима на чистой БД (CREATE OR REPLACE + DROP IF EXISTS + CREATE)

### Rollback

```sql
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC, anon, authenticated;
-- при полном откате PHASE 1:
-- DROP EVENT TRIGGER IF EXISTS ensure_rls;
-- DROP FUNCTION IF EXISTS public.rls_auto_enable();
```

### Что явно НЕ входит

- Создание `customers` или любых таблиц
- Изменение grants на таблицы
- App-код, env, keys
- Перенос функции в другую схему

---

## PHASE 2 — Customers Schema

| | |
|---|---|
| **Цель** | Создать `public.customers` с стабильным identity и безопасными constraints |
| **Scope** | Только DDL таблицы + RLS + grants |
| **Supabase** | CREATE TABLE, CHECK, UNIQUE, indexes (только PK+UNIQUE), RLS, grants |
| **Migrations** | 1 migration |
| **Security/RLS** | RLS on + FORCE, deny для anon/authenticated |
| **Data migration impact** | Таблица пустая; данные — PHASE 3 |
| **Файлы** | `supabase/migrations/<ts>_create_customers.sql` |
| **НЕ входит** | App adapter; data migration; loyalty logic; indexes на source/imported |

### Migration

```sql
CREATE TABLE public.customers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                 text NOT NULL UNIQUE,
  full_name             text,
  source                text NOT NULL DEFAULT 'site',
  imported              boolean NOT NULL DEFAULT false,
  legacy_orders_count   integer,
  legacy_products_count integer,
  legacy_city           text,
  legacy_delivery       text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_phone_canonical
    CHECK (phone ~ '^\+380[0-9]{9}$')
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.customers FROM PUBLIC;
REVOKE ALL ON public.customers FROM anon;
REVOKE ALL ON public.customers FROM authenticated;
GRANT  ALL ON public.customers TO service_role;
GRANT  ALL ON public.customers TO postgres;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role, postgres;
```

**Без `raw_phone`. Без `CREATE INDEX` на `source` / `imported`.**

### Тесты

1. Insert с phone не `+380XXXXXXXXX` → CHECK reject
2. Duplicate phone → UNIQUE reject (или корректный `ON CONFLICT` upsert)
3. `anon` select/insert/update/delete → 0 строк / permission denied
4. `authenticated` — то же
5. Elevated key (`sb_secret_`) insert/select → OK
6. `pg_class`: `relrowsecurity=true`, `relforcerowsecurity=true`
7. Security Advisor: чисто по customers

### PASS criteria

- Таблица существует с заданной схемой
- Invalid phone rejected; duplicate phone rejected/upsertable
- Public access запрещён; server access работает
- RLS enabled + forced; grants корректны

### Rollback

```sql
DROP TABLE IF EXISTS public.customers;
```

### Что явно НЕ входит

- Вставка данных
- Изменение приложения
- Дополнительные индексы
- Loyalty/checkout логика

---

## PHASE 3 — Data Migration

| | |
|---|---|
| **Цель** | Перенести существующих customers в Supabase **до** cutover приложения |
| **Scope** | Экспорт + нормализация + bulk upsert + отчёты. Production app продолжает работать по старому source |
| **Supabase** | Bulk upsert (idempotent) |
| **Migrations** | — |
| **Security/RLS** | Скрипт работает с server-only secret key |
| **Data migration impact** | Directus JSON + legacy CRM → `public.customers` |
| **Файлы** | `product-page/scripts/migrate-customers.ts` (новый); `product-page/scripts/import-legacy-customers.ts` (новый, опц.); отчёты в `scripts/out/` (не коммитить) |
| **НЕ входит** | Переключение `CUSTOMER_STORE`; app adapter; изменение API |

### Источники

1. Directus JSON `carzo_site_settings.customers[]` (seed + live)
2. Legacy CRM dataset (CSV/keycrm/wrike) — отдельный import

### Pipeline

```
backup исходных данных (JSON dump)
    ↓
dry-run: normalize + classify
    ↓
отчёты: normalization / duplicates / invalid phone
    ↓
bulk upsert (ON CONFLICT (phone) DO UPDATE по merge-policy)
    ↓
validation: count / spot-check / known-phone lookup / idempotent rerun
    ↓
reconciliation report
```

### Merge-policy при импорте

- **Insert** (новый phone): `source`, `imported`, `legacy_*` — как в источнике
- **Update** (phone уже есть): не затирать `source`/`imported`/`legacy_*`/`created_at`; `full_name` — только если источник даёт непустое; всегда `updated_at`

### Отчёты (обязательны)

| Отчёт | Содержание |
|---|---|
| dry-run | сколько к insert / update / skip |
| normalization | `input_phone` → `canonical_phone` → `status` |
| duplicates | повторы canonical phone в источнике |
| invalid phone | строки, которые не нормализуются |
| count validation | source_count vs inserted+updated |
| spot-check | ≥10 известных телефонов |
| idempotency | повторный запуск → 0 insert, 0 data change |
| reconciliation | итоговая сверка |

### PASS criteria

- Все известные телефоны находятся через server lookup
- Dry-run отчёт приложен; backup сделан
- Повторный запуск идемпотентен
- Production app **не переключён** (остаётся `CUSTOMER_STORE=directus`)

### Rollback

```sql
-- после backup JSON
TRUNCATE public.customers;
```

### Что явно НЕ входит

- `CUSTOMER_STORE=supabase`
- Правки runtime-кода customers.ts
- Loyalty/checkout changes

---

## PHASE 4 — Application Adapter + Cutover

| | |
|---|---|
| **Цель** | Переключить customers-хранилище на Supabase после успешной миграции данных |
| **Scope** | Supabase client + store selector + rewrite find/upsert + cutover |
| **Supabase** | Runtime-чтение/запись (schema уже готова) |
| **Migrations** | — |
| **Security/RLS** | Secret key server-only; без silent write fallback |
| **Data migration impact** | Runtime перестаёт писать в Directus JSON |
| **Файлы** | `product-page/lib/supabase/server.ts` (новый), `product-page/lib/cart/customers.ts`, `product-page/lib/cart/customer-store.ts` (новый, selector), `product-page/.env.example` |
| **НЕ входит** | Loyalty pricing fix; checkout schema changes; Directus order schema; cleanup fallback |

### Предусловия

- PHASE 1–3 PASS
- Secret key `sb_secret_...` создан в Dashboard
- Env: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CUSTOMER_STORE`

### Store selector

```
CUSTOMER_STORE=directus    # PHASE 0–3 (default до cutover)
CUSTOMER_STORE=supabase    # после PHASE 4 cutover
```

| Mode | READ | WRITE | При недоступности store |
|---|---|---|---|
| `directus` | Directus (collection → JSON) | Directus (как сейчас) | Текущее поведение |
| `supabase` | **Только Supabase** | **Только Supabase** | Логировать ошибку; write **не** уходит в Directus JSON |

**Silent WRITE fallback Supabase → Directus запрещён** (split-brain source of truth).

**READ fallback Supabase → Directus JSON:** не требуется, потому что PHASE 3 (data migration) выполняется **до** cutover. Если всё же нужна временная migration-compat мера — только явный флаг `CUSTOMER_READ_FALLBACK=directus`, read-only, удалить в PHASE 7. Без silent write.

### Adapter

- `createClient(SUPABASE_URL, SUPABASE_SECRET_KEY)` — server-only (`import 'server-only'`)
- `findCustomerByPhone`: `select ... eq('phone', canonical).maybeSingle()`
- `upsertCustomerByPhone`: upsert с `onConflict: 'phone'` и **явной merge-policy** (§2.3)
- Внешний интерфейс `findCustomerByPhone` / `upsertCustomerByPhone` / `isCustomerEligible` **без изменений** без необходимости
- `POST /api/customer-discount/check` — контракт не меняется

### API contract (сохраняется)

```
POST /api/customer-discount/check
Body:     { "phone": "+380..." }
Response: { "eligible": true,  "discount_percent": 5 }
       |  { "eligible": false, "discount_percent": 0 }
```

Не возвращать: customer id, full_name, legacy fields, source, любые PII.

### Тесты

- unit: `normalizeCustomerPhone`, merge-policy
- integration: find/upsert через Supabase
- API contract smoke: eligible / ineligible / invalid phone
- `tsc --noEmit`
- при `CUSTOMER_STORE=supabase` и недоступном Supabase — ошибка логируется, **нет** записи в Directus

### PASS criteria

- Cutover `CUSTOMER_STORE=supabase` выполнен после PASS PHASE 3
- API contract идентичен
- Write идёт только в Supabase; silent fallback отсутствует
- Merge-policy соблюдается (CRM-запись не перезаписана site-upsert)
- `tsc` pass

### Rollback

- `CUSTOMER_STORE=directus` (мгновенный откат runtime)
- Revert commit PHASE 4 при необходимости

### Что явно НЕ входит

- Loyalty discount calculation
- `expectedTotal` / checkout schema
- Directus order schema
- Удаление Directus JSON (архив остаётся до PHASE 7)
- Production deploy

---

## PHASE 5 — Authoritative Server-side Loyalty

| | |
|---|---|
| **Цель** | Сервер авторитетно пересчитывает loyalty и total; запрет silent price increase |
| **Scope** | Shared discount function + checkout re-validation + order audit fields |
| **Supabase** | `findCustomerByPhone` для re-check eligibility |
| **Migrations** | — (orders остаются в Directus) |
| **Security/RLS** | `discount_percent` не принимается из клиента |
| **Data migration impact** | Новые поля в Directus order (см. ниже) |
| **Файлы** | `product-page/lib/cart/loyalty-math.ts` (новый), `product-page/lib/cart/validation.ts`, `product-page/lib/cart/types.ts`, `product-page/app/actions/checkout.ts`, `product-page/components/cart/CartDrawer.tsx` |
| **НЕ входит** | Перенос orders в Supabase; PHASE 4 cutover (уже должен быть PASS); cleanup |

### Общая функция расчёта (единственный источник)

```ts
// lib/cart/loyalty-math.ts  — pure function, используется UI preview и server
export function calculateLoyaltyDiscount(input: {
  subtotal: number;
  quantityDiscount: number;
  discountPercent: number;   // server: 5 после eligibility; UI: из API response
}): { amount: number; discountedTotal: number }
// amount = trunc((subtotal - quantityDiscount) * percent / 100)
// discountedTotal = (subtotal - quantityDiscount) - amount   // === quote.total - amount
```

**Запрещено** дублировать формулу `trunc((subtotal - quantityDiscount) * 5 / 100)` на server-side отдельной реализацией. Client preview и server calculation используют одну функцию (расхождения rounding/truncation/порядка скидок).

### Checkout flow (authoritative)

```
Client показывает discounted total (через calculateLoyaltyDiscount)
    ↓
checkout: { items, expectedTotal=discounted, loyaltyPhone?, ... }
    ↓
Server:
  1. quote items → quote.total
  2. normalize loyaltyPhone; findCustomerByPhone (Supabase)
  3. discountPercent = eligible ? 5 : 0   // server-side, не из клиента
  4. { discountedTotal } = calculateLoyaltyDiscount({ quote..., discountPercent })
  5. authoritativeTotal = discountedTotal
  6. compare with expectedTotal
    ↓
  match      → create order с фактическим discount
  mismatch   → PRICE_CHANGED (или LOYALTY_CHANGED при изменении eligibility)
              + вернуть актуальный quote/total
              + UI обновляется
              + пользователь ПОВТОРНО подтверждает
```

### Запрет silent price increase

**Нельзя** показать клиенту `2136 ₴` и молча создать заказ на `2249 ₴`.

Если eligibility изменилась или `authoritativeTotal !== expectedTotal` — **никогда** не оформлять заказ по большей сумме. Всегда `PRICE_CHANGED` / `LOYALTY_CHANGED` + повторное подтверждение.

| Код | Когда |
|---|---|
| `PRICE_CHANGED` | quote (items/prices) изменился |
| `LOYALTY_CHANGED` | eligibility/сумма loyalty изменилась между cart и checkout |

Оба кода возвращают актуальный total; UI должен показать его и запросить повторное подтверждение.

### Loyalty phone vs customer phone

- Серверный re-check — истина
- Если `loyaltyPhone` != `customerPhone` — скидка не применяется (как и сейчас в UI), но сервер **тоже** это проверяет
- Никогда не доверять `discount_percent` / discount amount из клиента

### Order audit fields (Directus)

Расширить `carzo_orders` (или JSON metadata, если collection limit мешает) полями:

| Поле | Тип | Назначение |
|---|---|---|
| `loyalty_phone` | text, nullable | canonical phone, по которому применена скидка |
| `loyalty_discount_percent` | integer, nullable | 5 или null |
| `loyalty_discount_amount` | integer, nullable | сумма в копейках/грн (как `total`) |
| `loyalty_eligible` | boolean, nullable | факт eligibility на момент заказа |

Если Directus collections limit не позволяет новые поля — зафиксировать в `customer_comment` structured prefix или отдельном JSON-поле заказа; явно описать выбранный способ в отчёте PHASE 5.

### Тесты

- unit: `calculateLoyaltyDiscount` (rounding/truncation/edge)
- eligible → discounted total; ineligible → full total
- `expectedTotal` с tamper → `PRICE_CHANGED`
- eligibility изменилась между cart и checkout → `LOYALTY_CHANGED`, **без** silent order
- `loyaltyPhone` != `customerPhone` → без скидки
- race: два upsert одного телефона
- UI preview total === server authoritative total (при тех же входных)

### PASS criteria

- UI total === order.total === authoritative total
- Silent price increase невозможен
- Сервер отклоняет подмену `expectedTotal` и `discount_percent`
- Одна функция расчёта используется client + server
- Audit-поля скидки сохранены в заказе

### Rollback

- Revert commit PHASE 5 → возврат к текущему UI-only debt
- При этом PHASE 0–4 остаются; customers/loyalty lookup продолжает работать

### Что явно НЕ входит

- Перенос orders в Supabase
- Cleanup Directus fallback (PHASE 7)
- Production deploy

---

## PHASE 6 — E2E / Staging / Security Audit

| | |
|---|---|
| **Цель** | Полная проверка перед production |
| **Scope** | Тесты, staging QA, advisors |
| **Supabase** | Staging-данные; Security + Performance Advisor |
| **Migrations** | — |
| **Security/RLS** | Проверка deny для anon/authenticated; отсутствие PII в API |
| **Data migration impact** | — |
| **Файлы** | тесты (`customers` unit/integration), `test-checkout.py` (расширить) |
| **НЕ входит** | Production deploy (только после PASS этой фазы и явного разрешения) |

### Checklist (обязательно)

- [ ] phone normalization (valid / invalid / edge)
- [ ] known customer / unknown customer
- [ ] duplicate upsert
- [ ] concurrent / race upsert
- [ ] loyalty eligible / ineligible
- [ ] loyalty eligibility changed between cart and checkout → `LOYALTY_CHANGED`
- [ ] tampered `expectedTotal` → `PRICE_CHANGED`
- [ ] Supabase unavailable → error logged, **no** silent Directus write
- [ ] public API не выдаёт PII
- [ ] anon access запрещён
- [ ] authenticated access запрещён
- [ ] Security Advisor (0 WARN)
- [ ] Performance Advisor
- [ ] `pnpm exec tsc --noEmit`
- [ ] staging build (Vercel)
- [ ] staging checkout E2E
- [ ] mobile loyalty flow QA

### PASS criteria

- Все пункты checklist зелёные
- Нет PII в публичных ответах
- Advisors чистые
- Staging E2E пройден

### Rollback

Откат соответствующей PHASE (4 или 5) через revert / `CUSTOMER_STORE=directus`.

### Что явно НЕ входит

- Production deploy
- Новые фичи

---

## PHASE 7 — Cleanup

| | |
|---|---|
| **Цель** | Убрать transitional fallback; Supabase — единственный source of truth |
| **Scope** | Только после периода стабильной работы |
| **Supabase** | — |
| **Migrations** | — |
| **Security/RLS** | — |
| **Data migration impact** | Directus JSON остаётся как архив/backup |
| **Файлы** | `product-page/lib/cart/customers.ts`, `product-page/lib/cart/customer-store.ts` |
| **НЕ входит** | Удаление JSON-архива из Directus; перенос orders |

### Изменения

- Удалить runtime Directus customer fallback (read/write)
- Удалить `CUSTOMER_READ_FALLBACK`, если он использовался
- `CUSTOMER_STORE` зафиксировать как `supabase` (или убрать selector, если он больше не нужен)
- Directus JSON сохранить как архив/backup по migration strategy

### PASS criteria

- 7+ дней стабильной работы на Supabase (или явное решение о сокращении срока)
- Loyalty API регрессия зелёная
- Supabase — единственный source of truth для customers / loyalty eligibility

### Rollback

Вернуть fallback-код из git (tag/commit PHASE 4).

---

## 4. Архитектурные решения (сводно)

| # | Вопрос | Решение |
|---|---|---|
| 1 | RPC find/upsert | **Не использовать.** Server-side client + `ON CONFLICT (phone)`. RPC — позже только для multi-table atomic ops |
| 2 | Schema customers | `id uuid PK` + `phone UNIQUE` + metadata + CHECK canonical. Без `raw_phone`. Без лишних indexes |
| 3 | Нормализация телефона | **Комбинация:** app (`normalizeCustomerPhone`) + DB CHECK |
| 4 | UNIQUE canonical phone при race | `UNIQUE (phone)` + `INSERT ... ON CONFLICT DO UPDATE`. Никакого check-then-insert в write-path |
| 5 | RLS при server-only | **Да.** Deny-by-default для anon/authenticated; защита exposed `public`; defense-in-depth. **Не** «защита от утечки secret key» (elevated key bypass RLS) |
| 6 | GRANT/REVOKE | REVOKE ALL у `PUBLIC`/`anon`/`authenticated`; GRANT ALL `service_role`/`postgres`; default privileges |
| 7 | `rls_auto_enable()` | **Оставить**, взять под migrations (декларативно), REVOKE EXECUTE у public-ролей. Не удалять |
| 8 | Merge-policy | Явная. `source` = first appearance (immutable). Site upsert обновляет только `full_name` (если непустое) + `updated_at`. Никакого last-write-wins |
| 9 | Write fallback | **Запрещён.** `CUSTOMER_STORE` selector. При `supabase` — read/write только Supabase; ошибки логируются |
| 10 | Порядок | schema → **data migration** → validation → adapter → cutover |
| 11 | Loyalty price | **Никакого silent price increase.** `PRICE_CHANGED` / `LOYALTY_CHANGED` + повторное подтверждение |
| 12 | Discount formula | Одна pure `calculateLoyaltyDiscount` для UI preview и server |
| 13 | Keys | Modern `SUPABASE_SECRET_KEY` (`sb_secret_...`). Не legacy `service_role` без необходимости. Не `NEXT_PUBLIC_*` |
| 14 | Orders | **Остаются в Directus** |
| 15 | API contract | `POST /api/customer-discount/check` сохраняется; без PII в ответе |
| 16 | Source of truth | Customers → Supabase; остальное — Directus / R2 |

---

## 5. Риски

| # | Риск | Митигация |
|---|---|---|
| 1 | Schema drift (`rls_auto_enable` вне migrations) | PHASE 1 декларативная migration |
| 2 | Split-brain при silent write fallback | Запрет write fallback; `CUSTOMER_STORE` |
| 3 | Silent price increase | `PRICE_CHANGED` / `LOYALTY_CHANGED`; shared discount function |
| 4 | CRM-запись затирается site-upsert | Явная merge-policy; тест на non-overwrite |
| 5 | Secret key ещё не создан | Создать до PHASE 4; server-only env |
| 6 | Rate limit in-memory | Приемлемо для lookup; write-path — rely on UNIQUE |
| 7 | Phone edge cases | CHECK + unit-тесты normalize; import-отчёт invalid phones |
| 8 | Directus collections limit | Не блокер (customers в Supabase; order metadata fallback) |
| 9 | Local `next build` / ESLint hang | Vercel staging build как source of truth |
| 10 | Legacy keys deprecated end of 2026 | Modern keys с PHASE 4 |
| 11 | `carzo_group_notifications` удалена | Open item, вне scope |
| 12 | Premature indexes | Не создавать до query pattern |

---

## 6. Правила реализации

1. **Одна PHASE за раз.** Не выполнять изменения будущих фаз «заодно».
2. После PHASE N: отчёт агента → **независимая проверка фактического Supabase** → PASS / FIX → только затем PHASE N+1.
3. Никакого production deploy без явного разрешения.
4. Ничего не улалять (JSON-архив, Directus Files, R2 keys, seed, worktree docs).
5. Secret material — только в env / vault, никогда в git.
6. Каждый rollback-путь должен быть проверяемым **до** применения миграции.

---

*Конец плана v2. Реализация — только после явного согласования и разрешения на PHASE 0.*
