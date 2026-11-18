# SUBAGENTS REPORT — Xiaomi MiMo (13 ноября 2026)

В рамках задания главный агент запустил **реальную** встроенную систему субагентов
(инструмент `actor`, режимы `explore` / `general`). Все субагенты работали в **read-only**
режиме: без редактирования файлов, без Git-записи, без изменений Vercel/Supabase.
Отчёты ниже — фактические результаты их работы (свёртка передаётся в уведомлениях
главному агенту). Имитация субагентов не использовалась.

| # | Субагент (actor_id) | Роль | Задание | Статус |
| --- | --- | --- | --- | --- |
| 1 | SEO Auditor (`explore-1`) | NEW-04, C-09, NEW-10; sitemap / robots / canonical / JSON-LD | read-only аудит SEO | **завершён** |
| 2 | Security & CMS Auditor (`explore-2`) | NEW-06, C-16; безопасные CMS-ссылки, HTTP headers | read-only аудит безопасности | **завершён** |
| 3 | Catalog & Media Auditor (`general-1`) | C-07 (discount_tiers), C-11 (диагностика изображений) | read-only аудит каталога/медиа | **завершён** |
| 4 | Vercel Infrastructure Auditor (`general-2`) | READ-ONLY проверка Vercel: регион, STORE-флаги, креденшелы, деплой | read-only инфраструктурный аудит | **завершён** |

Детализация по каждому субагенту (роль, задание, изученные файлы, использованные
инструменты, найденные проблемы, рекомендации, подтверждённые/неподтверждённые выводы,
ограничения, что принято главным агентом) заполняется по мере получения отчётов —
см. разделы ниже.

---

## 1. SEO Auditor (`explore-1`)

- **Полученное задание:** read-only проверка NEW-04 (sitemap/llms.txt), C-09 (robots /
  VERCEL_ENV), NEW-10 (JSON-LD Product), включая canonical и сопоставление цены.
- **Изученные файлы:** `product-page/app/sitemap.ts`, `product-page/app/llms.txt/route.ts`,
  `product-page/app/catalog-carmat/page.tsx`, `product-page/app/robots.ts`,
  `product-page/next.config.js`, `product-page/lib/seo.ts`, `product-page/lib/pages/metadata.ts`,
  `product-page/app/case/design/[...slug]/page.tsx`, `product-page/lib/product-data.ts`,
  `product-page/components/ProductOptions.tsx`, seed-файлы контента.
- **Инструменты:** чтение кода, glob/grep (поиск прочих вхождений `VERCEL_URL`/`staging`).
- **NEW-04 — CONFIRMED.** `/catalog-carmat` (`app/catalog-carmat/page.tsx`, canonical
  `page.tsx:17`) отсутствует и в `sitemap.ts` (там `/`, `/about`, CMS-страницы,
  `getPrimaryProductLinks()` — только `/case/design/...`), и в `llms.txt`. Дублей нет:
  sitemap использует `Map` по URL; CMS-slug `catalog-carmat` не существует. Реальный origin —
  `https://carzo-storefront.vercel.app` (fallback `lib/seo.ts:7`; `.env.example` указывает
  устаревший `carzo-eight.vercel.app`; `carzo.com.ua` к Vercel не привязан).
- **Рекомендация NEW-04:** добавить в `sitemap.ts` запись `/catalog-carmat`
  (`changeFrequency: 'weekly'`, `priority: 0.8`) и строку в llms.txt «Основні сторінки».
- **C-09 — CONFIRMED.** Оба места (`app/robots.ts:5-6`, `next.config.js:17-18`) детектируют
  staging только по подстроке `staging` в URL. Preview-деплои (`carzo-storefront-git-*`)
  её не содержат → индексируемы (баг). Production сейчас корректен случайно. Локально
  переменные не заданы → allow (должно остаться). Отдельный проект staging деплоится с
  `VERCEL_ENV=production` и ловится только legacy-проверкой URL — её надо сохранить.
