# Supabase Handoff — Carzo Storefront

**Дата handoff:** 2026-10-01  
**Назначение:** новый агент должен прочитать этот файл, сверить его с репозиторием/Supabase и только затем продолжать интеграцию Supabase.  
**Статус фиксации:** документ описывает текущее состояние; в рамках этой задачи код/schema не менялись.

---

## 1. Текущее состояние проекта

### Архитектура (кратко)

Next.js 14 App Router storefront **Carzo** (автокейсы + автокилимки). Контент и каталог — **Directus**. Медиа — **Cloudflare R2** (primary) → Directus File (fallback) → local `public/` (final fallback). Заказы создаются server action’ом в Directus (`carzo_orders` + `carzo_order_items`). Лояльность/скидка 5% — клиент lookup телефона + backend API.

### Стек

| Слой | Технология |
|---|---|
| Frontend | Next.js 14.2 (App Router), React 18, TypeScript, Tailwind + локальные CSS |
| Backend | Next.js Server Actions, Route Handlers (`app/api/*`) |
| CMS / commerce data | Directus 12 (Railway) |
| Media CDN | Cloudflare R2, public base `https://media.carzo.com.ua` |
| Delivery | Nova Poshta API |
| Notifications | Telegram bot (Directus settings) |
| Hosting | Vercel (`carzo-eight-staging` / prod project) |
| Package manager | pnpm |

### Основные директории

```
product-page/          — приложение Next.js (почти весь код)
  app/                 — routes, CSS, server actions
  components/          — UI (product, cart, modals, home)
  lib/content/         — Directus loaders, resolvers, types
  lib/cart/            — cart quote, pricing, loyalty, customers
  content/             — local seed JSON (fallback content)
  directus/            — schema.json snapshot, scripts (устаревший относительно live)
docs/                  — ADR, handoff (этот файл)
```

### Внешние сервисы

1. **Directus** — единственная CMS/DB на данный момент: designs, sizes, brands, variants, gallery, rich content, benefit modals, site settings, orders, notifications.  
2. **Cloudflare R2** — все медиа (product gallery, videos, covers, brand logos, page media, video reviews).  
3. **Nova Poshta** — города/отделения.  
4. **Telegram** — уведомления о заказах.  
5. **Vercel** — build/deploy staging.  
6. **Supabase** — **фактически не внедрён** (см. §7).

### Роль backend/API

- `app/actions/checkout.ts` — создание заказа в Directus + notify + upsert customer.  
- `app/api/customer-discount/check` — публичный lookup права на скидку.  
- `app/api/directus-assets/[id]` — proxy Directus files (fallback).  
- `app/api/nova-poshta/*` — delivery helpers.  
- `lib/cart/server.ts` — server-side price quote (variants + brand extra + fixation extra).

---

## 2. Что было сделано в рамках текущего чата

Ниже — **фактические** изменения (в рабочем дереве; см. §4). Supabase в этой сессии **не** внедрялся.

### A. R2 media migration (audit → data → frontend)

- **Audit** (`/tmp/carzo-media-audit-wt/docs/`): `R2_MEDIA_MIGRATION_AUDIT.md`, `r2-inventory.json`, `r2-media-mapping-manifest.json`, `R2_MIGRATION_EXECUTION_REPORT.md`, `R2_FINAL_STAGING_PASS.md`.  
- **Directus schema (live):** URL-спутники полей (частично уже были), `logo_placement_video(_url)`, `car_mat_promo_video/cover(_url)`, `homepage_logo_video(_url)`, `extra_by_size` на `carzo_fixations`.  
- **Directus data:** gallery 53 R2, rich images, magnetic covers, global videos, about/home/carmat, brands (+16), brand_pricing 290 ₴, fixation matrix, inside matrix S/M/LXL, unified variant prices S/M/L/XL.  
- **Frontend:** `resolveMediaUrl` URL→file→local; design selector thumbs; size-aware fixation extra; logo placement video; car-mats promo CMS; homepage hero/logo video; benefit modal «Гарантія 12 місяців»; video reviews block.

