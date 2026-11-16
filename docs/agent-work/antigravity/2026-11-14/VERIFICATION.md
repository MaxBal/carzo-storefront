# VERIFICATION — Antigravity Follow-up Package (16 ноября 2026)

Протокол всех проверок, фактически выполненных агентом **Antigravity (Argon High)** в рабочей директории `/Users/qq/Documents/GitHub/carzo-antigravity-review-followup` (ветка `fix/antigravity-xiaomi-review-followup`, [PR #5](https://github.com/MaxBal/carzo-storefront/pull/5)).

> Статус **PASS** проставлен исключительно по результатам реально выполненных прогонов. Тесты с записью в Production Supabase, создание тестовых заказов и деплой на рабочий сайт **не выполнялись**.

---

## 1. Проверка качества кода, типов и сборки

| Проверка | Команда | Результат | Подробности |
| :--- | :--- | :---: | :--- |
| **TypeScript** | `pnpm exec tsc --noEmit` | **PASS** | `0` ошибок типизации |
| **ESLint** | `pnpm run lint` | **PASS** | `exit 0`, ошибок нет (только предсуществующие warnings `no-img-element` / `alt-text` в не затронутых файлах) |
| **Пакет аудиторских тестов (`test:audit-fixes`)** | `pnpm run test:audit-fixes` | **PASS (77/77)** | **77 тестов в 8 сьютах (`419.6 мс`):**<br>• `cms-href.test.ts` — 59/59 PASS (`NEW-06`)<br>• `product-jsonld.test.ts` — 7/7 PASS (`NEW-10` + `C-11`)<br>• `robots-env.test.ts` — 9/9 PASS (`C-09` + `C-16`)<br>• `supabase-catalog-published-filter.test.ts` — 3/3 PASS (`C-07`) |
| **Production Build** | `pnpm run build` (с `*_STORE=supabase` и read-only `.env.local`) | **PASS** | Сборка Next.js 14.2.35 завершена успешно (`✓ Compiled successfully`, `✓ Generating static pages (14/14)`) |

---

## 2. Существующие модульные тест-сьюты (13 сьютов, без записи в БД)

| Скрипт `package.json` | Результат | Покрытие |
| :--- | :---: | :--- |
| `pnpm run test:loyalty` | **PASS (40/40)** | Расчёт скидок лояльности, серверное ценообразование корзины и side-effects чекаута |
| `pnpm run test:customer-store` | **PASS (32/32)** | Нормализация телефонов и адаптер клиентов |
| `pnpm run test:checkout-reliability` | **PASS (12/12)** | Надёжность идемпотентного чекаута и обработка ошибок |
| `pnpm run test:shipping` | **PASS (41/41)** | Габариты посылок, лимиты почтоматов и отделений Новой Почты |
| `pnpm run test:payment` | **PASS (16/16)** | Опции оплаты (предоплата 200 грн / полная оплата) |
| `pnpm run test:keycrm` | **PASS (64/64)** | Маппинг заказов, кастомных полей и вебхуков keyCRM |
| `pnpm run test:order-notifications` | **PASS (39/39)** | HTML-форматирование и маршрутизация уведомлений в Telegram |
| `pnpm run test:stage9-prep` | **PASS (13/13)** | Core-логика отправки заявок на автоковрики и флаг техработ |
| `pnpm run test:carmat-telegram` | **PASS (19/19)** | Валидация формы автоковриков и доставка в Telegram |
| `pnpm run test:stage4` | **PASS (19/19)** | Флаги `*_STORE`, квотирование корзины и проверка 17 медиа-слотов |
| `pnpm run test:stage6` | **PASS (26/26)** | Генерация `checkout_attempt_id`, `request_fingerprint` и контракт чекаута |

---

## 3. Проверка SEO-метаданных и `Schema.org Product` (`JSON-LD`) на локальном Production-сервере (`next start`)

Локальный сервер запущен на порту `4123` после `next build` (`http://127.0.0.1:4123`):

| Маршрут / Проверка | Результат | Фактический вывод |
| :--- | :---: | :--- |
| `GET /case/design/m/2-0` (`Product` JSON-LD) | **PASS** | `{"@context":"https://schema.org","@type":"Product","name":"Автокейс M Carzo 2.0","url":"https://carzo-storefront.vercel.app/case/design/m/2-0","offers":{"@type":"Offer","price":2249,"priceCurrency":"UAH","availability":"https://schema.org/InStock","url":"https://carzo-storefront.vercel.app/case/design/m/2-0"}}` |
| `GET /case/design/m/2-0/bmw` (`Product` JSON-LD) | **PASS** | Полностью идентичен канонической странице `/case/design/m/2-0` (`name: "Автокейс M Carzo 2.0"`, `url: "https://carzo-storefront.vercel.app/case/design/m/2-0"`, `offers.price: 2249`) и согласован с `<link rel="canonical" href="/case/design/m/2-0">` |

---

## 4. Реальная браузерная проверка загрузки изображений (`Playwright + Headless Chrome`) по разрешениям `375px`, `768px`, `1440px` (`C-11`)

Инструмент: `playwright` (`chromium.launch` с локальным `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`), страница `/case/design/l/4-0` (5 фотографий в галерее `01.webp`..`05.webp`), ожидание `networkidle` + `1000 мс`.

### 4.1. Ответы на 8 вопросов спецификации по результатам браузерных замеров

1. **Сколько изображений находится в галерее:** в живой БД Supabase (`public.gallery_images`, `status = 'published'`) у каждого товара **4 или 5 фотографий** (`2-0`: по 4 фото; `3-0`: по 4 фото для S/M/XL и 5 фото для L; `4-0`: по 5 фото для S/M/L/XL).
2. **Какие URL используются миниатюрами:** отдельные превью-файлы в БД и R2 отсутствуют; миниатюры используют тот же полноразмерный URL `image.src` (`1080×1080`, `~38–88 КБ` WebP), что и основное фото.
3. **Есть ли `loading="lazy"`:** внутри `ManagedProductImage` (`next/image` с `unoptimized`) всем изображениям без `priority` автоматически проставляются `loading="lazy"` и `decoding="async"`, а в PR #5 эти атрибуты дополнительно зафиксированы явно в `ProductGallery.tsx`.
4. **Работает ли браузерный и CDN-кеш:** реальный Chrome при `GET`-запросах к `https://media.carzo.com.ua/content/products/case/gallery/...` получает от Cloudflare R2 заголовки **`cache-control: max-age=14400` (4 часа) и `cf-cache-status: HIT`**.
5. **Есть ли повторные сетевые запросы к одному URL:** **НЕТ** (`duplicateRequestsWithinLoad: []` на всех трёх разрешениях) — браузер дедуплицирует одинаковые URL в рамках загрузки страницы.
6. **Как влияет двойное монтирование галерей в `ProductPageClient.tsx`:** создаёт `2 × (2N + 1)` тегов `<img>` галереи в DOM (22 тега при $N = 5$), из которых скрытые через `display: none` контейнеры (`parentHidden: true`) не инициируют загрузку `loading="lazy"` картинок в Chromium.
7. **Что реально загружалось до исправления и что изменилось после исправления в PR #5:**

| Разрешение | До PR #5 (PR #4 `17cdb4e`) | После PR #5 (`fix/antigravity-xiaomi-review-followup`) | Изменение (Дельта) |
| :--- | :--- | :--- | :--- |
| **Мобайл `375×812`** (`mobile-375`) | **9 запросов / `446 163 Б` (`435.7 КБ`)**<br>• Загружались **3 из 5** слайдов активной галереи (`01.webp` `64.4 КБ`, `02.webp` `63.2 КБ`, `03.webp` `87.8 КБ` = `215.4 КБ`), т.к. оффскрин-слайды в flex-ленте попадали в горизонтальный `rootMargin` Chromium<br>• Тегов `<img>` в DOM: **39** (в мобильной галерее: **10**) | **7 запросов / `295 153 Б` (`288.2 КБ`)**<br>• Загружается **только 1 видимый слайд** активной галереи (`01.webp` `64.4 КБ`), а `02.webp`..`05.webp` подгружаются только при касании/свайпе или клике по точке<br>• Тегов `<img>` в DOM: **31** (в мобильной галерее: **2**) | **-2 запроса**<br>**-151 010 байт (-33.8% всех картинок страницы и -70.1% галереи активного товара)**<br>**-8 узлов `<img>` в DOM** |
| **Планшет `768×1024`** (`tablet-768`) | **11 запросов / `568 049 Б` (`554.7 КБ`)**<br>• Все 5 миниатюр (`80×80px`) видны в левой колонке первого экрана → загружаются 5 фото `01.webp`..`05.webp` (`337.3 КБ`) + 2 превью соседних дизайнов<br>• Тегов `<img>` в DOM: **39** | **11 запросов / `568 049 Б` (`554.7 КБ`)**<br>• Видимые миниатюры штатно загружают 5 фото; при клике на миниатюры `2..5` в `<head>` больше не инжектится лишний `<link rel="preload" fetchpriority="high">`<br>• Тегов `<img>` в DOM: **31** | **-8 скрытых узлов `<img>` в DOM**<br>Устранено засорение `<head>` preload-ссылками при переключении миниатюр |
| **Десктоп `1440×900`** (`desktop-1440`) | **12 запросов / `617 283 Б` (`602.8 КБ`)**<br>• Аналогично `768px` + обложка видео `magnetic-system/size-l/cover.webp` (`49.2 КБ`) попадает во вьюпорт<br>• Тегов `<img>` в DOM: **39** | **12 запросов / `617 283 Б` (`602.8 КБ`)**<br>• Аналогично `768px`<br>• Тегов `<img>` в DOM: **31** | **-8 скрытых узлов `<img>` в DOM**<br>Устранено засорение `<head>` preload-ссылками |
