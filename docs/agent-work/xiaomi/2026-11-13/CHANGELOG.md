# CHANGELOG — Xiaomi MiMo (13 ноября 2026)

Журнал действий **только** агента Xiaomi MiMo. Изменения других агентов (Xiaomi в прошлых
задачах, Codex, Antigravity, владельца) здесь не фиксируются и не приписываются себе.

Формат записи для каждого исправления:

1. ID проблемы из аудита
2. Что было неправильно
3. Как работало до исправления
4. Что именно изменено
5. Затронутые файлы
6. Почему выбрано такое решение
7. Влияние на сайт
8. Риск изменения существующего поведения
9. Как проверить исправление
10. Статус

---

## [2026-11-13] Исходное состояние (без изменений)

- Проверен `git status`, текущая ветка `main`, HEAD `f8e0e63`, `origin/main` = `baf997e`.
- Untracked: `docs/audits/` (материалы аудита Antigravity) — **чужие**, в PR не входят.
- Незапушенный коммит `f8e0e63` (`AGENTS.md`, `.gitignore`) — **чужой**, в PR не входит.
- Создан Git worktree `/Users/qq/Documents/GitHub/carzo-xiaomi-audit-2026-11-13` и ветка
  `fix/xiaomi-audit-2026-11-13` от `origin/main` (`baf997e`).
- Файлы продукта в рабочей ветке идентичны `origin/main`; изменений кода нет.
- Статус: **выполнено** (организационный шаг, код не менялся).

---

## [2026-11-13] Запуск исследовательской фазы (без изменений кода)

- Запущены 4 параллельных субагента (SEO, Security/CMS, Catalog/Media, Vercel Infra) в
  строгом read-only режиме. Отчёт: [SUBAGENTS_REPORT.md](./SUBAGENTS_REPORT.md).
- Статус: **выполнено** (без изменений кода).

---

---

## [2026-11-13] C-07 — Неопубликованные скидки в расчёте цены

1. **ID проблемы:** C-07 (аудит Antigravity 2026-11-13, подтверждён субагентом Catalog & Media).
2. **Что было неправильно:** `discount_tiers` — единственная таблица каталога с колонкой
   `status`, запрашиваемая без фильтра `publishedOnly`.
3. **Как работало до:** `lib/data/catalog/supabase.ts:87` —
   `selectAll('discount_tiers', 'key,min_quantity,amount,sort')` без опций; клиент —
   `service_role` (обход RLS), поэтому draft/archived строки участвовали бы в расчёте цены
   (`cart/server.ts:79` → `pricing.ts`). В живой БД сейчас 2 строки, обе `published`
   (проверено read-only запросом субагента) — утечки нет, риск латентный.
4. **Что изменено:** добавлен `{ publishedOnly: true }` к запросу `discount_tiers`
   (хелпер `selectAll` добавляет `.eq('status','published')`).
5. **Файлы:** `product-page/lib/data/catalog/supabase.ts`,
   `product-page/tests/supabase-catalog-published-filter.test.ts` (новый),
   `product-page/package.json` (скрипт `test:audit-fixes`).
6. **Почему так:** минимальное изменение, идентичное фильтрации sibling-таблиц
   (designs/sizes/brands/fixations/variants) и старому Directus-адаптеру
   (`readPublished('carzo_discount_tiers', ...)`).
7. **Влияние на сайт:** для текущих published-данных поведение не меняется; draft/archived
   тиры перестанут скидывать цену.
8. **Риск:** низкий; при появлении реальных draft-строк поведение осознанно изменится
   (это и есть цель).
9. **Как проверить:** `pnpm run test:audit-fixes` (мок PostgREST, без БД):
   запрос `discount_tiers` содержит `status=eq.published`, draft/archived исключены;
   дополнительно `pnpm run test:supabase-catalog` (read-only, живая БД) — 8/8 PASS.
10. **Статус:** **выполнено**.

---

## [2026-11-13] NEW-04 — `/catalog-carmat` в sitemap и llms.txt

1. **ID проблемы:** NEW-04 (подтверждён субагентом SEO).
2. **Что было неправильно:** страница автоковриков `/catalog-carmat` отсутствовала в
   `sitemap.xml` и `llms.txt`.
3. **Как работало до:** `app/sitemap.ts` включал `/`, `/about`, CMS-страницы и
   `/case/design/...`; `llms.txt` — «Основні сторінки» + «Автокейси» без автоковриков.
4. **Что изменено:** добавлена запись `/catalog-carmat` (`weekly`, `priority 0.8`) в
   `sitemap.ts` и строка «Автокилимки CARZO» в `llms.txt` (секция «Основні сторінки»).
