# CARZO — Сводный статус устранения замечаний аудита (`REMEDIATION_STATUS`)

- **Дата обновления:** 16 ноября 2026 года
- **Репозиторий:** `MaxBal/carzo-storefront`
- **Базовый SHA Production (`origin/main`):** `baf997e4359bfd41cdacf315ceefdc15ce956c82`

---

## 1. Реестр открытых Pull Requests по итогам аудита

| PR | Ветка (`head` → `base`) | Исходный SHA → Конечный SHA | Охват задач | Статус готовности |
| :--- | :--- | :--- | :--- | :---: |
| **[PR #4](https://github.com/MaxBal/carzo-storefront/pull/4)** | `fix/xiaomi-audit-2026-11-13` → `main` | `baf997e` → `17cdb4e` | Пакет Xiaomi MiMo: `C-07`, `NEW-04`, `C-09`, `NEW-06` (базовый), `C-16`, `NEW-10` (базовый) | **READY (с учётом PR #5)** |
| **[PR #5](https://github.com/MaxBal/carzo-storefront/pull/5)** | `fix/antigravity-xiaomi-review-followup` → `fix/xiaomi-audit-2026-11-13` | `17cdb4e` → `afea094` | Доработка ревью Xiaomi (Antigravity): `NEW-06` (WHATWG URL), `NEW-10` (`buildProductJsonLd` + тесты), `C-11` (`ProductGallery` мобайл `-70.1%`), `C-07` (`after()` хук) | **READY FOR MERGE (PASS)** |
| **[PR #6](https://github.com/MaxBal/carzo-storefront/pull/6)** | `fix/antigravity-checkout-reliability` → `main` | `baf997e` → `7ae4333` | **Пакет A (`C-04 + C-05`):** персистентный стейт-автомат `checkoutAttemptId`, защита от дублей после перезагрузки и потери сети, полный `request_fingerprint` (доставка + `loyaltyPhone`), 14 сценариев тестов | **READY FOR MERGE (PASS)** |
| **[PR #7](https://github.com/MaxBal/carzo-storefront/pull/7)** | `fix/antigravity-nextjs-caching` → `main` | `baf997e` → `6f9d0fb` | **Пакет B (`NEW-01 + NEW-02 + NEW-07`):** раздельная стратегия кеширования (60s ISR для публичных страниц и контента, строгий `no-store` для `getSupabaseAdminClient` / чекаута / лояльности, фикс `force-cache` и `React.cache` в CMS pages) | **READY FOR MERGE (PASS)** |
| **[PR #8](https://github.com/MaxBal/carzo-storefront/pull/8)** | `fix/antigravity-integrations-hardening` → `main` | `baf997e` → `dd8aaa6` | **Пакет C (`C-12 + C-08`):** таймауты 8 с, LRU/TTL-ограничение кеша (500 ключей) и per-IP rate limit для Новой Почты; проверка секрета keyCRM через SHA-256 `timingSafeEqual` до расхода лимитов и парсинга JSON | **READY FOR MERGE (PASS)** |

---

## 2. Матрица статуса всех 28 задач аудита (`C-01`..`C-16`, `NEW-01`..`NEW-12`)

| ID | Приоритет | Описание проблемы | Статус | Где реализовано / Примечание |
| :--- | :---: | :--- | :---: | :--- |
| **`C-01`** | P1 | Юридические страницы `/privacy-policy` и `/public-offer` | **DONE (в БД)** | Опубликованы в Supabase `13.11.2026 15:51 UTC` (`HTTP 200`). В `public.pages` осталась тестовая запись `slug = 'home'`. |
| **`C-04`** | P1 | Дублирование заказов после перезагрузки страницы и потери ответа | **READY IN PR #6** | [PR #6](https://github.com/MaxBal/carzo-storefront/pull/6) (`fix/antigravity-checkout-reliability`, `7ae4333`) |
| **`C-05`** | P1 | Неполный `request_fingerprint` (без адреса доставки и `loyaltyPhone`) | **READY IN PR #6** | [PR #6](https://github.com/MaxBal/carzo-storefront/pull/6) (`fix/antigravity-checkout-reliability`, `7ae4333`) |
| **`NEW-01`** | P1 | Глобальный `cache: 'no-store'` в `content/supabase.ts` (`ƒ Dynamic` на всех страницах) | **READY IN PR #7** | [PR #7](https://github.com/MaxBal/carzo-storefront/pull/7) (`fix/antigravity-nextjs-caching`, `6f9d0fb`) |
| **`NEW-02`** | P1 | Отсутствие явного `cache: 'no-store'` в `getSupabaseAdminClient()` | **READY IN PR #7** | [PR #7](https://github.com/MaxBal/carzo-storefront/pull/7) (`fix/antigravity-nextjs-caching`, `6f9d0fb`) |
| **`NEW-07`** | P2 | Конфликт `force-cache` + `revalidate: 60` и неработающий `React.cache` в CMS pages | **READY IN PR #7** | [PR #7](https://github.com/MaxBal/carzo-storefront/pull/7) (`fix/antigravity-nextjs-caching`, `6f9d0fb`) |
| **`C-12`** | P2 | Отсутствие таймаутов, лимита памяти `Map`-кеша и rate limit в API Новой Почты | **READY IN PR #8** | [PR #8](https://github.com/MaxBal/carzo-storefront/pull/8) (`fix/antigravity-integrations-hardening`, `dd8aaa6`) |
| **`C-08`** | P2 | Rate limit до проверки секрета и утечка длины секрета в вебхуке keyCRM | **READY IN PR #8** | [PR #8](https://github.com/MaxBal/carzo-storefront/pull/8) (`fix/antigravity-integrations-hardening`, `dd8aaa6`) |
| **`C-07`** | P2 | Отсутствие фильтра `publishedOnly: true` для `discount_tiers` | **READY IN PR #4 + #5** | [PR #4](https://github.com/MaxBal/carzo-storefront/pull/4) + [PR #5](https://github.com/MaxBal/carzo-storefront/pull/5) |
| **`NEW-04`** | P2 | Отсутствие `/catalog-carmat` в `sitemap.xml` и `llms.txt` | **READY IN PR #4** | [PR #4](https://github.com/MaxBal/carzo-storefront/pull/4) (`17cdb4e`) |
| **`C-09`** | P2 | Детекция Preview/Development через `VERCEL_ENV` в `robots.ts` и `next.config.js` | **READY IN PR #4** | [PR #4](https://github.com/MaxBal/carzo-storefront/pull/4) (`17cdb4e`) |
| **`NEW-06`** | P2 | Строгая allowlist-санация ссылок в `CmsLink` (WHATWG `new URL()`) | **READY IN PR #4 + #5** | [PR #4](https://github.com/MaxBal/carzo-storefront/pull/4) + [PR #5](https://github.com/MaxBal/carzo-storefront/pull/5) (`afea094`) |
| **`C-16`** | P3 | Базовые HTTP Security Headers в `next.config.js` | **READY IN PR #4** | [PR #4](https://github.com/MaxBal/carzo-storefront/pull/4) (`17cdb4e`) |
| **`NEW-10`** | P3 | Каноническое согласование `Schema.org Product` (`JSON-LD`) и модульные тесты | **READY IN PR #4 + #5** | [PR #4](https://github.com/MaxBal/carzo-storefront/pull/4) + [PR #5](https://github.com/MaxBal/carzo-storefront/pull/5) (`afea094`) |
| **`C-11`** | P2 | Отложенная подгрузка непервичных слайдов мобильной галереи (`-70.1%` на `375px`) | **READY IN PR #5** | [PR #5](https://github.com/MaxBal/carzo-storefront/pull/5) (`afea094`). Сжатие `carmat-mobile.png` (`2.29 МБ`) требует решения по замене ассета. |
| **`C-02`, `C-03`, `C-06`, `NEW-03`, `NEW-05`** | P1/P2 | Заблокированы ограничениями владельца (не исправлять сейчас) | **DEFERRED BY OWNER** | Согласно разделу 7 ТЗ не затрагивались |
| **`C-10`, `C-13`, `C-14`, `C-15`, `NEW-08`, `NEW-09`, `NEW-11`, `NEW-12`** | P2/P3 | Миграции/привилегии БД Supabase, настройки Vercel env, аналитика, уборка репо | **PENDING NEXT STAGE** | Требуют операций в БД Supabase / панели Vercel или отдельного этапа (`NEW-09` в очереди у Xiaomi) |
