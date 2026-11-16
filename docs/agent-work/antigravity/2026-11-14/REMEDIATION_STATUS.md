# CARZO — Статус устранения замечаний (`REMEDIATION_STATUS`)

- **Дата обновления:** 16 ноября 2026 года
- **Пакет Xiaomi (базовый):** [PR #4 (`fix/xiaomi-audit-2026-11-13`)](https://github.com/MaxBal/carzo-storefront/pull/4) — HEAD `17cdb4efc5e4c5df536996001516f402694adadc`
- **Пакет доработок Antigravity:** [PR #5 (`fix/antigravity-xiaomi-review-followup`)](https://github.com/MaxBal/carzo-storefront/pull/5) → база `fix/xiaomi-audit-2026-11-13`

---

## 1. Статус задач первого пакета исправлений (PR #4 + PR #5)

| ID проблемы | Наименование | Статус в PR #4 (Xiaomi) | Статус в PR #5 (Antigravity) | Итоговый статус | Затронутые файлы кода и тестов |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **`C-07`** | Фильтрация `discount_tiers` по `status = 'published'` | Выполнено (`17cdb4e`) | Добавлен `after()`-хук очистки `globalThis.fetch` и `process.env` в тест | **READY FOR MERGE (PASS)** | `product-page/lib/data/catalog/supabase.ts`, `product-page/tests/supabase-catalog-published-filter.test.ts` |
| **`NEW-04`** | Добавление `/catalog-carmat` в `sitemap.xml` и `llms.txt` | Выполнено (`17cdb4e`) | Без изменений (подтверждено ревью) | **READY FOR MERGE (PASS)** | `product-page/app/sitemap.ts`, `product-page/app/llms.txt/route.ts` |
| **`C-09`** | Блокировка индексации Preview/Development через `VERCEL_ENV` | Выполнено (`17cdb4e`) | Без изменений (подтверждено ревью) | **READY FOR MERGE (PASS)** | `product-page/app/robots.ts`, `product-page/next.config.js`, `product-page/tests/robots-env.test.ts` |
| **`C-16`** | Базовые HTTP Security Headers (`nosniff`, `SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`, `CSP`) | Выполнено (`17cdb4e`) | Без изменений (подтверждено ревью) | **READY FOR MERGE (PASS)** | `product-page/next.config.js`, `product-page/tests/robots-env.test.ts` |
| **`NEW-06`** | Allowlist-санация ссылок в `CmsLink` (`sanitizeCmsHref`) | Выполнено частично (`17cdb4e`) | Доработано: WHATWG `new URL()`, запрет схем без `//`, запрет credentials/пробелов/control chars, регистронезависимый `isExternalHttpHref`, 59 тестов | **READY FOR MERGE (PASS)** | `product-page/lib/cms/href.ts`, `product-page/components/cms/PageRenderer.tsx`, `product-page/tests/cms-href.test.ts` |
| **`NEW-10`** | Согласование `Schema.org Product` (`JSON-LD`) с канонической страницей и покрытие тестами | Выполнено без тестов (`17cdb4e`) | Доработано: чистый билдер `buildProductJsonLd` в `lib/product-data.ts`, модульные тесты `tests/product-jsonld.test.ts`, анализ вариантов A/B/C | **READY FOR MERGE (PASS)** | `product-page/lib/product-data.ts`, `product-page/app/case/design/[...slug]/page.tsx`, `product-page/tests/product-jsonld.test.ts`, `product-page/package.json` |
| **`C-11`** | Диагностика и безопасная оптимизация загрузки фото галереи (`ProductGallery`) | Только `curl`-замеры (`17cdb4e`) | Выполнены реальные замеры Playwright (`375px`, `768px`, `1440px`) + внедрена отложенная подгрузка мобильных слайдов (`-151 КБ` на старте `375px`) и `priority={safeActive === 0}` | **READY FOR MERGE (PASS)** | `product-page/components/ProductGallery.tsx`, `product-page/tests/product-jsonld.test.ts` |
| **Vercel Audit** | Read-only аудит конфигурации и переменных окружения Vercel | Выполнено (документация) | Подтверждено и сверено с прямым аудитом Antigravity; список безопасных действий передан в `CODEX_HANDOFF.md` | **AWAITING OWNER / CODEX ACTION** | `docs/agent-work/antigravity/2026-11-14/CODEX_HANDOFF.md` |

---

## 2. Статус остальных задач из общего аудита (вне области PR #4 / PR #5)

| Группа задач | ID | Текущий статус | Примечание |
| :--- | :--- | :--- | :--- |
| **Юридические страницы** | `C-01` | **Устранено в БД Supabase** (`13.11.2026 15:51 UTC`) | Страницы `/privacy-policy` и `/public-offer` опубликованы и отдают `HTTP 200` (в `public.pages` осталась только тестовая запись `slug = 'home'`). |
| **Скриншоты отзывов** | `NEW-09` | **В очереди (ветка Xiaomi создана, но пуста)** | Локальный worktree `/Users/qq/Documents/GitHub/carzo-xiaomi-new-09` (`fix/xiaomi-new-09-screenshot-removal`) указывает на `17cdb4e`, коммитов и второго PR от Xiaomi пока нет. |
| **Кэширование, чекаут, БД, интеграции** | `NEW-01`, `NEW-02`, `C-04`, `C-05`, `C-08`, `C-10`, `C-12`, `C-13`, `C-14`, `NEW-05`, `NEW-07`, `NEW-08`, `NEW-11`, `NEW-12` | **Отложены для отдельного этапа разработки / Codex** | По условиям задания не затрагивались в PR #4 и PR #5. |
| **Отложены по решению владельца** | `C-02`, `C-03`, `C-06`, `NEW-03` | **Не выполняются сейчас** | Зафиксировано в ограничениях задачи. |