- **Рекомендация C-09:** `isNonProduction = (VERCEL_ENV && VERCEL_ENV !== 'production') ||
  VERCEL_URL?.includes('staging') || NEXT_PUBLIC_SITE_URL?.includes('staging')` в обоих файлах.
  Прочих вхождений паттерна в коде нет (проверено grep).
- **NEW-10 — CONFIRMED, микроразметку можно исправить без бизнес-логики.** На брендированных
  URL `/case/design/m/2-0/bmw` canonical (`generateMetadata`) ведёт на `/case/design/m/2-0`
  (brand срезается, `lib/product-data.ts:67-70`), но JSON-LD несёт брендовый `name`
  («Автокейс m Carzo 2.0 для BMW»), брендовый `url` (`/case/design/m/2-0/bmw`, строка 76 и
  `offers.url` 101) и базовую цену `selectedVariant.price` (2249) при том, что UI показывает
  2539 (`ProductOptions.tsx:163-167` = base 2249 + logoExtra 290). Реальное расхождение
  всех трёх полей.
- **Рекомендация NEW-10 (принята):** строить JSON-LD от канонических параметров
  `brandId: 'none'` (name/url/price согласованы с canonical; цена совпадает с UI, т.к.
  `logoExtra('none')=0` и дефолтная фиксация без наценки). Вариант с прибавлением наценки
  логотипа оставил бы name/url рассинхронизированными и зависит от клиентского состояния
  фиксации — это бизнес-логика, в данном пакете не выполняется (по заданию — передать
  Codex, если потребуется; аудитор оценил preferred-вариант как безопасный и достаточный).
- **Что подтвердилось:** все три проблемы реальны; fix-сниппеты основаны на фактическом коде.
- **Что не подтвердилось / уточнено:** у аудита `priority: 0.9` для `/catalog-carmat`;
  принято 0.8 (консистентно с товарными URL). Имя env в `robots.ts`/`next.config.js`
  (`NEXT_PUBLIC_SITE_URL`) отличается от `lib/seo.ts` (`SITE_URL`) — замечание, не регрессия.
- **Ограничения:** live-проверка sitemap/JSON-LD Production не выполнялась аудитором
  (код-анализ; текущий код идентичен задеплоенному — проверено главным агентом по diff).
- **Принято главным агентом:** фиксы NEW-04 и C-09 по рекомендованным сниппетам;
  NEW-10 — вариант с каноническими параметрами JSON-LD.

## 2. Security & CMS Auditor (`explore-2`)

- **Полученное задание:** read-only проверка NEW-06 (URL-схемы в `CmsLink`) и C-16
  (HTTP security headers), подготовка точных фиксов и списка тест-кейсов.
- **Изученные файлы:** `product-page/components/cms/PageRenderer.tsx`, поиск
  `lib/cms/sanitize.ts` (не найден), `lib/pages/types.ts`, `lib/pages/directus.ts`,
  `lib/data/pages/supabase.ts`, `content/carzo-pages.seed.json`, `next.config.js`,
  поиск `middleware.ts` / `vercel.json` (отсутствуют).
- **Инструменты:** чтение кода, glob/grep, live `curl -sI https://carzo-storefront.vercel.app/`
  (read-only сетевой запрос).
- **NEW-06 — CONFIRMED.** `CmsLink` (`PageRenderer.tsx:31-40`) проверяет только
  `/^(https?:|mailto:|tel:)/i`; `javascript:`, `data:`, `vbscript:`, protocol-relative
  `//evil.com`, ведущие пробелы/табуляция проходят в `<Link href>` без санации. HTML-тела
  блоков при этом санитизируются инлайновым `safeHtml()` (`PageRenderer.tsx:14-29`,
  `allowedSchemes: ['http','https','mailto','tel']`) — на href кнопок это не распространяется.
  Источник значений: свободные текстовые поля `page_blocks.primary_url` / `secondary_url`.
  Реалистичный контент seed использует `/case/design/m/2-0`, `#advantages`, `null`.
