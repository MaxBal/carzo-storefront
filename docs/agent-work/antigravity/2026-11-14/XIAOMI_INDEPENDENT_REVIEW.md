# CARZO — Независимое техническое ревью Xiaomi PR №4 и статус доработки (`XIAOMI_INDEPENDENT_REVIEW`)

- **Дата проведения ревью и доработки:** 16 ноября 2026 года
- **Исполнитель:** Antigravity (Argon High) + 3 специализированных READ-ONLY субагента (`SEO & Structured Data Reviewer`, `CMS Security Reviewer`, `Media Performance Reviewer`)
- **Базовый проверяемый Pull Request Xiaomi:** [PR #4 — `fix: audit remediation package 2026-11-13 (Xiaomi MiMo)`](https://github.com/MaxBal/carzo-storefront/pull/4) (`fix/xiaomi-audit-2026-11-13`, HEAD `17cdb4efc5e4c5df536996001516f402694adadc`)
- **Зависимый Pull Request доработок Antigravity:** [PR #5 — `fix: followup remediation for Xiaomi PR #4 review (NEW-06, NEW-10, C-11)`](https://github.com/MaxBal/carzo-storefront/pull/5) (`fix/antigravity-xiaomi-review-followup` → база `fix/xiaomi-audit-2026-11-13`)

---

## 1. Контекст и связь PR №4 и PR №5

1. Агент **Xiaomi MiMo** подготовил в [PR #4](https://github.com/MaxBal/carzo-storefront/pull/4) (`fix/xiaomi-audit-2026-11-13`, ответвлён от `origin/main` `baf997e4359bfd41cdacf315ceefdc15ce956c82`) первый пакет безопасных исправлений по итогам технического аудита Antigravity от 13.11.2026: `C-07`, `NEW-04`, `C-09`, `NEW-06`, `C-16`, `NEW-10` и диагностику `C-11` / Vercel.
2. Независимое инженерное ревью Antigravity подтвердило корректность `C-07`, `NEW-04`, `C-09` и `C-16`, но выявило ряд технических недочётов и пробелов в тестировании по `NEW-06`, `NEW-10`, `C-11` и `C-07` (тестовая гигиена).
3. В рамках данного пакета ([PR #5](https://github.com/MaxBal/carzo-storefront/pull/5), ветка `fix/antigravity-xiaomi-review-followup`, созданная в отдельном worktree `/Users/qq/Documents/GitHub/carzo-antigravity-review-followup` поверх `17cdb4e`) все выявленные кодовые и тестовые недочёты устранены без изменения ветки Xiaomi напрямую и без дублирования диффа Xiaomi против `main`.

---

## 2. Итоговая матрица ревью PR №4 до и после доработки в PR №5

| Пункт / ID | Описание | Статус в PR #4 (`17cdb4e`) | Статус с учётом PR #5 | Инженерное резюме |
| :--- | :--- | :---: | :---: | :--- |
| **Изоляция Git diff** | Отсутствие секретов, `.env*`, PII, чужих коммитов и правок чекаута | **PASS** | **PASS** | Ветка `fix/xiaomi-audit-2026-11-13` ответвлена от `origin/main` (`baf997e`), а `fix/antigravity-xiaomi-review-followup` — от `17cdb4e` (показывает в PR #5 только дельту Antigravity). |
| **`C-07`** | Фильтр `publishedOnly: true` для `discount_tiers` + unit-тест | **PASS** | **PASS** | В `lib/data/catalog/supabase.ts:87` добавлен `{ publishedOnly: true }`. В PR #5 в тест `supabase-catalog-published-filter.test.ts` добавлен хук `after()` для восстановления `globalThis.fetch` и `process.env`. |
| **`NEW-04`** | Добавление `/catalog-carmat` в `sitemap.xml` и `llms.txt` | **PASS** | **PASS** | Маршрут `/catalog-carmat` присутствует в `sitemap.xml` (`weekly`, `0.8`, без дублей) и в `llms.txt`. |
| **`C-09`** | Защита Preview/Development от индексации через `VERCEL_ENV` | **PASS** | **PASS** | `isNonProduction` закрывает `preview` и `development` в `app/robots.ts` и `next.config.js`, сохраняя legacy-проверку `includes('staging')`. |
| **`C-16`** | Базовые HTTP Security Headers в `next.config.js` | **PASS** | **PASS** | Добавлены `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy` и базовый `CSP` (`frame-ancestors 'self'; base-uri 'self'; object-src 'none'`). |
| **`NEW-06`** | Allowlist-санация ссылок в `CmsLink` (`lib/cms/href.ts`, `PageRenderer.tsx`) | **PASS (с замечаниями)** | **PASS** | В PR #4 пропускались `https:example.com` (без `//`), `https://user:pass@evil.com`, внутренние пробелы/управляющие символы, а `HTTPS://...` терял `target="_blank"`. В PR #5 внедрена проверка через WHATWG `new URL()`, строгий allowlist `mailto:`/`tel:`, `isExternalHttpHref` и 59 unit-тестов. |
| **`NEW-10`** | Согласование `Schema.org Product` (`JSON-LD`) и цен на брендированных URL | **NEEDS_FOLLOWUP** | **PASS (код + тесты) / Бизнес-опция в Handoff** | В PR #5 формирование JSON-LD вынесено в чистую функцию `buildProductJsonLd` (`lib/product-data.ts`) и покрыто unit-тестами (`tests/product-jsonld.test.ts`) для `/case/design/m/2-0` и `/case/design/m/2-0/bmw`. Обоснован выбор Option B (каноническая базовая цена `2249 ₴` в согласии с `<link rel="canonical">`), а условия перехода на Option A для рекламных фидов вынесены в `CODEX_HANDOFF.md`. |
| **`C-11`** | Фактическая загрузка фото галереи (`ProductGallery.tsx`) | **NEEDS_FOLLOWUP** | **PASS (мобайл оптимизирован) / R2 и десктоп задокументированы** | Реальный замер через Playwright + Headless Chrome (`375px`, `768px`, `1440px`) показал, что на `375px` мобайле Chromium преждевременно скачивал оффскрин-слайды `02.webp` и `03.webp` (`+151 КБ`). В PR #5 внедрён `shouldRenderMobileSlideImage`: на `375px` стартовая загрузка галереи активного дизайна сократилась с **3 фото (`215.4 КБ`) до 1 фото (`64.4 КБ`, -70.1%)**, а `priority` на десктопе ограничен `safeActive === 0`. |
| **Проверка Vercel** | Read-only аудит настроек и переменных окружения Vercel | **PASS / NEEDS_FOLLOWUP** | **PASS / NEEDS_FOLLOWUP** | Подтверждены все выводы по `CUSTOMER_STORE=directus` на `preview [branch=dev]`, отсутствию флагов на `feature/*`, региону `iad1` и широкому scope `SUPABASE_SECRET_KEY`. Действия в панели Vercel ждут санкции владельца. |

---

## 3. Детальный разбор доработок Antigravity в PR №5

### 3.1. `NEW-06` — Строгая валидация CMS-ссылок через WHATWG `URL` (`PASS`)

- **Исходная проблема в PR #4:**
  1. В `lib/cms/href.ts:10` проверка `/^(https?:|mailto:|tel:)/i.test(value)` проверяла только префикс строки, пропуская URL без двойного слэша (`https:example.com`, `http:/example.com`), пустой хост (`https://`, `http:///`), ссылки с учётными данными (`https://user:pass@evil.com`), внутренние пробелы и управляющие ASCII-символы (`\u0000-\u001f`, `\u007f`), а также пустые/битые `mailto:` и `tel:` (`mailto:`, `mailto://evil.com`, `tel:abc`).
  2. В `components/cms/PageRenderer.tsx:39` условие `target={safeHref.startsWith('http') ? '_blank' : undefined}` было чувствительно к регистру и не выставляло `target="_blank"` для `HTTPS://example.com`.
- **Принятое решение в PR #5:**
  - В [`product-page/lib/cms/href.ts`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/lib/cms/href.ts) добавлена фильтрация управляющих символов и пробелов (`/[\u0000-\u001f\u007f\s]/`), строгий префикс `/^https?:\/\//i` с парсингом через `new URL(value)` (проверка `protocol === 'http:' || 'https:'`, непустого `hostname` и отсутствия `username`/`password`), валидация `mailto:` и `tel:` по регулярным выражениям, проверка относительных путей через `new URL(value, 'https://carzo.local')` и экспорт `isExternalHttpHref(href)`.
  - В [`product-page/components/cms/PageRenderer.tsx`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/components/cms/PageRenderer.tsx) `CmsLink` использует регистронезависимый `isExternalHttpHref(safeHref)`, а якорные ссылки (`#...`) рендерит через нативный `<a href>` вместо `next/link`.
  - В [`product-page/tests/cms-href.test.ts`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/tests/cms-href.test.ts) тест-матрица расширена с 22 до **59 тестов**.

### 3.2. `NEW-10` — Архитектурное решение по `Schema.org Product` (`JSON-LD`) и покрытие тестами (`PASS`)

- **Исходная проблема:**
  - На маршруте `/case/design/m/2-0/bmw` покупатель в UI видит заголовок `<h1>Автокейс M Carzo 2.0 для BMW</h1>` и цену с логотипом **`2 539 ₴`** (`2249 ₴` база + `290 ₴` логотип), при этом в карточке выбора размера `M` отображается базовая цена `2249 ₴`, а в селекторе бренда — `+290 ₴`.
  - В то же время `<link rel="canonical">` и `og:url` в `generateMetadata` (`app/case/design/[...slug]/page.tsx:22,34`) указывают на базовую небрендированную страницу `/case/design/m/2-0`, и только базовые страницы входят в `sitemap.xml` (`lib/seo.ts:49`).
- **Сравнение трёх вариантов (A, B, C):**
  - **Вариант A (Брендированная цена `2539 ₴` в JSON-LD на `/bmw`):**
    - Гибридный подвариант (`url: '/case/design/m/2-0'` + `offers.price: 2539`) **недопустим по спецификации Schema.org / Google Search Central**, так как приписывает каноническому URL `/case/design/m/2-0` две разные цены (`2249` и `2539`).
    - Полный подвариант A (`url: '.../m/2-0/bmw'`, `name: '... для BMW'`, `offers.price: 2539`) вступает в конфликт с `<link rel="canonical" href="/case/design/m/2-0">`: для органического поиска Google канонизирует `/bmw` в `/m/2-0`, а для самостоятельного участия `/bmw` в фидах Google Merchant Center потребовалось бы сделать брендированные URL самоканоническими (`canonical = /case/design/m/2-0/bmw`), что меняет SEO-архитектуру сайта (`AGENTS.md`: *"Brand selection doesn't create new canonical pages — it's a client-side parameter"*).
  - **Вариант B (Каноническая базовая страница и базовая цена `2249 ₴` в JSON-LD):**
    - Полностью согласует `Product` JSON-LD (`name`, `description`, `url`, `offers.url`, `offers.price = 2249`) с `<link rel="canonical">` и `og:url`.
    - Не меняет бизнес-логику цен, наценку за логотип, корзину и конфигуратор.
  - **Вариант C (`AggregateOffer` или массив `Offer`):**
    - Документация Google Merchant Listing явно указывает: *"Use `Offer`, not `AggregateOffer`, for Merchant listing experiences"*. Замена `Offer` на `AggregateOffer` лишает страницу полноценной поддержки Merchant Listings в Google и меняет отображение сниппета цены в выдаче.
- **Принятое техническое решение в PR #5:**
  - Сохранена стратегия **Варианта B** как единственная SEO-непротиворечивая при текущем `<link rel="canonical" href="/case/design/{size}/{design}">`.
  - Логика сборки JSON-LD вынесена из `app/case/design/[...slug]/page.tsx` в чистую типизированную функцию [`buildProductJsonLd`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/lib/product-data.ts#L196-L240) в `lib/product-data.ts`.
  - Создан модульный тест-сьют [`product-page/tests/product-jsonld.test.ts`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/tests/product-jsonld.test.ts), проверяющий:
    1. Обычный URL (`/case/design/m/2-0` → `2249 ₴`);
    2. Брендированный URL (`/case/design/m/2-0/bmw` → UI `2539 ₴`, canonical `/case/design/m/2-0`, JSON-LD `name`/`url`/`offers.price = 2249 ₴`);
    3. Полную идентичность JSON-LD между `/case/design/m/2-0` и `/case/design/m/2-0/bmw`;
    4. Выбор первого не-плейсхолдерного изображения и fallback на `/case.jpg` + `OutOfStock`.

### 3.3. `C-11` — Реальная браузерная проверка (`Playwright + Chrome`) и оптимизация `ProductGallery.tsx` (`PASS`)

- **Исходная проблема и проверка выводов:**
  - В `SUBAGENTS_REPORT.md` Xiaomi утверждал, что лишней загрузки фото в галерее нет, а в первичном ревью Antigravity предполагалось, что на миниатюрах отсутствует `loading="lazy"`.
  - Построчная проверка кода `ManagedProductImage.tsx` и `node_modules/next/dist/shared/lib/get-img-props.js:228,427` + **реальный запуск Headless Chrome через Playwright** на странице `/case/design/l/4-0` (5 фото в галерее) для разрешений `375×812`, `768×1024` и `1440×900` установили точную картину:
    1. На всех `<ManagedProductImage>` без `priority` атрибут `loading="lazy"` и `decoding="async"` **уже выставляется внутри `next/image`**.
    2. На разрешениях **`768px` (планшет) и `1440px` (десктоп)** все 5 миниатюр (`80×80px`) в левой колонке `[data-product-gallery="desktop"]` находятся **в видимой области первого экрана (above the fold)** и используют полноразмерный URL `image.src` (`01.webp`..`05.webp`), поэтому `IntersectionObserver` штатно загружает все 5 изображений галереи (`337.3 КБ`), чтобы отобразить превью миниатюр. При этом внутри одной загрузки страницы повторных сетевых запросов к одному URL **нет** (`duplicateRequestsWithinLoad: []`), а ответы R2 при реальном `GET` из Chrome содержат **`cache-control: max-age=14400` и `cf-cache-status: HIT`**.
    3. Однако на разрешении **`375px` (мобайл)**, где виден только **1 первый слайд (`01.webp`, `64.4 КБ`)**, браузер Chrome при открытии страницы **преждевременно скачивал 3 слайда (`01.webp`, `02.webp`, `03.webp` = `215.4 КБ`)**! Причина: все 5 слайдов монтировались в горизонтальную flex-ленту (`width: 500%`), и слайды `02.webp` (`x = 375px`) и `03.webp` (`x = 750px`) попадали в горизонтальный `rootMargin` (`1250px`–`2500px`) встроенного в Chromium `LazyLoadImageObserver` несмотря на `overflow-hidden`.
- **Принятое решение в PR #5 ([`ProductGallery.tsx`](file:///Users/qq/Documents/GitHub/carzo-antigravity-review-followup/product-page/components/ProductGallery.tsx)):**
  - Добавлена чистая функция `shouldRenderMobileSlideImage(index, activeIndex, hasInteracted)` и состояние `mobileInteracted`: до первого касания галереи (`onTouchStart`, `onPointerDown`) или нажатия на точку пагинации в мобильной карусели монтируется только активный первый слайд (`01.webp`), а остальные слоты сохраняют пустые flex-контейнеры.
  - На главном изображении десктопа выставлено `priority={safeActive === 0}` (чтобы переключение слайдов `2..N` не добавляло лишние `<link rel="preload" fetchpriority="high">` в `<head>`), а на миниатюрах и непервичных слайдах явно прописаны `loading="lazy"` и `decoding="async"`.
- **Подтверждённый замерами Playwright результат на `375px`:**
  - Количество загружаемых фото активной галереи (`4-0:L`) при открытии страницы на `375px` сократилось с **3 (`01.webp`..`03.webp`, `215 446 байт`) до 1 (`01.webp`, `64 436 байт`)** — экономия **151 010 байт (-70.1% трафика галереи товара и -33.8% всего трафика картинок страницы на мобайле)**.
  - Общее число тегов `<img>` в стартовом DOM снизилось с **39 до 31** (в мобильной галерее — с **10 до 2**).
