# SUBAGENTS REPORT — Antigravity (16 ноября 2026)

В ходе выполнения задачи доработки пакета Xiaomi главный агент **Antigravity (Argon High)** запустил **3 реальных специализированных READ-ONLY субагента** (`invoke_subagent`, тип `research`). Ни один субагент не модифицировал файлы — все изменения кода и запуск браузерных замеров выполнены главным агентом после анализа их отчётов.

| # | Conversation ID | Роль субагента | Область исследования | Статус |
| :---: | :--- | :--- | :--- | :---: |
| 1 | `2b4af450-eddb-4d2d-943c-b113ae94a5b9` | **SEO & Structured Data Reviewer** | `NEW-10`: `Schema.org Product` (`JSON-LD`), `<link rel="canonical">`, `generateMetadata`, SSR-цены в `ProductOptions.tsx`, сравнение вариантов A / B / C | **Завершён (READ-ONLY)** |
| 2 | `47682dff-cc8f-47d9-8543-7cc66ee42f46` | **CMS Security Reviewer** | `NEW-06`: анализ `lib/cms/href.ts` и `PageRenderer.tsx`, векторы обхода, WHATWG `new URL()`, совместимость с `next/link` и матрица тестов | **Завершён (READ-ONLY)** |
| 3 | `c7b32eb3-d505-4dd2-bd86-9ec64d400b86` | **Media Performance Reviewer** | `C-11`: инспекция `ProductGallery.tsx`, `ManagedProductImage.tsx`, `ProductPageClient.tsx`, внутренней логики `next/image` (`get-img-props.js`) и таблицы `public.gallery_images` в Supabase | **Завершён (READ-ONLY)** |

---

## 1. Отчёт субагента `SEO & Structured Data Reviewer` (`2b4af450-eddb-4d2d-943c-b113ae94a5b9`)

- **Изученные файлы:** `product-page/app/case/design/[...slug]/page.tsx`, `ProductPageClient.tsx`, `components/ProductOptions.tsx`, `lib/product-data.ts`, `lib/content/resolver.ts`, `lib/cart/server.ts`, `content/carzo-content.seed.json`.
- **Ключевые установленные факты:**
  1. В `ProductOptions.tsx:160-168` начальная цена в SSR HTML вычисляется как `currentPrice = basePrice + logoExtra + fixExtra` (при `selectedFixation = 'none'` во время SSR `fixExtra = 0`). Поэтому на `/case/design/m/2-0` в `<h1>`, герое и кнопке «Купити» рендерится `2249 ₴`, а на `/case/design/m/2-0/bmw` — `2539 ₴` (`2249 + 290`), при этом в карточке выбора размера `M` (`ProductOptions.tsx:333`) остаётся видна базовая цена `2249 ₴`, а в селекторе бренда (`ProductOptions.tsx:396`) — `+290 ₴`.
  2. В `generateMetadata` (`page.tsx:22,34`) `<link rel="canonical">` и `og:url` всегда указывают на базовый URL без бренда (`/case/design/m/2-0`), а в `sitemap.xml` (`lib/seo.ts:49`) присутствуют только базовые URL.
  3. **Сравнение вариантов A, B, C:**
     - **Гибридный вариант A2** (`url: '/case/design/m/2-0'` + `offers.price: 2539`) создаёт прямое противоречие в Schema.org, приписывая одному и тому же каноническому `offers.url` две разные цены (`2249` и `2539`).
     - **Полный вариант A1** (`url: '.../m/2-0/bmw'`, `name: '... для BMW'`, `offers.price: 2539`) требует бизнес-решения о превращении брендированных URL в самостоятельные самоканонические посадочные страницы (`canonical = /case/design/m/2-0/bmw`), если на них планируется вести товарные фиды Google Merchant Center / Meta Catalog.
     - **Вариант C (`AggregateOffer`)** прямо не рекомендуется документацией Google Search Central для Merchant listing experiences (*"Use `Offer`, not `AggregateOffer`, for Merchant listing experiences"*).
     - **Вариант B (текущая каноническая модель)** на 100% согласует `Product` JSON-LD с `<link rel="canonical">` и не затрагивает бизнес-логику цен.