- **Рекомендация NEW-06:** чистая функция `sanitizeCmsHref(href)` в новом
  `product-page/lib/cms/href.ts`: allowlist `https:`, `http:`, `mailto:`, `tel:`,
  относительные пути с `/` (но не `//`), якоря `#`; всё остальное → `'#'`;
  блокировать backslash-обходы (`/\\evil.com`). Дизайн кнопок не менять.
  Тест-кейсы: allowed — `https://example.com`, `http://example.com`, `mailto:a@b.c`,
  `tel:+380441234567`, `/about`, `/case/design/l/4-0`, `#top`, `/about#team`;
  forbidden→`'#'` — `javascript:alert(1)`, `JaVaScRiPt:alert(1)`, `data:text/html;base64,xx`,
  `vbscript:msgbox(1)`, `//evil.com`, `' javascript:x'`, `'\tjavascript:x'`, `''`, `'   '`,
  `java\tscript:alert(1)`, `/\\evil.com`.
- **C-16 — CONFIRMED.** `next.config.js:16-26`: `headers()` возвращает `[]` вне staging;
  live-проверка Production показала только платформенный `Strict-Transport-Security` —
  X-Content-Type-Options / X-Frame-Options / Referrer-Policy / Permissions-Policy / CSP
  отсутствуют. `middleware.ts` и `vercel.json` отсутствуют.
- **Рекомендация C-16:** всегда отдавать 5 защитных заголовков (nosniff, SAMEORIGIN,
  strict-origin-when-cross-origin, `camera=(), microphone=(), geolocation=()`, минимальный
  CSP `frame-ancestors 'self'; base-uri 'self'; object-src 'none'`), сохранив существующий
  `X-Robots-Tag: noindex, nofollow` для staging/preview. CSP намеренно без `script-src`/
  `style-src` — не трогает Next.js-ресурсы, R2-картинки, мессенджеры, будущую аналитику.
  HSTS не дублировать (управляет Vercel).
- **Дополнительно обнаружено:** `https://carzo.com.ua/` — это Tilda-сайт, не это приложение;
  реальный деплой — `https://carzo-storefront.vercel.app/` (fallback в `lib/seo.ts:7`).
- **Что подтвердилось:** обе проблемы реальны в текущем коде.
- **Что не подтвердилось:** упоминание в аудите `lib/cms/sanitize.ts` — файла нет,
  санитизация HTML инлайновая в `PageRenderer.tsx`.
- **Ограничения:** полная совместимость строгой CSP не проверялась (по ограничению задания
  строгая CSP не внедряется).
- **Принято главным агентом:** схема `sanitizeCmsHref` + allowlist-тесты; набор из 5
  security headers с сохранением `X-Robots-Tag`-логики (с объединением с фиксом C-09
  в том же `next.config.js`).

## 3. Catalog & Media Auditor (`general-1`)

- **Полученное задание:** read-only проверка C-07 (`discount_tiers`) и диагностика C-11
  (реальные замеры изображений `/catalog-carmat`, галереи, кеша R2).
- **Изученные файлы:** `lib/data/catalog/supabase.ts`, `lib/data/catalog/directus.ts`,
  `lib/cart/pricing.ts`, `lib/cart/server.ts`, `components/car-mats/CarmatPageContent.tsx`,
  `components/ProductGallery.tsx`, `components/ManagedProductImage.tsx`, `app/carmat.css`,
  `public/` (размеры файлов).
- **Инструменты:** чтение кода, `ls`/размеры файлов, live `curl` к
  `https://carzo-storefront.vercel.app` (read-only GET/HEAD), Supabase MCP
  (`list_tables`/`execute_sql`, строго SELECT) для проверки схемы `discount_tiers`.
- **C-07 — CONFIRMED (латентный).** `supabase.ts:87` — единственный каталог-запрос без
  `{ publishedOnly: true }` при наличии колонки `status` (у sibling-таблиц флаг стоит,
  `supabase.ts:73-86`). Старый Directus-адаптер фильтровал (`directus.ts:120`
  `readPublished(...)`). Схема в БД: `discount_tiers(id, key, min_quantity, amount, sort,
  **status**, created_at, updated_at)`; текущие данные — ровно 2 строки, обе `published`
  → утечки в проде сегодня нет, риск реализуется при добавлении draft/archived.
  Цепочка потребления: `cart/server.ts:79` → `pricing.ts` — любая draft-строка была бы
  применена к цене.
