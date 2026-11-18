# CHANGELOG — Antigravity Remediation Packages (16 ноября 2026)

Журнал изменений, выполненных агентом **Antigravity (Argon High)**. Каждый пакет изолирован в собственном Git worktree, собственной ветке и собственном Pull Request. Результаты разных PR не смешиваются.

---

## ПАКЕТ 0 — Доработка ревью Xiaomi PR №4 (`NEW-06`, `NEW-10`, `C-11`, `C-07`)

- **Pull Request:** [PR #5](https://github.com/MaxBal/carzo-storefront/pull/5) (`fix/antigravity-xiaomi-review-followup` → база `fix/xiaomi-audit-2026-11-13`)
- **Worktree:** `/Users/qq/Documents/GitHub/carzo-antigravity-review-followup`
- **Исходный SHA (база):** `17cdb4efc5e4c5df536996001516f402694adadc` (HEAD [PR #4](https://github.com/MaxBal/carzo-storefront/pull/4))
- **Конечный SHA:** `afea094` (код: `42bc5b6`, `99f93f3`)
- **Изменённые файлы кода и тестов (`product-page/`):**
  - `product-page/lib/cms/href.ts` (`M`)
  - `product-page/components/cms/PageRenderer.tsx` (`M`)
  - `product-page/tests/cms-href.test.ts` (`M`)
  - `product-page/lib/product-data.ts` (`M`)
  - `product-page/app/case/design/[...slug]/page.tsx` (`M`)
  - `product-page/components/ProductGallery.tsx` (`M`)
  - `product-page/tests/product-jsonld.test.ts` (`A`)
  - `product-page/tests/supabase-catalog-published-filter.test.ts` (`M`)
  - `product-page/package.json` (`M`)
- **Технические решения:**
  1. **`NEW-06`:** валидация `http:`/`https:` через WHATWG `new URL()` (требуется `^https?:\/\/`, непустой `hostname`, запрет `username`/`password`), блокировка пробелов и управляющих ASCII-символов, строгие шаблоны `mailto:`/`tel:`, регистронезависимый `isExternalHttpHref` и рендер `#`-якорей через `<a>`. Расширено до 59 unit-тестов.
  2. **`NEW-10`:** выделена чистая функция `buildProductJsonLd` в `lib/product-data.ts`, подтверждена каноническая стратегия (Option B: `2249 ₴` в согласии с `<link rel="canonical">`), добавлен тест-сьют `tests/product-jsonld.test.ts`.
  3. **`C-11`:** реальным замером Playwright + Headless Chrome (`375px`, `768px`, `1440px`) установлено, что на `375px` мобайле Chromium преждевременно скачивал оффскрин-слайды `02.webp` и `03.webp` (`+151 КБ`). Внедрена функция `shouldRenderMobileSlideImage`, сократившая стартовый трафик галереи активного товара на `375px` на **70.1% (`-151 010 Б`)**, и `priority={safeActive === 0}` на главном фото десктопа.

---

## ПАКЕТ A — Надёжность и идемпотентность оформления заказов (`C-04 + C-05`)

- **Pull Request:** [PR #6](https://github.com/MaxBal/carzo-storefront/pull/6) (`fix/antigravity-checkout-reliability` → база `main`)
- **Worktree:** `/Users/qq/Documents/GitHub/carzo-pkg-a-checkout`
- **Исходный SHA (`origin/main`):** `baf997e4359bfd41cdacf315ceefdc15ce956c82`
- **Конечный SHA:** `7ae4333` (`7ae4333e5958a2d53eb2eb0b6011d8242e8dc7aa`)
- **Изменённые файлы (`product-page/`):**
  - `product-page/lib/cart/checkout-attempt-client.ts` (`A`)
  - `product-page/lib/cart/checkout-attempt.ts` (`M`)
  - `product-page/app/actions/checkout.ts` (`M`)
  - `product-page/components/cart/cart-context.ts` (`M`)
  - `product-page/components/cart/CartProvider.tsx` (`M`)
  - `product-page/components/cart/CartDrawer.tsx` (`M`)
  - `product-page/tests/checkout-attempt.test.ts` (`M`)
- **Описание проблемы:**
  1. `checkoutAttemptId` хранился только в памяти (`useRef`), терялся при перезагрузке страницы (в то время как корзина сохранялась в `localStorage`), а `itemsSignature` не учитывал `quantity`.
  2. `computeRequestFingerprint` не включал адрес доставки (`cityRef`, `pointRef`/`warehouseRef`, `streetRef`, `house`, `apartment`) и `loyaltyPhone`, из-за чего при ретрае с изменённым адресом или телефоном лояльности сервер ошибочно считал запрос идентичным старому заказу.
- **Техническое решение:**
  1. В `lib/cart/checkout-attempt-client.ts` реализован детерминированный стейт-автомат `createCheckoutAttemptTracker` с персистентностью в `localStorage` (`carzo:checkout-attempt:v1`, TTL 24 ч) и состояниями `'idle' | 'in_flight' | 'uncertain'`.
  2. При перезагрузке страницы во время `'in_flight'` состояние автоматически переводится в `'uncertain'` с сохранением `attemptId`.
  3. Правки полей формы никогда не ротируют `attemptId` автоматически; при состоянии `'uncertain'` даже изменение корзины сохраняет `attemptId` до первой проверки сервером (`findOrderByAttemptId` + `evaluateAttemptProbe`), исключая создание дубликата заказа после сетевого сбоя.
  4. В `lib/cart/checkout-attempt.ts` и `app/actions/checkout.ts` `computeRequestFingerprint` расширен полным адресом доставки (`BRANCH`/`POSTOMAT`/`COURIER`) и нормализованным `loyaltyPhone`.
- **Новые тесты:** `tests/checkout-attempt.test.ts` расширен до 19 тестов, покрывающих все **14 обязательных сценариев** (`pnpm run test:stage6` — **36/36 PASS**).
- **Остаточные риски:** отсутствуют; логика Telegram, keyCRM и схема БД не изменялись.

---

## ПАКЕТ B — Производительность сайта и раздельная стратегия кеширования (`NEW-01 + NEW-02 + NEW-07`)

- **Pull Request:** [PR #7](https://github.com/MaxBal/carzo-storefront/pull/7) (`fix/antigravity-nextjs-caching` → база `main`)
- **Worktree:** `/Users/qq/Documents/GitHub/carzo-pkg-b-caching`
- **Исходный SHA (`origin/main`):** `baf997e4359bfd41cdacf315ceefdc15ce956c82`
- **Конечный SHA:** `6f9d0fb` (`6f9d0fb04cb6ab2619d6140196e8c409c89df912`)
- **Изменённые файлы (`product-page/`):**
  - `product-page/lib/supabase/server.ts` (`M`)
  - `product-page/lib/data/catalog/types.ts` (`M`)
  - `product-page/lib/data/catalog/index.ts` (`M`)
  - `product-page/lib/data/catalog/supabase.ts` (`M`)
  - `product-page/lib/data/content/supabase.ts` (`M`)
  - `product-page/lib/data/content/index.ts` (`M`)
  - `product-page/lib/data/pages/supabase.ts` (`M`)
  - `product-page/lib/data/pages/index.ts` (`M`)
  - `product-page/tests/caching-strategy.test.ts` (`A`)
  - `product-page/package.json` (`M`)
- **Описание проблемы:**
  1. `lib/data/content/supabase.ts` принудительно выставлял `cache: 'no-store'` на все запросы контента (включая `RootLayout`), из-за чего все страницы сайта рендерились как `ƒ (Dynamic)`, а `next build` логировал 14 ошибок `Dynamic server usage: no-store fetch`.
  2. `getSupabaseAdminClient()` в `lib/supabase/server.ts` не задавал политику `cache`, создавая риск кеширования проверок заказов/лояльности.
  3. В `lib/data/pages/supabase.ts` одновременно передавались конфликтующие `cache: 'force-cache'` и `next: { revalidate: 60 }`, а `lib/data/pages/index.ts` создавал новый объект репозитория на каждый вызов, ломая дедупликацию `React.cache`.
- **Техническое решение:**
  1. **`NEW-02`:** в `createSupabaseAdminClient()` (`lib/supabase/server.ts`) принудительно задан `cache: 'no-store'`. Дефолтный режим `loadCatalogData()` оставлен `'no-store'`, поэтому `quoteCartItems()`, `/api/cart/quote`, `app/actions/checkout.ts`, `orders`, `customers` и `notification_settings` никогда не кешируются.
  2. **`NEW-01`:** в `getContentClient()` (`lib/data/content/supabase.ts`) и в режиме `loadCatalogData({ cache: 'revalidate' })` (вызываемом из `getContentSource()` для публичных страниц) включено контролируемое ISR-обновление `next: { revalidate: 60, tags: [...] }` с автоматическим переключением на `cache: 'no-store'` при активном `draftMode().isEnabled`.
  3. **`NEW-07`:** из `getCachedPageClient()` удалён конфликтующий `cache: 'force-cache'`, добавлен учёт `draftMode().isEnabled`, а функции `getPublishedPage` и `getPublishedPageSummaries` мемоизированы через `React.cache` на уровне модуля.
- **Новые тесты:** `tests/caching-strategy.test.ts` (`pnpm run test:caching` — **4/4 PASS**); при `next build` 0 ошибок `Dynamic server usage`, публичные маршруты `/`, `/about`, `/catalog-carmat`, `/sitemap.xml`, `/llms.txt` собираются как `○ (Static / ISR)`.

---

## ПАКЕТ C — Отказоустойчивость Новой Почты и защита вебхука keyCRM (`C-12 + C-08`)

- **Pull Request:** [PR #8](https://github.com/MaxBal/carzo-storefront/pull/8) (`fix/antigravity-integrations-hardening` → база `main`)
- **Worktree:** `/Users/qq/Documents/GitHub/carzo-pkg-c-integrations`
- **Исходный SHA (`origin/main`):** `baf997e4359bfd41cdacf315ceefdc15ce956c82`
- **Конечный SHA:** `dd8aaa6` (`dd8aaa666341483037a8e0e43902c78c87114749`)
- **Изменённые файлы (`product-page/`):**
  - `product-page/lib/nova-poshta.ts` (`M`)
  - `product-page/app/api/nova-poshta/cities/route.ts` (`M`)
  - `product-page/app/api/nova-poshta/points/route.ts` (`M`)
  - `product-page/app/api/nova-poshta/streets/route.ts` (`M`)
  - `product-page/lib/keycrm/webhook.ts` (`M`)
  - `product-page/app/api/keycrm/webhook/route.ts` (`M`)
  - `product-page/tests/integrations-hardening.test.ts` (`A`)
  - `product-page/package.json` (`M`)
- **Описание проблемы:**
  1. **`C-12`:** запросы к API Новой Почты не имели таймаута, in-memory `Map`-кеш не имел ограничения по размеру и не удалял устаревшие ключи, а 3 публичных роута `/api/nova-poshta/*` не имели rate limit.
  2. **`C-08`:** роут `/api/keycrm/webhook` расходовал общий лимит `rateLimited(ip)` и вызывал `request.json()` **до** проверки секрета вебхука (позволяя внешнему флуду заблокировать легитимные вебхуки keyCRM `HTTP 429`), а само сравнение секрета возвращало `false` по `left.length !== right.length` (утечка длины секрета).
- **Техническое решение:**
  1. **`C-12`:** в `lib/nova-poshta.ts` добавлены таймаут `8 000 мс` через `AbortController`, ограничение кеша до `500` записей с очисткой просроченных и LRU-вытеснением, проверка UUID до сетевого вызова, безопасный парсинг не-JSON ошибок шлюза и per-IP rate limiter (`60` запросов / мин) на всех 3 роутах `/api/nova-poshta/*`.
  2. **`C-08`:** в `lib/keycrm/webhook.ts` и `app/api/keycrm/webhook/route.ts` проверка секрета (`verifyKeyCrmWebhookAuth`) вынесена в самое начало обработчика (до расхода лимита авторизованных вебхуков и до `request.json()`), сравнение секретов переведено на `SHA-256` дайджесты + `node:crypto` `timingSafeEqual`, а неавторизованные запросы учитываются в изолированном бакете `isKeyCrmUnauthorizedFlood`. Полностью сохранена совместимость с действующим URL `?secret=...`.
- **Новые тесты:** `tests/integrations-hardening.test.ts` (`pnpm run test:integrations` — **9/9 PASS**).