### B. Pricing / SALE

- Варианты: S 1790/2100, M 2249/2600, L 2590/2900, XL 2990/3400 (одинаково для всех designs).  
- Fixation `both`: `extra_by_size` s60/m80/l100/xl120.  
- Logo: +290 для всех брендов, `none` = 0.  
- SALE badge: `oldPrice - currentPrice` (уже было в UI).

### C. UI product page / home / modals

- Home mobile cards 16:9 case, mats 5/6, stats 22K/27 (Directus).  
- Benefit modals payment/delivery/returns/loyalty texts; warranty modal.  
- Fixation modal «Типи фіксації» + FAQ (2 новых).  
- Video reviews: `VideoReviewsSection`, overlay vertical player, Directus JSON `video_reviews`.  
- Tabs `Опис/Відгуки` на black Rich Content + sticky mobile `Купити` (после ухода static CTA).

### D. Loyalty / customers (ключевое для Supabase)

- **Удалён** hardcoded `TEST_LOYALTY_PHONE`.  
- Добавлены `lib/cart/customers.ts`, `app/api/customer-discount/check/route.ts`.  
- Checkout: `upsertCustomerByPhone` после успешного заказа.  
- Directus: **не удалось** создать collection `customers` (plan **collections limit**). Реестр сейчас в JSON `carzo_site_settings.customers`.

---

## 3. Изменённые файлы

### Modified (uncommitted)

| Файл | Что изменено |
|---|---|
| `product-page/lib/cart/loyalty.ts` | lookup через `/api/customer-discount/check`; убран test phone |
| `product-page/lib/cart/server.ts` | size-aware `fixationExtraForSize` |
| `product-page/lib/cart/*` (types/types consumers) | pricing/fixation extraBySize |
| `product-page/app/actions/checkout.ts` | `upsertCustomerByPhone` после заказа |
| `product-page/components/cart/CartDrawer.tsx` | сообщение ineligible; сброс loyalty при смене телефона |
| `product-page/lib/content/types.ts` | `extraBySize`, `designThumbnails`, `VideoReviewsData`, `warranty`, `placementVideo` |
| `product-page/lib/content/directus.ts` | media URL mapping, video_reviews, fixations, brands |
| `product-page/lib/content/resolver.ts` | thumbnails, placement video, size interpolation |
| `product-page/lib/content/default-source.ts` | fallbacks для новых полей |
| `product-page/lib/content/homepage.ts` | hero URL resolve, logo video, stats fallback |
| `product-page/lib/content/car-mat-designs.ts` | `getCarMatPromoMedia` |
| `product-page/lib/content/global-modals.ts` | sort benefit modals |
| `product-page/lib/product-data.ts` | `getFixationExtra` |
| `product-page/components/ProductOptions.tsx` | thumbs, fixation labels, sticky buy |
| `product-page/components/ProductRichContent.tsx` | `id=product-description`, tabs inside |
| `product-page/components/LogoModal.tsx` | placement video |
| `product-page/components/BenefitCards.tsx` | warranty icon |
| `product-page/components/BenefitModal.tsx` | accent `200 UAH` |
| `product-page/app/case/design/[...slug]/ProductPageClient.tsx` | VideoReviews after Rich Content |
| `product-page/app/catalog-carmat/*` | CMS promo video/cover |
| `product-page/app/homepage.css` | mobile product cards |
| `product-page/content/carzo-content.seed.json` | prices, fixation texts/FAQ, stats |

### Untracked (new)