5. **Файлы:** `product-page/app/sitemap.ts`, `product-page/app/llms.txt/route.ts`.
6. **Почему так:** приоритет 0.8 консистентен с товарными URL (в аудите предлагался 0.9);
   дублей нет — sitemap дедуплицирует по `Map`, CMS-slug `catalog-carmat` не существует
   (проверено субагентом).
7. **Влияние:** улучшится индексация страницы автоковриков и её видимость для AI-поиска.
8. **Риск:** отсутствует (только добавление записей).
9. **Как проверить:** `curl /sitemap.xml` содержит
   `https://carzo-storefront.vercel.app/catalog-carmat` ровно один раз; `curl /llms.txt`
   содержит ссылку — **выполнено локально на production-сборке** (см. VERIFICATION.md).
10. **Статус:** **выполнено**.

---

## [2026-11-13] C-09 — Индексация Preview через `VERCEL_ENV`

1. **ID проблемы:** C-09 (подтверждён субагентом SEO).
2. **Что было неправильно:** `robots.ts` и `next.config.js` определяли тестовое окружение
   только по подстроке `staging` в URL; стандартные Preview-деплои
   (`carzo-storefront-git-*`) её не содержат → оставались индексируемыми.
3. **Как работало до:** `const isStaging = VERCEL_URL?.includes('staging') ||
   NEXT_PUBLIC_SITE_URL?.includes('staging')`; на Preview `robots.txt` отдавал `Allow: /`
   и не ставил `X-Robots-Tag`.
4. **Что изменено:** в обоих файлах условие заменено на
   `isNonProduction = (VERCEL_ENV задан и !== 'production') || legacy-проверки URL`.
   Логика robots (Disallow/Allow, sitemap, host) и семантика сохранены.
5. **Файлы:** `product-page/app/robots.ts`, `product-page/next.config.js`,
   `product-page/tests/robots-env.test.ts` (новый).
6. **Почему так:** `VERCEL_ENV` — системный признак окружения Vercel; legacy-проверки URL
   **сохранены**, т.к. отдельный staging-проект деплоится с `VERCEL_ENV=production` и
   ловится только по URL (подтверждено субагентом). Локально `VERCEL_ENV` не задан →
   поведение не меняется.
7. **Влияние:** Preview-деплои закроются от индексации; Production остаётся индексируемым.
8. **Риск:** низкий; единственное осознанное поведенческое изменение — preview → noindex.
9. **Как проверить:** `pnpm run test:audit-fixes` (5 кейсов robots + 4 кейса headers по
   значениям `VERCEL_ENV`); **выполнено**.
10. **Статус:** **выполнено**.

---

## [2026-11-13] NEW-06 — Безопасные ссылки CMS (`CmsLink`)

1. **ID проблемы:** NEW-06 (подтверждён субагентом Security & CMS).
2. **Что было неправильно:** `CmsLink` в `components/cms/PageRenderer.tsx` пропускал в
   `<Link href>` любые значения `page_blocks.primary_url`/`secondary_url` вне allowlist
   (`javascript:`, `data:`, `vbscript:`, `//evil.com`, обходы с пробелами/backslash).
3. **Как работало до:** проверялся только внешний вид ссылки по
   `/^(https?:|mailto:|tel:)/i`; всё остальное шло в Next `Link` без санации
   (потенциальный Stored XSS).
4. **Что изменено:** добавлена чистая функция `sanitizeCmsHref()` (новый модуль
   `lib/cms/href.ts`): разрешены `https:`, `http:`, `mailto:`, `tel:`, относительные пути
   с одинарным `/` и якоря `#`; всё остальное → `'#'`. `CmsLink` использует результат
   для обоих вариантов рендера. Дизайн кнопок не изменён.
5. **Файлы:** `product-page/lib/cms/href.ts` (новый),
   `product-page/components/cms/PageRenderer.tsx`,
   `product-page/tests/cms-href.test.ts` (новый).
6. **Почему так:** allowlist надёжнее блеклиста; protocol-relative `//` и backslash-обходы
   заблокированы осознанно (контента с такими URL в seed/БД нет — проверено субагентом).
   Rich-text блоки и так защищены `sanitize-html` — их не трогали.
7. **Влияние:** CTA-кнопки CMS-страниц сохраняют текущий вид и легитимные ссылки
   (`/case/design/m/2-0`, `#advantages`, внешние https).
8. **Риск:** низкий; если редактор заведомо указывал bare-слаг (`privacy-policy`) — станет
   `'#'` (такого контента сейчас нет).
9. **Как проверить:** `pnpm run test:audit-fixes` — 9 разрешённых кейсов проходят, 13
   опасных (включая регистр/пробелы/табуляцию/backslash) → `'#'`; smoke-рендер
   `/privacy-policy` и `/public-offer` — 200, ссылки целы (см. VERIFICATION.md).
10. **Статус:** **выполнено**.

---

## [2026-11-13] C-16 — Базовые HTTP security headers

