# CHANGELOG — Antigravity Follow-up Package (16 ноября 2026)

Журнал изменений, выполненных агентом **Antigravity (Argon High)** в ветке `fix/antigravity-xiaomi-review-followup` ([PR #5](https://github.com/MaxBal/carzo-storefront/pull/5)) поверх базовой ветки Xiaomi `fix/xiaomi-audit-2026-11-13` ([PR #4](https://github.com/MaxBal/carzo-storefront/pull/4), `17cdb4efc5e4c5df536996001516f402694adadc`).

> Все результаты в этом журнале получены непосредственно Antigravity и не смешиваются с отчётами Xiaomi MiMo.

---

## 1. [2026-11-16] Организация изолированного Git worktree и ветки

- **Исходное состояние:**
  - `origin/main` = `baf997e4359bfd41cdacf315ceefdc15ce956c82`;
  - Локальный `main` в основном репозитории = `437f399187a79be4d22422252b3fe5fd4600792c` (опережает `origin/main` на 2 локальных коммита `f8e0e63` и `437f399`, не входящих в PR #4);
  - Ветка Xiaomi [PR #4](https://github.com/MaxBal/carzo-storefront/pull/4) (`origin/fix/xiaomi-audit-2026-11-13`) = `17cdb4efc5e4c5df536996001516f402694adadc`.
- **Действие:**
  - Создан отдельный Git worktree `/Users/qq/Documents/GitHub/carzo-antigravity-review-followup` на новой ветке `fix/antigravity-xiaomi-review-followup` от `origin/fix/xiaomi-audit-2026-11-13` (`17cdb4e`), чтобы не модифицировать ветку Xiaomi напрямую и чтобы зависимый [PR #5](https://github.com/MaxBal/carzo-storefront/pull/5) (`base = fix/xiaomi-audit-2026-11-13`) отображал только дельту изменений Antigravity.

---

## 2. [2026-11-16] `NEW-06` — Строгая валидация URL в `CmsLink` и `sanitizeCmsHref`

- **Исходная проблема:**
  1. В реализации Xiaomi (`lib/cms/href.ts:10`) регулярное выражение `/^(https?:|mailto:|tel:)/i.test(value)` проверяло только начало строки и пропускало:
     - схемы без двойного слэша (`https:example.com`, `http:alert(1)`, `http:/example.com`);
     - пустые хосты (`https://`, `http:///`);
     - ссылки с встроенными учётными данными (`https://user:pass@evil.com`, `https://carzo.ua@evil.com` — вектор фишинга);
     - внутренние пробелы и управляющие ASCII-символы (`https://example.com/foo bar`, `\n`, `\r`, `\t`, `\u0000`, `/path\u0000`, `#anchor with space`);
     - некорректные значения `mailto:` и `tel:` (`mailto:`, `mailto://evil.com`, `mailto:not-an-email`, `tel:`, `tel:abc`).
  2. В `components/cms/PageRenderer.tsx:39` проверка `safeHref.startsWith('http')` была регистрозависимой, из-за чего `HTTPS://example.com` рендерился без `target="_blank"`.
- **Обнаруженные доказательства:**
  - Построчный аудит `product-page/lib/cms/href.ts` (строки 7–14) и `product-page/components/cms/PageRenderer.tsx` (строки 32–42) субагентом `CMS Security Reviewer`.
- **Принятое решение:**
  - В [`product-page/lib/cms/href.ts`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/lib/cms/href.ts):
    - добавлено отклонение любых строк с обратным слэшем `\`, управляющими ASCII-символами и внутренними пробелами (`/[\u0000-\u001f\u007f\s]/`);
    - для `http:`/`https:` требуется строгий префикс `/^https?:\/\//i` и успешный разбор через WHATWG `new URL(value)` с проверкой `Boolean(parsed.hostname)` и отсутствия `parsed.username` / `parsed.password`;
    - для `mailto:` и `tel:` введены строгие шаблоны `MAILTO_PATTERN` и `TEL_PATTERN`;
    - для относительных путей `/...` добавлена проверка через `new URL(value, 'https://carzo.local')` с контролем неизменности `origin`;
    - экспортирован регистронезависимый хелпер `isExternalHttpHref(href)`.
  - В [`product-page/components/cms/PageRenderer.tsx`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/components/cms/PageRenderer.tsx):
    - `CmsLink` использует `isExternalHttpHref(safeHref)` для выставления `target="_blank" rel="noopener noreferrer"`;
    - якорные ссылки (`safeHref.startsWith('#')`) рендерятся через нативный `<a href={safeHref}>` вместо `next/link`.
- **Изменённые файлы:**
  - `product-page/lib/cms/href.ts`
  - `product-page/components/cms/PageRenderer.tsx`
  - `product-page/tests/cms-href.test.ts`
- **Результаты тестов:**
  - `pnpm run test:audit-fixes` → 59 тестов в `cms-href.test.ts` (19 разрешённых + 2 теста `isExternalHttpHref` + 38 запрещённых/битых URL) — **PASS (59/59)**.
- **Остаточные риски:** отсутствуют; внешний вид и верстка кнопок CMS не затрагивались.
- **Связь с PR №4 и PR №5:** дополняет коммит `48dcd13` из [PR #4](https://github.com/MaxBal/carzo-storefront/pull/4); зафиксировано в коммите `42bc5b6` в [PR #5](https://github.com/MaxBal/carzo-storefront/pull/5).

---

## 3. [2026-11-16] `NEW-10` — Выделение чистого билдера `buildProductJsonLd` и модульные тесты

- **Исходная проблема:**
  1. На брендированном маршруте `/case/design/m/2-0/bmw` видимая цена в главной карточке и кнопке «Купити» составляет `2 539 ₴` (`2249 ₴` база + `290 ₴` логотип BMW), тогда как `<link rel="canonical">` указывает на `/case/design/m/2-0` (базовая цена `2 249 ₴`).
  2. В PR #4 (`e07cf1e`) Xiaomi перевёл поля JSON-LD на канонические параметры (`brandId: 'none'`), но оставил генерацию JSON-LD инлайновой внутри серверного компонента `app/case/design/[...slug]/page.tsx` и **не добавил ни одного модульного теста**.
- **Обнаруженные доказательства:**
  - Трассировка `generateMetadata`, `Page`, `ProductOptions.tsx:160-170,235,333,396,441` и `lib/product-data.ts` субагентом `SEO & Structured Data Reviewer` + проверка живого SSR HTML через `curl` на локальной production-сборке.
- **Принятое решение:**
  - Сохранена стратегия **Варианта B** (каноническая базовая страница и её базовая цена `2249 ₴` в JSON-LD), поскольку в текущей архитектуре сайта (`AGENTS.md`, `sitemap.xml`, `<link rel="canonical">`) брендированные URL не являются самостоятельными каноническими страницами, а выбор бренда — клиентский параметр конфигуратора. Полное обоснование и условия, при которых владельцу может понадобиться Вариант A для прямых брендированных фидов Google Merchant Center, задокументированы в [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md).
  - В [`product-page/lib/product-data.ts`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/lib/product-data.ts) выделена чистая функция `buildProductJsonLd`, используемая в [`product-page/app/case/design/[...slug]/page.tsx`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/app/case/design/%5B...slug%5D/page.tsx).
  - Добавлен тест-сьют [`product-page/tests/product-jsonld.test.ts`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/tests/product-jsonld.test.ts) и подключён в `package.json` (`test:audit-fixes`).
- **Изменённые файлы:**
  - `product-page/lib/product-data.ts`
  - `product-page/app/case/design/[...slug]/page.tsx`
  - `product-page/tests/product-jsonld.test.ts`
  - `product-page/package.json`
- **Результаты тестов:**
  - 4 комплексных теста `NEW-10` в `tests/product-jsonld.test.ts` + проверка живого SSR JSON-LD на `/case/design/m/2-0` и `/case/design/m/2-0/bmw` — **PASS**.
- **Остаточные риски:** если в будущем платный трафик Google Merchant Center / Meta Catalog будет направляться напрямую на брендированные URL (`/case/design/m/2-0/bmw`) с ценой `2539 ₴` в фиде, потребуется бизнес-решение о самоканонизации брендированных URL и включении `logoExtra` в `offers.price` (Вариант A1).
- **Связь с PR №4 и PR №5:** расширяет и покрывает тестами коммит `e07cf1e` из [PR #4](https://github.com/MaxBal/carzo-storefront/pull/4); зафиксировано в коммите `99f93f3` в [PR #5](https://github.com/MaxBal/carzo-storefront/pull/5).

---

## 4. [2026-11-16] `C-11` — Браузерная проверка `ProductGallery` и отложенное монтирование мобильных слайдов

- **Исходная проблема:**
  - Требовалось инструментально (через реальный браузер Network / Playwright на разрешениях `375px`, `768px`, `1440px`) установить фактическое поведение загрузки изображений галереи карточки товара и устранить лишнюю загрузку непервичных изображений без перестройки `ProductPageClient.tsx` и без включения глобальной оптимизации Next.js Image.
- **Обнаруженные доказательства (Playwright + Headless Chrome на `/case/design/l/4-0`):**
  1. В БД Supabase (`public.gallery_images`) у каждого товара 4 или 5 фото (`4-0:L` имеет 5 фото `01.webp`..`05.webp` суммарным объёмом `337.3 КБ`). Отдельных URL для миниатюр нет (`src={image.src}`).
  2. На `375px` (мобайл) до исправления браузер при открытии страницы скачивал **3 из 5 фото галереи активного товара (`01.webp` 64.4 КБ + `02.webp` 63.2 КБ + `03.webp` 87.8 КБ = 215.4 КБ)**, хотя пользователю виден только первый слайд `01.webp`! Причина: все 5 слайдов сразу монтировались в горизонтальную flex-ленту (`ProductGallery.tsx:105-116`), и слайды `02.webp` (`x = 375px`) и `03.webp` (`x = 750px`) попадали в горизонтальный `rootMargin` (`LazyLoadImageObserver`) браузера Chromium.
  3. На `768px` и `1440px` все 5 миниатюр (`80×80px`) видны в первом экране левой колонки, поэтому браузер штатно загружает 5 фото галереи (по 1 запросу на уникальный URL, `duplicateRequestsWithinLoad: []`).
- **Принятое решение:**
  - В [`product-page/components/ProductGallery.tsx`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/components/ProductGallery.tsx):
    - добавлен хелпер `shouldRenderMobileSlideImage(index, activeIndex, hasInteracted)` и флаг `mobileInteracted` (включается на `onTouchStart`, `onPointerDown` и клике по точке пагинации, сбрасывается при смене `selectionKey`);
    - до первого взаимодействия пользователя с мобильной каруселью в DOM монтируется только первый слайд (`i === 0`), благодаря чему оффскрин-слайды `02.webp`..`05.webp` не скачиваются при открытии страницы на `375px`;
    - на главном фото десктопа выставлено `priority={safeActive === 0}`, а на миниатюрах и непервичных слайдах явно указаны `loading="lazy"` и `decoding="async"`.
- **Изменённые файлы:**
  - `product-page/components/ProductGallery.tsx`
  - `product-page/tests/product-jsonld.test.ts` (3 unit-теста `shouldRenderMobileSlideImage`)
- **Результаты тестов и замеров Playwright:**
  - Unit-тесты `shouldRenderMobileSlideImage` — **PASS (3/3)**.
  - Повторный замер Playwright на `375px` (`/case/design/l/4-0`): число запросов к картинкам страницы снизилось с **9 до 7**, стартовый объём скачиваемых картинок снизился с **446 163 байт (`435.7 КБ`) до 295 153 байт (`288.2 КБ`)** — экономия **151 010 байт (-70.1% трафика галереи активного дизайна)**, а число `<img>` в DOM уменьшилось с **39 до 31**.
- **Остаточные риски:** отсутствуют; при первом же касании (`onTouchStart` / `onPointerDown`) или нажатии на точку пагинации остальные слайды мгновенно монтируются.
- **Связь с PR №4 и PR №5:** закрывает диагностический пункт `C-11` из [PR #4](https://github.com/MaxBal/carzo-storefront/pull/4) реальным улучшением для мобильных устройств; зафиксировано в коммите `99f93f3` в [PR #5](https://github.com/MaxBal/carzo-storefront/pull/5).

---

## 5. [2026-11-16] `C-07` — Очистка глобального состояния в `supabase-catalog-published-filter.test.ts`

- **Исходная проблема:** в тесте `tests/supabase-catalog-published-filter.test.ts` (созданном Xiaomi в PR #4) переопределялись `globalThis.fetch` и `process.env.SUPABASE_*` в `before()` без восстановления в `after()`.
- **Принятое решение:** добавлен хук `after()`, восстанавливающий исходные `globalThis.fetch`, `process.env.SUPABASE_URL` и `process.env.SUPABASE_SECRET_KEY`.
- **Изменённые файлы:** `product-page/tests/supabase-catalog-published-filter.test.ts`.
- **Результаты тестов:** **PASS**.
