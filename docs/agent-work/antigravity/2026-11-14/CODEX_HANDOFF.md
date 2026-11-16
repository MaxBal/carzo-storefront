# CODEX HANDOFF — Antigravity (Argon High) → OpenAI Codex

- **Дата подготовки:** 16 ноября 2026 года
- **Базовый Pull Request Xiaomi:** [PR #4 (`fix/xiaomi-audit-2026-11-13` → `main`)](https://github.com/MaxBal/carzo-storefront/pull/4), HEAD `17cdb4efc5e4c5df536996001516f402694adadc`
- **Зависимый Pull Request доработок Antigravity:** [PR #5 (`fix/antigravity-xiaomi-review-followup` → `fix/xiaomi-audit-2026-11-13`)](https://github.com/MaxBal/carzo-storefront/pull/5)
- **Локальный worktree доработок Antigravity:** `/Users/qq/Documents/GitHub/carzo-antigravity-review-followup`

---

## 1. Git-архитектура и порядок ревью / слияния

1. Ветка `fix/antigravity-xiaomi-review-followup` ([PR #5](https://github.com/MaxBal/carzo-storefront/pull/5)) ответвлена от вершины ветки Xiaomi `origin/fix/xiaomi-audit-2026-11-13` (`17cdb4efc5e4c5df536996001516f402694adadc`), которая в свою очередь ответвлена от `origin/main` (`baf997e4359bfd41cdacf315ceefdc15ce956c82`).
2. Благодаря базе `base = fix/xiaomi-audit-2026-11-13`, в [PR #5](https://github.com/MaxBal/carzo-storefront/pull/5) отображается **только дельта изменений Antigravity** поверх PR #4 (без дублирования коммитов Xiaomi).
3. **Порядок слияния (только после одобрения владельцем):**
   - Сначала влить [PR #5](https://github.com/MaxBal/carzo-storefront/pull/5) в `fix/xiaomi-audit-2026-11-13` (тогда все доработки Antigravity войдут в состав [PR #4](https://github.com/MaxBal/carzo-storefront/pull/4)), а затем влить обновлённый [PR #4](https://github.com/MaxBal/carzo-storefront/pull/4) в `main`;
   - Либо проверить совокупный diff `origin/main..origin/fix/antigravity-xiaomi-review-followup` и влить его после ревью.

---

## 2. Полный список файлов, изменённых в PR №5 (`fix/antigravity-xiaomi-review-followup` относительно `17cdb4e`)

### Код и тесты (`product-page/`)

| Файл | Задача | Суть изменения |
| :--- | :---: | :--- |
| [`product-page/lib/cms/href.ts`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/lib/cms/href.ts) | `NEW-06` | Валидация `http:`/`https:` через WHATWG `new URL()` (требуется `^https?:\/\/`, непустой `hostname`, запрет `username`/`password`), запрет управляющих символов и пробелов, шаблоны `mailto:`/`tel:`, экспорт `isExternalHttpHref` |
| [`product-page/components/cms/PageRenderer.tsx`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/components/cms/PageRenderer.tsx) | `NEW-06` | Использование регистронезависимого `isExternalHttpHref(safeHref)` для `target="_blank" rel="noopener noreferrer"` и рендер `#`-якорей через `<a>` |
| [`product-page/tests/cms-href.test.ts`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/tests/cms-href.test.ts) | `NEW-06` | Расширение тест-сьюта с 22 до **59 unit-тестов** (верхний регистр схем, схемы без `//`, пустые хосты, учётные данные в URL, пробелы/control chars, битые `mailto:`/`tel:`) |
| [`product-page/lib/product-data.ts`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/lib/product-data.ts) | `NEW-10` | Выделение чистой детерминированной функции `buildProductJsonLd` и типов `ProductJsonLd`, `ProductJsonLdOffer`, `BuildProductJsonLdInput` |
| [`product-page/app/case/design/[...slug]/page.tsx`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/app/case/design/%5B...slug%5D/page.tsx) | `NEW-10` | Перевод генерации `productSchema` на чистую функцию `buildProductJsonLd` |
| [`product-page/components/ProductGallery.tsx`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/components/ProductGallery.tsx) | `C-11` | Добавление `shouldRenderMobileSlideImage` (отложенное монтирование слайдов `1..N-1` в мобильной карусели до первого касания/клика по точке, сокращающее стартовый трафик галереи на `375px` на `-151 КБ` / `-70.1%`), `priority={safeActive === 0}` на главном фото десктопа и явные `loading="lazy" decoding="async"` |
| [`product-page/tests/product-jsonld.test.ts`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/tests/product-jsonld.test.ts) | `NEW-10`, `C-11` | Новый модульный тест-сьют: 4 теста `buildProductJsonLd` (`/case/design/m/2-0`, `/case/design/m/2-0/bmw`, `canonical`, `offers.price`, fallback картинки) + 3 теста `shouldRenderMobileSlideImage` |
| [`product-page/tests/supabase-catalog-published-filter.test.ts`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/tests/supabase-catalog-published-filter.test.ts) | `C-07` | Добавлен хук `after()` для восстановления `globalThis.fetch` и `process.env.SUPABASE_*` |
| [`product-page/package.json`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/package.json) | `NEW-10`, `C-11` | В скрипт `test:audit-fixes` добавлен `tests/product-jsonld.test.ts` (итого 77 тестов в 8 сьютах) |

### Документация (`docs/agent-work/antigravity/2026-11-14/`)

- [`XIAOMI_INDEPENDENT_REVIEW.md`](./XIAOMI_INDEPENDENT_REVIEW.md)
- [`REMEDIATION_STATUS.md`](./REMEDIATION_STATUS.md)
- [`CHANGELOG.md`](./CHANGELOG.md)
- [`VERIFICATION.md`](./VERIFICATION.md)
- [`SUBAGENTS_REPORT.md`](./SUBAGENTS_REPORT.md)
- [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md)

---

## 3. Архитектурное обоснование по `NEW-10` и рекомендация для владельца / Codex

### 3.1. Почему в коде закреплён Вариант B (каноническая цена `2249 ₴` в JSON-LD)
- В текущей архитектуре CARZO (`AGENTS.md`, `lib/seo.ts:getPrimaryProductLinks`, `app/sitemap.ts`, `generateMetadata` в `app/case/design/[...slug]/page.tsx:22`) каноническими индексируемыми страницами являются **только базовые URL без бренда** (`/case/design/{size}/{design}`), а сегмент `/{brand}` (`/case/design/m/2-0/bmw`) канонизируется через `<link rel="canonical" href="/case/design/m/2-0">`.
- При наличии `<link rel="canonical" href="/case/design/m/2-0">` указание в JSON-LD на `/case/design/m/2-0/bmw` канонического `url: "https://carzo-storefront.vercel.app/case/design/m/2-0"` и цены `2249 UAH` является единственным внутренне непротиворечивым решением для органического поиска Google (Rich Results).

### 3.2. Когда потребуется бизнес-решение о переходе на Вариант A1 (для Google Merchant Center / Meta Catalog)
- На маршруте `/case/design/m/2-0/bmw` серверный рендер `ProductOptions.tsx` выводит в `<h1>` заголовок «Автокейс M Carzo 2.0 для BMW» и цену с логотипом **`2 539 ₴`** (`2249 + 290`).
- **Если рекламные фиды (Google Shopping / Merchant Center, Meta Dynamic Product Ads) будут вести только на базовые URL (`/case/design/m/2-0`, `2249 ₴`):** ничего менять не нужно — Вариант B полностью корректен.
- **Если же владелец решит выгружать в Google Merchant Center отдельные товарные позиции под каждую марку авто (`/case/design/m/2-0/bmw` с ценой `2539 ₴`):**
  1. По правилам Google Merchant Center посадочная страница товара из фида не должна иметь `<link rel="canonical">` на страницу с другой ценой — потребуется сделать брендированные URL самоканоническими (`canonical = buildProductUrl(productParams, catalog)`).
  2. В `buildProductJsonLd` потребуется передавать `brandExtra` и строить `name`, `url`, `offers.url` и `offers.price = variant.price + brandExtra` (`2539`) от брендированных `params`.

---

## 4. Итоги инструментальной проверки `C-11` и остаточные инфраструктурные задачи

1. **Что исправлено в коде (`ProductGallery.tsx`):**
   - На мобильном разрешении (`375px`) устранён преждевременный скач оффскрин-слайдов `02.webp` и `03.webp` (`-151 КБ` / `-70.1%` стартового объёма фото галереи активного товара, подтверждено реальным замером Playwright + Chrome).
2. **Что остаётся вне `ProductGallery.tsx` (требует отдельных задач):**
   - На `/catalog-carmat` файл `public/carmat-mobile.png` (`2.29 МБ`) скачивается на десктопе и мобайле — рекомендуется сконвертировать его в WebP (`~150–250 КБ`) и добавить `loading="lazy"`.
   - На планшете и десктопе (`768px` и `1440px`) все 4–5 миниатюр (`80×80px`) видны в первом экране и при `images.unoptimized: true` используют оригинальные файлы `01.webp`..`05.webp` (`~38–88 КБ` каждый, суммарно `~260–337 КБ`).
   - Двойное монтирование `<ProductGallery>` и `<ProductOptions>` в `ProductPageClient.tsx` (`NEW-05`) по условиям задания не перестраивалось.

---

## 5. Что именно должен перепроверить Codex перед финальным Merge

1. **Проверить чистый diff [PR #5](https://github.com/MaxBal/carzo-storefront/pull/5) (`origin/fix/xiaomi-audit-2026-11-13..origin/fix/antigravity-xiaomi-review-followup`) и совокупный diff с PR #4 (`origin/main..origin/fix/antigravity-xiaomi-review-followup`):**
   - Убедиться, что затронуты только целевые файлы `NEW-06`, `NEW-10`, `C-11`, `C-07`, `NEW-04`, `C-09`, `C-16` и документация `docs/agent-work/`.
   - Убедиться, что код корзины, расчёта цен, чекаута, Новой Почты, Telegram, keyCRM и миграций Supabase не изменялся.
2. **Запустить проверочные команды в `/Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page`:**
   ```bash
   pnpm exec tsc --noEmit
   pnpm run lint
   pnpm run test:audit-fixes
   ```
   Убедиться, что все **77 из 77** тестов в `test:audit-fixes` проходят успешно.
3. **Проверить безопасность `sanitizeCmsHref` (`product-page/lib/cms/href.ts`) и `CmsLink` (`product-page/components/cms/PageRenderer.tsx`):**
   - Убедиться, что `https:example.com`, `https://user:pass@evil.com`, управляющие символы и пробелы блокируются в `'#'`, а `HTTPS://example.com` получает `target="_blank" rel="noopener noreferrer"`.
4. **Проверить `buildProductJsonLd` (`product-page/lib/product-data.ts`) и `shouldRenderMobileSlideImage` (`product-page/components/ProductGallery.tsx`):**
   - Убедиться, что каноническая микроразметка `Product` консистентна, а отложенная подгрузка мобильных слайдов не нарушает работу свайпа и точек пагинации.
5. **Итоговый вердикт по готовности пакета (PR #4 + PR #5):**
   - С учётом доработок [PR #5](https://github.com/MaxBal/carzo-storefront/pull/5) первый пакет исправлений Xiaomi ([PR #4](https://github.com/MaxBal/carzo-storefront/pull/4)) полностью доведён до технически качественного состояния (**PASS по всем кодовым пунктам**) и готов к финальной приёмке владельцем.
