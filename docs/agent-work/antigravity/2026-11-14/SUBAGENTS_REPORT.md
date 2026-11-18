# SUBAGENTS REPORT — Antigravity (16 ноября 2026)

В ходе выполнения всех пакетов исправлений главный агент **Antigravity (Argon High)** использовал **6 специализированных READ-ONLY субагентов** (`invoke_subagent`, тип `research`) в двух волнах. Все субагенты работали строго в режиме чтения целевых файлов кода (без повторного перечитывания старых отчётов аудита и без права записи), а все изменения кода, тесты и сборки выполнялись главным агентом.

| Волна | Conversation ID | Роль субагента | Целевой пакет / задачи | Статус |
| :---: | :--- | :--- | :--- | :---: |
| 1 | `2b4af450-eddb-4d2d-943c-b113ae94a5b9` | **SEO & Structured Data Reviewer** | Пакет 0 ([PR #5](https://github.com/MaxBal/carzo-storefront/pull/5)) — `NEW-10` | **Завершён (READ-ONLY)** |
| 1 | `47682dff-cc8f-47d9-8543-7cc66ee42f46` | **CMS Security Reviewer** | Пакет 0 ([PR #5](https://github.com/MaxBal/carzo-storefront/pull/5)) — `NEW-06` | **Завершён (READ-ONLY)** |
| 1 | `c7b32eb3-d505-4dd2-bd86-9ec64d400b86` | **Media Performance Reviewer** | Пакет 0 ([PR #5](https://github.com/MaxBal/carzo-storefront/pull/5)) — `C-11` | **Завершён (READ-ONLY)** |
| 2 | `60559ee6-b5ac-4d23-bbb1-05ecadca9018` | **Checkout Reliability Researcher** | Пакет A ([PR #6](https://github.com/MaxBal/carzo-storefront/pull/6)) — `C-04 + C-05` | **Завершён (READ-ONLY)** |
| 2 | `28419b72-83a5-4748-be60-91bfbbaa0f5f` | **Next.js Caching Researcher** | Пакет B ([PR #7](https://github.com/MaxBal/carzo-storefront/pull/7)) — `NEW-01 + NEW-02 + NEW-07` | **Завершён (READ-ONLY)** |
| 2 | `ca552a35-7ef2-4c0c-a538-0d57f11b5ed8` | **Independent Tests & Regression Reviewer** | Пакет C ([PR #8](https://github.com/MaxBal/carzo-storefront/pull/8)) — `C-12 + C-08` | **Завершён (READ-ONLY)** |

---

## 1. Волна 1 — Доработка ревью Xiaomi ([PR #5](https://github.com/MaxBal/carzo-storefront/pull/5))

1. **`SEO & Structured Data Reviewer` (`2b4af450-eddb-4d2d-943c-b113ae94a5b9`):**
   - Провёл сравнение вариантов A, B и C для `NEW-10` (`/case/design/m/2-0` vs `/case/design/m/2-0/bmw`), доказал необходимость сохранения Варианта B при текущем `<link rel="canonical" href="/case/design/m/2-0">` и спроектировал чистую функцию `buildProductJsonLd` + unit-тесты.
2. **`CMS Security Reviewer` (`47682dff-cc8f-47d9-8543-7cc66ee42f46`):**
   - Выявил пропуск схем без `//` (`https:example.com`), embedded credentials (`https://user:pass@evil.com`), пробелов и управляющих символов в `lib/cms/href.ts`, а также регистрозависимость `safeHref.startsWith('http')` в `PageRenderer.tsx`. Спроектировал защиту через WHATWG `new URL()` и 59 тестов.
3. **`Media Performance Reviewer` (`c7b32eb3-d505-4dd2-bd86-9ec64d400b86`):**
   - Установил, что в `public.gallery_images` у товаров по 4–5 фото, `next/image` уже выставляет `loading="lazy"`, но на мобильном разрешении (`375px`) все слайды монтируются в горизонтальную flex-ленту и попадают в `rootMargin` Chromium `LazyLoadImageObserver`. Главный агент подтвердил это реальным замером Playwright + Chrome и внедрил `shouldRenderMobileSlideImage` (`-70.1%` стартового трафика галереи на `375px`).

---

## 2. Волна 2 — Пакеты A, B и C ([PR #6](https://github.com/MaxBal/carzo-storefront/pull/6), [PR #7](https://github.com/MaxBal/carzo-storefront/pull/7), [PR #8](https://github.com/MaxBal/carzo-storefront/pull/8))

4. **`Checkout Reliability Researcher` (`60559ee6-b5ac-4d23-bbb1-05ecadca9018` — Пакет A: `C-04 + C-05`):**
   - Изученные файлы: `CartProvider.tsx`, `CartDrawer.tsx`, `cart-context.ts`, `app/actions/checkout.ts`, `lib/cart/checkout-attempt.ts`, `lib/data/orders/supabase.ts`, `tests/checkout-*.test.ts`.
   - Выявил:
     - отсутствие персистентности `checkoutAttemptId` в `localStorage` при перезагрузке страницы;
     - пропуск `item.quantity` в `itemsSignature` (`CartProvider.tsx:110-113`), из-за чего смена количества не сбрасывала `attemptId` в состоянии `idle`;
     - отсутствие синхронного `submittingRef` в `CartDrawer.tsx` от двойного клика;
     - отсутствие `cityRef`, `pointRef`, `streetRef`, `house`, `apartment` и `loyaltyPhone` в `computeRequestFingerprint`.
   - Спроектировал персистентный стейт-автомат (`idle` / `in_flight` / `uncertain`), сохраняющий `attemptId` при неизвестном исходе предыдущей попытки.

5. **`Next.js Caching Researcher` (`28419b72-83a5-4748-be60-91bfbbaa0f5f` — Пакет B: `NEW-01 + NEW-02 + NEW-07`):**
   - Изученные файлы: `lib/supabase/server.ts`, `lib/data/content/{supabase,index}.ts`, `lib/data/catalog/{supabase,directus,index,types}.ts`, `lib/data/pages/{supabase,index}.ts`, `app/layout.tsx`, `app/page.tsx`, `app/[...slug]/page.tsx`.
   - Выявил цепочку, по которой `cache: 'no-store'` в `content/supabase.ts` через `RootLayout` (`getBenefitModals` / `getSiteFlag`) делал все маршруты динамическими (`ƒ`) и вызывал 14 ошибок `Dynamic server usage` при сборке, а также отсутствие `cache: 'no-store'` в `getSupabaseAdminClient()` и пересоздание репозитория страниц на каждый вызов в `lib/data/pages/index.ts`.
   - Спроектировал разделение `loadCatalogData()` (дефолт `'no-store'` для чекаута и корзины vs `{ cache: 'revalidate' }` для публичных страниц), `revalidate: 60` для контента с поддержкой `draftMode().isEnabled` и фикс `React.cache` для CMS-страниц.

6. **`Independent Tests & Regression Reviewer` (`ca552a35-7ef2-4c0c-a538-0d57f11b5ed8` — Пакет C: `C-12 + C-08`):**
   - Изученные файлы: `lib/nova-poshta.ts`, `app/api/nova-poshta/{cities,points,streets}/route.ts`, `lib/keycrm/webhook.ts`, `app/api/keycrm/webhook/route.ts`, `tests/keycrm-webhook.test.ts`, `tests/shipping-package.test.ts`.
   - Выявил отсутствие `AbortController` таймаута и границ `Map`-кеша в `lib/nova-poshta.ts`, необработанный `response.json()` при HTML `502/504`, а также уязвимость порядка операций в `app/api/keycrm/webhook/route.ts` (где `rateLimited(ip)` и `request.json()` выполнялись до проверки секрета) и утечку длины секрета в `timingSafeEqual`.
   - Спроектировал все исправления `C-12` и `C-08`, реализованные в [PR #8](https://github.com/MaxBal/carzo-storefront/pull/8).