| Файл | Назначение |
|---|---|
| `product-page/lib/cart/customers.ts` | normalize phone, find, universal upsert |
| `product-page/app/api/customer-discount/check/route.ts` | POST lookup eligibility + rate limit |
| `product-page/components/VideoReviewsSection.tsx` | блок відеовідгуків |
| `product-page/components/ProductSectionNav.tsx` | Опис / Відгуки |
| `product-page/components/MobileStickyBuy.tsx` | mobile sticky CTA |
| `product-page/app/video-reviews.css` | стили video reviews |
| `product-page/app/product-nav.css` | tabs + sticky CTA styles |

### Directus live (не в git)

Добавлены поля: video_reviews*, logo_placement_video*, car_mat_promo_*, homepage_logo_video*, extra_by_size, customers JSON, benefit warranty, prices/brands matrix. **Collection `customers` не создана** (лимит).

---

## 4. Текущее состояние Git

| Параметр | Значение |
|---|---|
| Main worktree | `/Users/qq/Documents/GitHub/carzo-storefront` |
| Branch | **`dev`** @ `872e505` (`fix: cart badge color #5ce4ab → #ca423d`) |
| Staged | нет |
| Uncommitted modified | **22 файла** (см. §3) |
| Untracked | **7 файлов** (customers.ts, API route, VideoReviews, nav, sticky, CSS) |
| Worktrees | `audit/r2-media-mapping` @ `/tmp/carzo-media-audit-wt` (docs audit); `feature/r2-media-migration` @ `/Users/qq/Documents/GitHub/carzo-storefront-r2-migration` |

**Есть незакоммиченные изменения — их нужно commit/push после review.** Ничего не откатывать и не удалять.

Последние коммиты (логика cart/checkout): cart badge color, loyalty focus hide, iOS auto-zoom, checkout form unification, **R2 external media URL support** (`1174c06`).

---

## 5. Customers / discount / loyalty (фокус для Supabase)

### Модель

1. Пользователь вводит телефон в блоке **«Знижка постійного клієнта»** (CartDrawer).  
2. `checkLoyaltyDiscount(phone)` → **POST `/api/customer-discount/check`**.  
3. Backend нормализует телефон и ищет клиента.  
4. Если найден → `{ eligible: true, discount_percent: 5 }`.  
5. **Существующая** логика CartDrawer считает `amount = (subtotal - quantityDiscount) * 5%` и показывает скидку.  
6. После успешного заказа — `upsertCustomerByPhone` (source=`site`, imported=`false`).

### Нормализация телефона

**Canonical:** `+380XXXXXXXXX` (9 цифр абонента).  
`lib/cart/customers.ts` → `normalizeCustomerPhone`.  
Примеры: `0666251560`, `380666251560`, `+380 66 625 15 60`, `+38 (066) 625-15-60` → `+380666251560`.

### Где данные

| Операция | Источник |
|---|---|
| Lookup eligible | **Primary try:** collection `customers` (если есть). **Fallback:** JSON `carzo_site_settings.customers[]` |
| Upsert after order | тот же helper `upsertCustomerByPhone` |
| Discount % | hardcoded **5%** (`LOYALTY_DISCOUNT_PERCENT`) — не менять без ТЗ |
| Eligible rule | **phone exists** → 5%. `legacy_*`, `source`, `imported` **не влияют** |

### API

`POST /api/customer-discount/check`  
Body: `{"phone":"..."}`  
Response: `{"eligible":bool,"discount_percent":0|5}`  
Rate limit: ~20 req/min/IP. **Не возвращает** PII.

### Legacy customers

В `carzo_site_settings.customers` (JSON) есть seed: тестовый `+380661031094` + строки legacy (`source` keycrm/wrike, `imported:true`, legacy_orders_count и т.д.). Полный bulk-import из CRM-таблицы **не выполнен**.

### Что переносить в Supabase

- таблица `customers` (phone UNIQUE, full_name, source, imported, legacy_*).  
- upsert/find по phone (universal helper).  
- возможно: re-check discount при checkout (сейчас expectedTotal = quote.total **без** вычета loyalty — см. риски).  
- webhook-ready upsert для CRM (`source` не ограничивать).