- **Рекомендация C-07 (принята):** одна строка — `{ publishedOnly: true }`; тест с моком
  query-builder без БД: фиксировать `.from('discount_tiers').select().eq('status','published')`,
  фикстура с draft/archived строками должна исключаться.
- **C-11 — замеры выполнены (curl по живым URL, 2026-11-13).**

| URL | Байт | Cache-заголовки | Кто качает |
| --- | --- | --- | --- |
| `/carmat-mobile.png` (PNG 1254×1254) | **2 292 986** | `public, max-age=0, must-revalidate`, ETag | и десктоп, и мобайл (eager) |
| `media.carzo.com.ua/…/car-mats/cover-video.webp` | 272 464 | **нет Cache-Control**, `cf-cache-status: DYNAMIC` | оба |
| `…/gallery/design-4.0/size-l/01.webp` | 64 436 | нет Cache-Control, CF DYNAMIC | оба |
| `…/size-l/02.webp` | 63 188 | нет Cache-Control, CF DYNAMIC | оба |

- **Подтверждено:** `images.unoptimized` глобально и per-image; два `<img>` баннера всегда в
  DOM (`CarmatPageContent.tsx:74-85`) без `loading`; браузеры качают `display:none`-картинки
  → десктоп **реально** тратит 2.29 МБ на PNG; webp-варианта мобильного PNG в `public/` нет;
  миниатюры галереи используют URL оригиналов, но **двойной загрузки в галерее нет**
  (одинаковые URL дедуплицируются кешем браузера) — вывод аудита о «двойной загрузке
  миниатюр» не подтвердился; lazy уже есть на не-priority картинках галереи.
- **Не проверено:** реальный Network-панелью браузера (числа от curl по URL из живого HTML;
  тезис о загрузке `display:none` — уровень спеки/кода, не browser-verified).
- **Простое безопасное предложение (НЕ внедрено, вынесено в CODEX_HANDOFF):** сжать
  `public/carmat-mobile.png` в webp (~150–250 КБ) и поменять `src` в `CarmatPageContent.tsx:76`;
  вторично — `loading="lazy"` для десктопного варианта баннера. Отдельно: на
  `media.carzo.com.ua` отсутствует `Cache-Control` (`cf-cache-status: DYNAMIC`) — проблема
  конфигурации CDN/R2, вне кода приложения.
- **Принято главным агентом:** фикс C-07 одной строкой + mock-тест; по C-11 — только
  диагностика и предложение (по заданию архитектуру изображений не менять).

## 4. Vercel Infrastructure Auditor (`general-2`)

- **Полученное задание:** строго READ-ONLY проверка Vercel-проекта
  `yevgens-projects/carzo-storefront` (`prj_D6HYKiqCDNcJoMl2rah8ImaPimXW`): регион,
  Production/Preview, 6 STORE-флагов, изоляция Supabase-креденшелов, Root Directory,
  `.vercel`, автодеплой. Значения секретов не раскрываются.
- **Инструменты:** Vercel CLI 65.14.0 (аутентифицирован как `unisoftaua-8604`,
  команда `yevgens-projects`, тариф hobby): `project inspect`, `env ls`, `env pull` во
  временный `/tmp` (файлы удалены после извлечения метаданных); REST API GET; gh CLI
  (только чтение remote). Vercel MCP отсутствует (подтверждено поиском инструментов).
  **Ни одной записи в Vercel не выполнено.**
- **Регион:** сейчас `iad1` (США) без failover; Supabase в `eu-west-1` (= `dub1`) — каждый
  запрос к БД трансатлантический. На hobby допускается один регион; по актуальным докам
  Vercel `dub1` выбрать можно (ценовой вопрос) — **возможность подтверждена, действие
  не выполнялось**.
