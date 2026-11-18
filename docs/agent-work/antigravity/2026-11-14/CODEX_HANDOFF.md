# CODEX HANDOFF — Полный пакет исправлений Antigravity (Argon High) → OpenAI Codex

- **Дата подготовки:** 16 ноября 2026 года
- **Репозиторий:** `MaxBal/carzo-storefront`
- **Базовый коммит Production (`origin/main`):** `baf997e4359bfd41cdacf315ceefdc15ce956c82`

---

## 1. Обзор всех подготовленных Pull Requests и их изоляции

Каждый пакет разработан в отдельном Git worktree, проверен изолированно и оформлен в собственный Pull Request без смешивания задач:

| Пакет | Pull Request | Ветка (`head` → `base`) | Исходный SHA → Конечный SHA |Локальный worktree |
| :--- | :--- | :--- | :--- | :--- |
| **Пакет Xiaomi (базовый)** | **[PR #4](https://github.com/MaxBal/carzo-storefront/pull/4)** | `fix/xiaomi-audit-2026-11-13` → `main` | `baf997e` → `17cdb4e` | `/Users/qq/Documents/GitHub/carzo-xiaomi-audit-2026-11-13` |
| **Пакет 0 (Доработка PR #4)** | **[PR #5](https://github.com/MaxBal/carzo-storefront/pull/5)** | `fix/antigravity-xiaomi-review-followup` → `fix/xiaomi-audit-2026-11-13` | `17cdb4e` → `afea094` | `/Users/qq/Documents/GitHub/carzo-antigravity-review-followup` |
| **Пакет A (`C-04 + C-05`)** | **[PR #6](https://github.com/MaxBal/carzo-storefront/pull/6)** | `fix/antigravity-checkout-reliability` → `main` | `baf997e` → `7ae4333` | `/Users/qq/Documents/GitHub/carzo-pkg-a-checkout` |
| **Пакет B (`NEW-01 + NEW-02 + NEW-07`)** | **[PR #7](https://github.com/MaxBal/carzo-storefront/pull/7)** | `fix/antigravity-nextjs-caching` → `main` | `baf997e` → `6f9d0fb` | `/Users/qq/Documents/GitHub/carzo-pkg-b-caching` |
| **Пакет C (`C-12 + C-08`)** | **[PR #8](https://github.com/MaxBal/carzo-storefront/pull/8)** | `fix/antigravity-integrations-hardening` → `main` | `baf997e` → `dd8aaa6` | `/Users/qq/Documents/GitHub/carzo-pkg-c-integrations` |

---

## 2. Паспорта каждого Pull Request для независимой проверки Codex

### 2.1. Пакет 0 — Доработка ревью Xiaomi ([PR #5](https://github.com/MaxBal/carzo-storefront/pull/5): `NEW-06`, `NEW-10`, `C-11`, `C-07`)

- **Зависимость:** открыт с базой `base = fix/xiaomi-audit-2026-11-13` ([PR #4](https://github.com/MaxBal/carzo-storefront/pull/4)), чтобы GitHub показывал только дельту Antigravity поверх PR #4.
- **Исходный SHA:** `17cdb4efc5e4c5df536996001516f402694adadc`
- **Конечный SHA:** `afea094`
- **Изменённые файлы кода и тестов (`9` файлов в `product-page/`):**
  - `product-page/lib/cms/href.ts` (`M`)
  - `product-page/components/cms/PageRenderer.tsx` (`M`)
  - `product-page/tests/cms-href.test.ts` (`M`)
  - `product-page/lib/product-data.ts` (`M`)
  - `product-page/app/case/design/[...slug]/page.tsx` (`M`)
  - `product-page/components/ProductGallery.tsx` (`M`)
  - `product-page/tests/product-jsonld.test.ts` (`A`)
  - `product-page/tests/supabase-catalog-published-filter.test.ts` (`M`)
  - `product-page/package.json` (`M`)
- **Команда независимой проверки для Codex:**
  ```bash
  cd /Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page
  git diff origin/fix/xiaomi-audit-2026-11-13..HEAD -- .
  pnpm exec tsc --noEmit && pnpm run lint && pnpm run test:audit-fixes
  ```
- **Что проверить Codex:**
  1. Валидацию URL через WHATWG `new URL()` в `lib/cms/href.ts` и `isExternalHttpHref` в `PageRenderer.tsx` (`59/59` тестов в `cms-href.test.ts`).
  2. Чистый билдер `buildProductJsonLd` в `lib/product-data.ts` и тесты `tests/product-jsonld.test.ts`.
  3. Отложенное монтирование мобильных слайдов `shouldRenderMobileSlideImage` в `ProductGallery.tsx` (`-151 КБ` / `-70.1%` стартового трафика галереи на `375px` по замерам Playwright).

---

### 2.2. Пакет A — Надёжность и идемпотентность чекаута ([PR #6](https://github.com/MaxBal/carzo-storefront/pull/6): `C-04 + C-05`)

- **Зависимость:** независимая ветка от `origin/main` (`baf997e4359bfd41cdacf315ceefdc15ce956c82`). Не пересекается по файлам с PR #4, PR #5, PR #7 и PR #8.
- **Исходный SHA:** `baf997e4359bfd41cdacf315ceefdc15ce956c82`
- **Конечный SHA:** `7ae4333e5958a2d53eb2eb0b6011d8242e8dc7aa`
- **Изменённые файлы (`7` файлов в `product-page/`):**
  - `product-page/lib/cart/checkout-attempt-client.ts` (`A`)
  - `product-page/lib/cart/checkout-attempt.ts` (`M`)
  - `product-page/app/actions/checkout.ts` (`M`)
  - `product-page/components/cart/cart-context.ts` (`M`)
  - `product-page/components/cart/CartProvider.tsx` (`M`)
  - `product-page/components/cart/CartDrawer.tsx` (`M`)
  - `product-page/tests/checkout-attempt.test.ts` (`M`)
- **Техническое решение:**
  - Персистентный стейт-автомат `createCheckoutAttemptTracker` (`localStorage` `carzo:checkout-attempt:v1`, состояния `idle` / `in_flight` / `uncertain`).
  - Автоматический перевод `in_flight -> uncertain` при перезагрузке страницы.
  - Запрет автоматической ротации `checkoutAttemptId` при изменении полей формы и сохранение `checkoutAttemptId` при `status === 'uncertain'` даже при изменении корзины, чтобы сервер сначала проверил через `findOrderByAttemptId` / `evaluateAttemptProbe`, не был ли заказ уже создан предыдущей попыткой.
  - Расширение `computeRequestFingerprint` полным адресом доставки (`BRANCH`/`POSTOMAT`: `cityRef`, `pointRef`; `COURIER`: `cityRef`, `streetRef`, `house`, `apartment`) и нормализованным `loyaltyPhone`.
- **Команда независимой проверки для Codex:**
  ```bash
  cd /Users/qq/Documents/GitHub/carzo-pkg-a-checkout/product-page
  git diff origin/main..HEAD
  pnpm exec tsc --noEmit && pnpm run lint && pnpm run test:stage6 && pnpm run test:checkout-reliability && pnpm run test:loyalty
  ```
- **Что проверить Codex:**
  1. Все 14 сценариев в `tests/checkout-attempt.test.ts` (`36/36 PASS` в `test:stage6`).
  2. Отсутствие любых изменений в логике отправки Telegram и keyCRM (`app/actions/checkout.ts`).

---

### 2.3. Пакет B — Производительность и раздельная стратегия кеширования ([PR #7](https://github.com/MaxBal/carzo-storefront/pull/7): `NEW-01 + NEW-02 + NEW-07`)

- **Зависимость:** независимая ветка от `origin/main` (`baf997e4359bfd41cdacf315ceefdc15ce956c82`).
  - *Примечание при финальном слиянии с PR #4:* оба PR (`PR #4` и `PR #7`) затрагивают `product-page/lib/data/catalog/supabase.ts` (`PR #4` меняет строку 87 `discount_tiers`, а `PR #7` добавляет передачу `cacheMode`). При слиянии в `selectAll('discount_tiers', ...)` должны остаться оба флага: `{ publishedOnly: true, cacheMode }`.
- **Исходный SHA:** `baf997e4359bfd41cdacf315ceefdc15ce956c82`
- **Конечный SHA:** `6f9d0fb04cb6ab2619d6140196e8c409c89df912`
- **Изменённые файлы (`10` файлов в `product-page/`):**
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
- **Техническое решение:**
  - `getSupabaseAdminClient()` (`lib/supabase/server.ts`) принудительно выставляет `cache: 'no-store'` на все запросы (`orders`, `customers`, `notification_settings`, дефолтный `loadCatalogData()` для чекаута и `/api/cart/quote`).
  - Публичные страницы (`getContentSource()` → `loadCatalogData({ cache: 'revalidate' })` + `getContentClient()` в `content/supabase.ts`) используют `next: { revalidate: 60, tags: [...] }` вне Draft Mode и `cache: 'no-store'` в Draft Mode.
  - В `lib/data/pages/supabase.ts` удалён конфликтующий `cache: 'force-cache'`, функции `React.cache` вынесены на уровень модуля, а `lib/data/pages/index.ts` дедуплицирует вызовы `getPublishedPage` и `getPublishedPageSummaries`.
- **Команда независимой проверки для Codex:**
  ```bash
  cd /Users/qq/Documents/GitHub/carzo-pkg-b-caching/product-page
  git diff origin/main..HEAD
  pnpm exec tsc --noEmit && pnpm run lint && pnpm run test:caching && pnpm run test:editorial-fallback && pnpm run test:stage4
  ```
- **Что проверить Codex:**
  1. Что `quoteCartItems()` (`lib/cart/server.ts:63`), `findOrderByAttemptId`, `findCustomerByPhone` всегда выполняются с `cache: 'no-store'`.
  2. Что при `next build` исчезают все 14 ошибок `Dynamic server usage: no-store fetch`, а `/`, `/about`, `/catalog-carmat`, `/sitemap.xml`, `/llms.txt` собираются как `○ (Static)`.

---

### 2.4. Пакет C — Защита API Новой Почты и вебхука keyCRM ([PR #8](https://github.com/MaxBal/carzo-storefront/pull/8): `C-12 + C-08`)

- **Зависимость:** независимая ветка от `origin/main` (`baf997e4359bfd41cdacf315ceefdc15ce956c82`).
- **Исходный SHA:** `baf997e4359bfd41cdacf315ceefdc15ce956c82`
- **Конечный SHA:** `dd8aaa666341483037a8e0e43902c78c87114749`
- **Изменённые файлы (`8` файлов в `product-page/`):**
  - `product-page/lib/nova-poshta.ts` (`M`)
  - `product-page/app/api/nova-poshta/cities/route.ts` (`M`)
  - `product-page/app/api/nova-poshta/points/route.ts` (`M`)
  - `product-page/app/api/nova-poshta/streets/route.ts` (`M`)
  - `product-page/lib/keycrm/webhook.ts` (`M`)
  - `product-page/app/api/keycrm/webhook/route.ts` (`M`)
  - `product-page/tests/integrations-hardening.test.ts` (`A`)
  - `product-page/package.json` (`M`)
- **Команда независимой проверки для Codex:**
  ```bash
  cd /Users/qq/Documents/GitHub/carzo-pkg-c-integrations/product-page
  git diff origin/main..HEAD
  pnpm exec tsc --noEmit && pnpm run lint && pnpm run test:integrations && pnpm run test:keycrm && pnpm run test:shipping
  ```
- **Что проверить Codex:**
  1. Таймаут `8 000 мс`, LRU/TTL-ограничение кеша (`500` записей), валидацию UUID и per-IP rate limit в `lib/nova-poshta.ts` и роутах `/api/nova-poshta/*`.
  2. Проверку секрета вебхука keyCRM (`verifyKeyCrmWebhookAuth` через `SHA-256` + `node:crypto` `timingSafeEqual`) **до** расхода квоты авторизованных запросов и **до** `request.json()`, а также 100% сохранение поддержки `?secret=...`.