### Важная деталь заказа

`CartDrawer` **показывает** `quote.total - loyalty.amount`, но `createOrder` шлёт `expectedTotal: cart.quote.total` (без loyalty). То есть 5% сейчас **UI-level** в drawer; серверный total заказа — полный quote. Не ломать молча — зафиксировать как debt/риск (§10).

---

## 6. Directus

### Коллекции (используются)

`carzo_site_settings` (singleton), `carzo_media_settings`, `carzo_logo_settings`, `carzo_designs`, `carzo_sizes`, `carzo_brands`, `carzo_brand_pricing`, `carzo_variants`, `carzo_gallery_images`, `carzo_rich_sections`, `carzo_rich_section_images`, `carzo_content_sets`, `carzo_content_sections`, `carzo_faq_items`, `carzo_fixations`, `carzo_benefit_modals`, `carzo_discount_tiers`, `carzo_pages`, `carzo_page_blocks`, `carzo_orders`, `carzo_order_items`, `carzo_notification_settings`, `carzo_telegram_bot_settings`, `carzo_size_shipping`, plus legacy `carzo_logo_placements`, `carzo_rich_sections.image` (legacy).

### Что остаётся в Directus (ожидаемо)

Каталог, контент страниц, benefit modals, media settings, варианты цен, заказы (если не переносить orders в Supabase), notification settings.

### Что логично в Supabase

- **customers / loyalty eligibility** (main).  
- при желании: orders analytics, CRM sync, audit discount usage.  
- **Не** требуется переносить весь CMS-контент.

### Зависимости frontend → Directus

`lib/content/directus.ts`, `lib/cart/server.ts`, `app/actions/checkout.ts`, `lib/cart/customers.ts`, `lib/nova-poshta.ts` (косвенно).  
Env: `DIRECTUS_URL`, `DIRECTUS_READ_TOKEN` (server-only), `DIRECTUS_ADMIN_TOKEN` (только admin scripts).

### Ограничение

**Directus collections limit** — нельзя добавить `customers` collection. UI-группа `carzo_group_notifications` была удалена в попытке освободить слот и **не восстановлена** (лимит).

---

## 7. Supabase

### Факт

**Supabase в проекте практически не внедрён.**

| Пункт | Статус |
|---|---|
| Project | нет подтверждения / не настроен в app |
| Tables | нет |
| Migrations | нет |
| RLS | нет |
| Functions | нет |
| Supabase JS client | не используется в product-page |
| Auth | не используется |
| Env (`SUPABASE_*`) | не описаны в `.env.example` |

В MCP/окружении агента могут быть инструменты Supabase — это **не** означает, что схема приложения уже существует.

---

## 8. Целевая архитектура Supabase

### Уже реализовано (без Supabase)

- Loyalty lookup API + normalize + rate limit.  
- Universal upsert helper (Directus collection **или** JSON fallback).  
- Order success → register customer.  
- UI discount 5% unchanged.

### Предлагается сделать (не реализовано)

1. Supabase table `customers` (`phone` PK/unique, `full_name`, `source`, `imported`, `legacy_*`).  
2. RPC/SQL `find_customer_by_phone`, `upsert_customer_by_phone` (idempotent, safe on race).  
3. RLS: deny anon select; service role only (or authenticated service).  
4. Switch `lib/cart/customers.ts` to Supabase (keep interface).  
5. Migrate JSON registry + bulk legacy import (CSV/CRM).  
6. Optional: order-level loyalty re-validation server-side.  
7. Optional: Supabase for orders/telemetry — **не** смешивать с CMS.

---

## 9. Незавершённые задачи (TODO)