- **Принято главным агентом:** сохранена стратегия Варианта B, код генерации вынесен в чистую функцию `buildProductJsonLd` в `lib/product-data.ts` и покрыт модульными тестами в `tests/product-jsonld.test.ts`; условия перехода на Вариант A1 для рекламных фидов задокументированы в `CODEX_HANDOFF.md`.

---

## 2. Отчёт субагента `CMS Security Reviewer` (`47682dff-cc8f-47d9-8543-7cc66ee42f46`)

- **Изученные файлы:** `product-page/lib/cms/href.ts`, `components/cms/PageRenderer.tsx`, `tests/cms-href.test.ts`, `content/carzo-pages.seed.json`.
- **Ключевые установленные факты:**
  1. Регулярное выражение `/^(https?:|mailto:|tel:)/i` в `lib/cms/href.ts:10` из PR #4 проверяло только префикс и пропускало:
     - схемы без двойного слэша (`https:example.com`, `http:alert(1)`, `http:/example.com`);
     - пустые хосты (`https://`, `http:///`);
     - URL с `username`/`password` (`https://user:pass@evil.com`, `https://carzo.ua@evil.com`);
     - строки с внутренними пробелами и управляющими символами (`\u0000-\u001f`, `\u007f`);
     - некорректные `mailto:` и `tel:` (`mailto:`, `mailto://evil.com`, `tel:abc`).
  2. В `PageRenderer.tsx:39` `safeHref.startsWith('http')` терял `target="_blank"` на верхнем регистре (`HTTPS://example.com`), а ссылки-якоря (`#advantages` или свёрнутый `'#'`) проваливались в `next/link` `<Link>`.
- **Принято главным агентом:** внедрена полная валидация через WHATWG `new URL()`, шаблоны `MAILTO_PATTERN` и `TEL_PATTERN`, хелпер `isExternalHttpHref`, рендер `#`-якорей через `<a>` и расширение `tests/cms-href.test.ts` до 59 проверок.

---

## 3. Отчёт субагента `Media Performance Reviewer` (`c7b32eb3-d505-4dd2-bd86-9ec64d400b86`)

- **Изученные файлы:** `product-page/components/ProductGallery.tsx`, `components/ManagedProductImage.tsx`, `app/case/design/[...slug]/ProductPageClient.tsx`, `lib/content/resolver.ts`, `lib/data/content/supabase.ts`, `node_modules/next/dist/shared/lib/get-img-props.js` + read-only `SELECT` к `public.gallery_images` в Supabase (`kmhegysmtsjqtwwaacht`).
- **Ключевые установленные факты:**
  1. В `public.gallery_images` 53 опубликованных записи: по **4 фото** у всех размеров `2-0` и у `3-0` (S/M/XL), и по **5 фото** у `3-0` (L) и всех размеров `4-0`. Отдельного поля `thumbnail` в БД и типах нет — миниатюры используют `image.src`.
  2. В `next/image` (`get-img-props.js:228,427`) все `<ManagedProductImage>` без `priority` уже получают `loading="lazy"` и `decoding="async"` в DOM.
  3. На планшете и десктопе (`>= 768px`, брейкпоинт `md:`) все 4–5 миниатюр (`80×80px`) находятся в видимой области первого экрана, поэтому `IntersectionObserver` загружает все 4–5 изображений сразу для отображения колонки превью.
  4. На мобильном разрешении (`< 768px`) в `ProductGallery.tsx:105-116` все $N$ слайдов монтируются сразу в горизонтальную flex-ленту (`width: ${images.length * 100}%`), из-за чего оффскрин-слайды попадают в горизонтальный `rootMargin` Chromium `LazyLoadImageObserver`.
  5. На главном изображении десктопа (`ProductGallery.tsx:86`) стоял безусловный `priority`, инжектящий `<link rel="preload" fetchpriority="high">` при каждом клике по миниатюрам `2..N`.
- **Принято главным агентом:** главный агент подтвердил выводы субагента реальным браузерным тестом через Playwright + Headless Chrome (`375px`, `768px`, `1440px`), внедрил `shouldRenderMobileSlideImage` + `priority={safeActive === 0}` в `ProductGallery.tsx` и повторным замером Playwright подтвердил сокращение стартового трафика галереи активного товара на `375px` на **70.1% (-151 КБ)**.