- **Матрица окружений (значения секретов скрыты):**
  - Production: все 6 STORE-флагов = `supabase`; присутствуют `SUPABASE_SECRET_KEY`,
    `DIRECTUS_ADMIN_TOKEN` (**риск**), `DIRECTUS_URL`/`DIRECTUS_READ_TOKEN`, `KEYCRM_*`,
    `TELEGRAM_*`, `R2_*`, `NOVA_POSHTA_API_KEY`.
  - Preview [branch=dev]: 5 флагов = `supabase`, но **`CUSTOMER_STORE=directus` (баг)**;
    `SUPABASE_SECRET_KEY`, `DIRECTUS_URL`/`DIRECTUS_READ_TOKEN`, `PREVIEW_SECRET`,
    `TELEGRAM_TEST_CHAT_IDS`.
  - Preview [feature/*, fix/*]: **все 6 STORE-флагов отсутствуют** (код падает в дефолт
    `'directus'` — подтверждено `env pull --git-branch feature/test-audit`);
    при этом **`SUPABASE_SECRET_KEY` присутствует**.
  - Development: переменных Vercel нет.
- **Изоляция Supabase:** код читает `SUPABASE_URL` + `SUPABASE_SECRET_KEY`
  (`lib/supabase/server.ts:27-28`), публичных `NEXT_PUBLIC_SUPABASE_*` нет. Однако
  **`SUPABASE_SECRET_KEY` (service-role-класс) имеет scope `Production, Preview` —
  утекает во все preview-ветки, включая произвольные `feature/*`.** Это новая находка,
  шире, чем предполагал аудит C-13. Асимметрия: `SUPABASE_URL` есть только в production
  и preview[dev].
- **Root Directory:** `product-page` (верно); Node 26.x; `vercel.json` отсутствует;
  `.vercel/project.json` — только projectId/orgId/projectName, токенов нет.
- **Деплой:** репозиторий `MaxBal/carzo-storefront`, productionBranch `main`;
  push-автодеплой **отключён** (`createDeployments: "disabled"`) — деплой через CLI
  (`npx vercel --prod`). Deployment Protection на preview включена
  (`all_except_custom_domains`). Git fork protection включён.
- **Подтвердилось vs аудит C-13/NEW-03:** баг `CUSTOMER_STORE=directus` в preview[dev];
  отсутствие флагов на feature/*; `DIRECTUS_ADMIN_TOKEN` в production; `iad1` ↔ `eu-west-1`;
  защита preview. **Не подтвердилось:** ничего из заявленного; дополнено — утечка
  `SUPABASE_SECRET_KEY` на все preview, отсутствие anon-ключей, Node 26, отключённый
  push-автодеплой.
- **Ограничения:** тарифные лимиты по докам Vercel не проверялись живой переключкой
  региона (запрещено); значения секретов не извлекались в отчёт.
- **SAFE ACTIONS FOR CODEX (НЕ выполнены):** 1) `CUSTOMER_STORE=supabase` для
  preview[dev]; 2) проставить все 6 флагов `=supabase` для всех preview-веток;
  3) удалить `DIRECTUS_ADMIN_TOKEN` из production; 4) сузить scope `SUPABASE_SECRET_KEY`
  (прекратить выдачу произвольным preview-веткам); 5) добавить `SUPABASE_URL` на preview;
  6) рассмотреть `iad1`→`dub1` (согласовать с владельцем); 7) убрать `DIRECTUS_*` из
  preview после отказа от fallback.
- **FORBIDDEN / нужно решение владельца:** смена/ротация/удаление production-креденшелов;
  смена региона; любые деплои/домены; изменения Git-интеграции и защиты деплоев.
- **Принято главным агентом:** выводы включены в CODEX_HANDOFF (перечень безопасных
  действий); **никакие Vercel-настройки не менялись**.

---

## Ограничения среды

- Субагенты не имели доступа к приватным данным владельца и не выполняли аутентификацию
  в Production-системах сверх того, что разрешено read-only проверками.
- Сетевые замеры (браузерный Network) выполнялись только если инструменты субагента это
  реально позволяли; иначе фиксировалось «код-анализ, замер не выполнялся».