1. **ID проблемы:** C-16 (подтверждён субагентом Security & CMS, live `curl`).
2. **Что было неправильно:** `headers()` в `next.config.js` возвращал `[]` вне staging;
   на Production отсутствовали X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
   Permissions-Policy, CSP (live-проверка показала только платформенный HSTS).
3. **Как работало до:** на staging добавлялся только `X-Robots-Tag: noindex, nofollow`.
4. **Что изменено:** для всех окружений всегда отдаются 5 защитных заголовков:
   `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
   `Referrer-Policy: strict-origin-when-cross-origin`,
   `Permissions-Policy: camera=(), microphone=(), geolocation=()`,
   минимальный CSP `frame-ancestors 'self'; base-uri 'self'; object-src 'none'`;
   `X-Robots-Tag` сохранён для non-production (логика C-09).
5. **Файлы:** `product-page/next.config.js` (совмещено с фиксом C-09),
   `product-page/tests/robots-env.test.ts`.
6. **Почему так:** минимальный CSP намеренно без `script-src`/`style-src` — не блокирует
   Next.js-ресурсы, R2-картинки (`media.carzo.com.ua`), ссылки Telegram/WhatsApp/Viber и
   будущую аналитику; строгая CSP без проверки совместимости по заданию не внедрялась.
   HSTS не дублируется (управляет Vercel).
7. **Влияние:** защита от clickjacking, MIME-sniffing, утечки referrer; рост оценок
   сканеров безопасности.
8. **Риск:** низкий; `X-Frame-Options: SAMEORIGIN` запретит сторонний фрейминг (задумано).
9. **Как проверить:** unit-тесты C-16 (4 кейса) + `curl -sI` локального production-сервера —
   все 5 заголовков присутствуют (см. VERIFICATION.md). После деплоя — `curl -sI` на
   Production и Preview.
10. **Статус:** **выполнено**.

---

## [2026-11-13] NEW-10 — JSON-LD Product согласован с canonical

1. **ID проблемы:** NEW-10 (подтверждён субагентом SEO).
2. **Что было неправильно:** на брендированных URL `/case/design/{size}/{design}/{brand}`
   JSON-LD нёс брендовый `name` («… для BMW»), брендовый `url` (`.../bmw`) и базовую цену
   без наценки логотипа (2249 против 2539 в UI), при том что canonical указывал на
   базовую страницу `/case/design/m/2-0`.
3. **Как работало до:** `productSchema` строился от `parsed.params` с реальным брендом
   (`app/case/design/[...slug]/page.tsx`).
4. **Что изменено:** name/url/description JSON-LD строятся от канонических параметров
   (`brandId: 'none'`) — совпадают с `<link rel="canonical">` и с JSON-LD базовой
   страницы. Визуальные цены, корзина, Supabase не тронуты.
5. **Файлы:** `product-page/app/case/design/[...slug]/page.tsx`.
6. **Почему так:** канонические URL и так срезают бренд; вариант «+290 ₴ к offers.price»
   остаётся бизнес-решением (зависит от клиентского состояния фиксации) — по заданию
   бизнес-логика не менялась; этот вариант оставлен Codex/владельцу (см. CODEX_HANDOFF).
7. **Влияние:** устраняется расхождение микроразметки с canonical; Rich Results будут
   описывать каноническую страницу.
8. **Риск:** низкий; брендовые URL теряют брендовый текст в JSON-LD (поисковики и так
   канонизируют эти URL).
9. **Как проверить:** live-проверка на production-сборке — JSON-LD брендированной
   страницы `/case/design/m/2-0/bmw`: name/url/price идентичны базовой странице,
   canonical = `/case/design/m/2-0` (см. VERIFICATION.md).
10. **Статус:** **выполнено**.

---

## [2026-11-13] C-11 — Диагностика изображений (без изменений кода)

1. **ID проблемы:** C-11 (замеры субагентом Catalog & Media).
2. **Что установлено:** `/carmat-mobile.png` (2 292 986 Б) скачивается **и десктопом, и
   мобайлом** (оба `<img>` в DOM, без `loading`); миниатюры галереи используют URL
   оригиналов, но двойной загрузки в галерее нет (одинаковые URL дедуплицируются кешем);
   на R2-ассетах отсутствует `Cache-Control` (`cf-cache-status: DYNAMIC`) — это
   конфигурация CDN, не кода.
3. **Изменения:** не вносились (по заданию — только диагностика).
4. **Простое безопасное предложение:** сжать `public/carmat-mobile.png` в WebP
   (~150–250 КБ) и переключить `src`; опционально `loading="lazy"` для десктопного
   варианта баннера. Вынесено в CODEX_HANDOFF для отдельного решения.
5. **Статус:** **диагностика выполнена**, оптимизация **отложена** (по заданию).
