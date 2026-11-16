# VERIFICATION — Antigravity Remediation Packages (16 ноября 2026)

Сводный протокол проверок, фактически выполненных агентом **Antigravity (Argon High)** по каждому изолированному Pull Request.

> Статус **PASS** проставлен исключительно по результатам реально выполненных прогонов в соответствующем Git worktree. Запись в Production Supabase, создание боевых заказов и деплой на рабочий сайт **не выполнялись**.

---

## 1. Сводная матрица верификации по Pull Requests

| Пакет / PR | Worktree | `tsc --noEmit` | `pnpm run lint` | Целевой тест-сьют пакета | Регрессионные unit-сьюты | `next build` (Production режим) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **[PR #5](https://github.com/MaxBal/carzo-storefront/pull/5)** (`NEW-06`, `NEW-10`, `C-11`, `C-07`) | `carzo-antigravity-review-followup` (`afea094`) | **PASS** | **PASS** | `test:audit-fixes` — **77/77 PASS** (8 сьютов) | 13 сьютов — **PASS** | **PASS** (`14/14` страниц) + Playwright Network (`375px`, `768px`, `1440px`) **PASS** |
| **[PR #6](https://github.com/MaxBal/carzo-storefront/pull/6)** — Пакет A (`C-04 + C-05`) | `carzo-pkg-a-checkout` (`7ae4333`) | **PASS** | **PASS** | `test:stage6` — **36/36 PASS** (включая все 14 сценариев чекаута) | `test:checkout-reliability` (12/12), `test:loyalty` (40/40), `test:payment` (16/16), `test:shipping` (41/41), `test:customer-store` (32/32), `test:keycrm` (64/64), `test:order-notifications` (39/39), `test:stage4` (19/19) — **PASS** | **PASS** (`14/14` страниц) |
| **[PR #7](https://github.com/MaxBal/carzo-storefront/pull/7)** — Пакет B (`NEW-01 + NEW-02 + NEW-07`) | `carzo-pkg-b-caching` (`6f9d0fb`) | **PASS** | **PASS** | `test:caching` — **4/4 PASS** | `test:editorial-fallback` (3/3), `test:stage4` (19/19), `test:stage6` (26/26), `test:loyalty` (40/40), `test:checkout-reliability` (12/12), `test:shipping` (41/41), `test:payment` (16/16), `test:keycrm` (64/64) — **PASS** | **PASS** (**0** ошибок `Dynamic server usage`, маршруты `/`, `/about`, `/catalog-carmat`, `/sitemap.xml`, `/llms.txt` → `○ Static`) |
| **[PR #8](https://github.com/MaxBal/carzo-storefront/pull/8)** — Пакет C (`C-12 + C-08`) | `carzo-pkg-c-integrations` (`dd8aaa6`) | **PASS** | **PASS** | `test:integrations` — **9/9 PASS** | `test:keycrm` (64/64), `test:shipping` (41/41), `test:loyalty` (40/40), `test:checkout-reliability` (12/12), `test:stage4` (19/19), `test:stage6` (26/26) — **PASS** | **PASS** (`14/14` страниц) |

---

## 2. Детализация проверок Пакета A ([PR #6](https://github.com/MaxBal/carzo-storefront/pull/6) — `C-04 + C-05`)

Команда: `pnpm run test:stage6` в `/Users/qq/Documents/GitHub/carzo-pkg-a-checkout/product-page` (`36/36 PASS`):

| № | Сценарий из ТЗ | Покрытие в `tests/checkout-attempt.test.ts` | Результат |
| :---: | :--- | :--- | :---: |
| 1 | Двойной клик | `Scenario 1: Double click — blocks concurrent second submit while first is in_flight` | **PASS** |
| 2 | Перезагрузка страницы | `Scenario 2: Page reload — preserves attemptId across reload and promotes in_flight to uncertain` | **PASS** |
| 3 | Потеря сетевого соединения | `Scenario 3 & 4: Network drop followed by retry of identical order reuses same attemptId and replays` | **PASS** |
| 4 | Повторная отправка идентичного заказа | `Scenario 3 & 4` + `is deterministic for identical intent` | **PASS** |
| 5 | Изменение отделения Новой почты | `Scenario 5: changes when Nova Poshta branch or postomat changes` + `Scenarios 5–9: Form edits never auto-rotate attemptId` | **PASS** |
| 6 | Изменение адреса курьерской доставки | `Scenario 6: changes when courier delivery address (city, street, house, apartment) changes` | **PASS** |
| 7 | Изменение телефона | `Scenario 7: changes when customer phone changes` | **PASS** |
| 8 | Добавление телефона лояльности | `Scenario 8: changes when loyalty phone is added, changed, or removed` | **PASS** |
| 9 | Изменение способа оплаты | `Scenario 9: changes when payment option changes` | **PASS** |
| 10 | Изменение состава корзины | `Scenario 10: changes when cart items or quantities change` + `Cart composition / quantity change rotates attemptId when idle, but preserves it when uncertain` | **PASS** |
| 11 | Успешный replay существующего заказа | `Scenario 11 & 12: evaluateAttemptProbe decides proceed, replay, or conflict` | **PASS** |
| 12 | Конфликт fingerprint | `Scenario 11 & 12` + `Scenario 12 & 13` (`ATTEMPT_REUSED`) | **PASS** |
| 13 | Неопределённый результат первого запроса | `Scenario 12 & 13: Uncertain outcome of first request — handles both committed and uncommitted server states safely` | **PASS** |
| 14 | Повторное открытие корзины после успешного заказа | `Scenario 14: Reopening cart after a successful order generates a brand-new checkoutAttemptId` | **PASS** |

---

## 3. Детализация проверок Пакета B ([PR #7](https://github.com/MaxBal/carzo-storefront/pull/7) — `NEW-01 + NEW-02 + NEW-07`)

1. **Модульные тесты (`pnpm run test:caching` — `4/4 PASS`):**
   - `NEW-02`: `getSupabaseAdminClient`, `findOrderByAttemptId`, `findCustomerByPhone` и дефолтный `loadCatalog()` строго передают `cache: 'no-store'` и `next: undefined`.
   - `NEW-01`: `loadCatalog({ cache: 'revalidate' })`, `loadSupabaseHomepageSettings()`, `loadSupabaseAboutSettings()` передают `next: { revalidate: 60, tags: [...] }` без `cache: 'no-store'`.
   - `NEW-07`: `getPublishedPage('privacy-policy')` передаёт `next: { revalidate: 60, tags: ['pages'] }` **без конфликтующего `cache: 'force-cache'`**, `getPreviewPage('page-1')` передаёт `cache: 'no-store'`, а `createSupabasePageRepository()` возвращает стабильный мемоизированный синглтон.
2. **Результат `next build` (в `/Users/qq/Documents/GitHub/carzo-pkg-b-caching/product-page`):**
   - Количество ошибок `Dynamic server usage: no-store fetch`: **`0`** (против `14` до исправления).
   - Таблица маршрутов `next build`:
     - `┌ ○ /` (`Static`)
     - `├ ○ /_not-found` (`Static`)
     - `├ ○ /about` (`Static`)
     - `├ ○ /catalog-carmat` (`Static`)
     - `├ ○ /llms.txt` (`Static`)
     - `└ ○ /sitemap.xml` (`Static`)
     - Все API-роуты корзины, скидок, вебхуков и Новой Почты остались `ƒ (Dynamic)`.

---

## 4. Детализация проверок Пакета C ([PR #8](https://github.com/MaxBal/carzo-storefront/pull/8) — `C-12 + C-08`)

Команда: `pnpm run test:integrations` в `/Users/qq/Documents/GitHub/carzo-pkg-c-integrations/product-page` (`9/9 PASS`):
- `C-12`:
  - обрыв зависшего запроса к Новой Почте по `timeoutMs` (`AbortController`) с чистой ошибкой `Nova Poshta request timed out`;
  - безопасная обработка не-JSON `502 Bad Gateway` без необработанного `SyntaxError`;
  - LRU-вытеснение и очистка по TTL в `Map`-кеше при превышении `maxCacheEntries`;
  - per-IP rate limiting (`isNovaPoshtaRateLimited`) и восстановление после истечения 60-секундного окна;
  - отклонение невалидных UUID (`not-a-uuid`) до выполнения сетевого запроса и сохранение fail-closed поведения `resolveNovaPoshtaPoint`.
- `C-08`:
  - константное по времени сравнение секретов разной длины через `SHA-256` дайджесты (`constantTimeSecretEquals`);
  - извлечение секрета из `?secret=...` (100% совместимость с действующим URL keyCRM) и заголовка `x-keycrm-secret`;
  - защита от блокировки легитимных вебхуков: после 35 неавторизованных запросов с неверным секретом и битым JSON (`401` → `429`) легитимный запрос с тем же IP и верным секретом успешно проходит (`HTTP 200`).