1. Зафиксировать/закоммитить текущее дерево (`dev`) после review.  
2. Аудит: есть ли уже Supabase project/credentials (env, dashboard).  
3. Спроектировать schema `customers` (+ индекс unique phone).  
4. Создать migrations (Supabase CLI / MCP).  
5. Настроить RLS + service-role access только на сервере.  
6. Перенести данные: JSON `customers` + полный legacy-список.  
7. Переключить `lib/cart/customers.ts` на Supabase, сохранив API контракт.  
8. Тесты: normalize, lookup, upsert race, checkout.  
9. Решить судьбу loyalty в `expectedTotal` (UI-only vs реальный discount в order total).  
10. Восстановить/починить Directus UI folder `carzo_group_notifications` (если нужен).  
11. (Опц.) добавить collection `customers` в Directus **или** окончательно зафиксировать Supabase как source of truth.  
12. Staging deploy + QA loyalty flow.  
13. Production deploy — **только** после подтверждения.

---

## 10. Известные проблемы и риски

| Риск | Описание |
|---|---|
| **Loyalty не в server total** | UI минусует 5%, `createOrder.expectedTotal = quote.total` без loyalty. Расхождение UI vs charge. |
| **Collection limit** | `customers` нет в Directus; JSON fallback; UNIQUE только в коде. |
| **Deleted UI group** | `carzo_group_notifications` удалена, не восстановлена. |
| **Local next build hang** | `jest-worker` зависает в этой среде; Vercel build зелёный. |
| **ESLint hang** | local `eslint`/`next lint` виснет; не подтверждён clean lint. |
| **Loyalty vs customerPhone** | скидка от `loyaltyPhone`, заказ от `customerPhone`; при расхождении UI сбрасывает, сервер не перепроверяет discount. |
| **Directus token** | только server-side; **никогда** `NEXT_PUBLIC_*`. |
| **Do not delete** | Directus Files (37) как fallback; R2 object keys; JSON `customers`; seed; worktree docs. |
| **Staging auth** | Vercel Deployment Protection — curl/browser без auth может давать 401. |
| **Phone edge cases** | экзотические форматы могут нормализоваться неверно; всегда валидировать. |

---

## 11. Проверки (фактические)

| Проверка | Результат |
|---|---|
| TypeScript `tsc --noEmit` | **PASS** (локально после последних правок loyalty) |
| ESLint | **не пройден** — зависает в среде |
| Local `next build` | **не пройден** — hang jest-worker |
| Vercel staging build | **PASS** (многократно, включая loyalty deploy) |
| R2 public URLs | **136/136 HTTP 200** (во время media migration) |
| Loyalty API | smoke: known phone eligible, unknown not — **прямой HTTP к staging не завершён** из-за auth/timeout; logic проверена скриптом против Directus JSON |
| Mobile/desktop visual QA | частично (по HTML/CSS), **не** полный браузерный прогон |
| Order flow / customer upsert e2e | **не выполнен** end-to-end |

---

## Next Agent Instructions

Выполнять **строго по порядку**. Ничего не удалять. Не пушить в production без явного разрешения.

1. **Прочитать этот файл** полностью.  
2. **Проверить репозиторий:**  
   `git status`, `git log -5`, наличие `product-page/lib/cart/customers.ts`, `app/api/customer-discount/check/route.ts`, uncommitted diff.  
3. **Проверить Supabase:** env (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` / anon), dashboard/MCP — есть ли project, таблицы, migrations.  
4. **Сверить** фактическое состояние с §5–§8; расхождения записать в handoff (append), не молча «чинить».  
5. **Только после сверки** приступать к работе: schema `customers` → RLS → перенос данных → switch `lib/cart/customers.ts` → тесты → staging.  
6. Сохранять контракт API `/api/customer-discount/check` и существующую 5% логику CartDrawer, если ТЗ не требует иного.  
7. Отдельно решить **loyalty в order total** (§10) до production.  
8. Перед merge: `tsc`, build на Vercel/staging, ручной QA loyalty + checkout.

---

*Конец handoff. Секреты (токены, API keys) в документ не включены.*
