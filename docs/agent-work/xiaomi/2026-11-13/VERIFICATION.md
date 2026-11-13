# VERIFICATION — Xiaomi MiMo (13 ноября 2026)

Протокол проверок. **PASS ставится только если проверка фактически выполнялась.**
Не запускались интеграционные тесты, пишущие реальные данные в Production Supabase.

---

## 0. Исходное состояние (2026-11-13, до изменений)

| Проверка | Команда | Результат |
| --- | --- | --- |
| Git status | `git status --porcelain=v1 -b` | `main...origin/main [ahead 1]`, untracked `docs/audits/` |
| Текущая ветка | `git branch --show-current` | `main` |
| HEAD SHA | `git rev-parse HEAD` | `f8e0e63c9cda807d13a30b0b90970d4717298893` |
| origin/main SHA | `git rev-parse origin/main` | `baf997e4359bfd41cdacf315ceefdc15ce956c82` |
| Содержимое незапушенного коммита | `git show --stat f8e0e63` | только `AGENTS.md`, `.gitignore` (чужое, в PR не входит) |
| Ветка `fix/xiaomi-audit-2026-11-13` | `git branch -a` | отсутствовала → создана от `origin/main` |

---

## 1. Субагенты (исследование, read-only)

Все 4 субагента выполнены реальной системой `actor`, режим read-only. Сводка:
[SUBAGENTS_REPORT.md](./SUBAGENTS_REPORT.md).

| Субагент | Статус | Ключевой итог |
| --- | --- | --- |
| SEO Auditor | завершён | NEW-04, C-09, NEW-10 — CONFIRMED |
| Security & CMS Auditor | завершён | NEW-06, C-16 — CONFIRMED (live curl подтверждён) |
| Catalog & Media Auditor | завершён | C-07 — CONFIRMED (латентный); C-11 — замеры выполнены |
| Vercel Infrastructure Auditor | завершён | все утверждения C-13/NEW-03 подтверждены + новая утечка `SUPABASE_SECRET_KEY` на preview |

---

## 2. Качество кода

| Проверка | Команда | Результат |
| --- | --- | --- |
| TypeScript | `pnpm exec tsc --noEmit` | **PASS** (0 ошибок; первые 2 прогона дали 3 ошибки в новых тестах — исправлены, повторный прогон чистый) |
| ESLint | `pnpm run lint` | **PASS** (exit 0; warnings только предсуществующие в не тронутых файлах: `no-img-element`, `alt-text`) |
| Новые unit-тесты | `pnpm run test:audit-fixes` | **PASS** — 35/35 (C-07: 3, NEW-06: 22, C-09: 5, C-16: 4 + вложенные) |
| Production build | `pnpm run build` с `*_STORE=supabase` и `.env.local` (read-only SELECT) | **PASS** (первый запуск без env упал на prerender `sitemap.xml`/`llms.txt` с «Directus catalog is not configured» — предсуществующая зависимость сборки от env, не регрессия; с env Production-конфигурации сборка проходит) |

### Существующие тест-сьюты (без записи в Production)

| Сьют | Результат |
| --- | --- |
| `test:loyalty` | PASS 40/40 |
| `test:customer-store` | PASS 32/32 |
| `test:checkout-reliability` | PASS 12/12 |
| `test:shipping` | PASS 41/41 |
| `test:payment` | PASS 16/16 |
| `test:keycrm` | PASS 64/64 |
| `test:order-notifications` | PASS 39/39 |
| `test:stage9-prep` | PASS 13/13 |
| `test:carmat-telegram` | PASS 19/19 |
| `test:stage4` | PASS 19/19 |
| `test:stage6` | PASS 26/26 |
| `test:stage2a` | PASS (fail 0) |
| `test:stage8b-import` | PASS (fail 0) |
| `test:editorial-fallback` | PASS 3/3 (после копирования `.env.local`; первый запуск без env — не стартовал) |
| `test:supabase-catalog` (read-only, живая БД) | PASS 8/8 — каталог читается, цены корзины рассчитываются |

### Не запускались

| Сьют | Причина |
| --- | --- |
| `test:supabase-editorial` | интеграционный, требует живой БД/`.env.local`; риски не нужны, покрытие дублируется юнит-тестами и `test:supabase-catalog` |
| `test:carmat-supabase` | интеграционный с `.env.local`, по политике задания не запускается против Production-данных |
| `test-checkout.py` (Playwright, корень) | по AGENTS.md устарел (старый UI), требует staging/Playwright; не входит в задачу |
| Playwright/браузерная проверка UI | среда не имела готового браузерного прогона в этой задаче; вместо этого — smoke-curl production-сборки (см. §5) |

---

## 3. SEO-маршруты (локально на production-сборке, `next start`, STORE-флаги как в Production)

| Проверка | Результат |
| --- | --- |
| `sitemap.xml` содержит `/catalog-carmat` | **PASS** — ровно 1 раз |
| Дубли URL в sitemap | **PASS** — `uniq -d` пуст (17 URL, все уникальны) |
| `llms.txt` содержит `/catalog-carmat` | **PASS** — строка «Автокилимки CARZO» в «Основні сторінки» |
| `robots.txt` (production-сценарий, `VERCEL_ENV` не задан) | **PASS** — `Allow: /`, `Disallow: /api/`, sitemap+host присутствуют |
| `robots()` при `VERCEL_ENV=production` / `preview` / `development` / unset / legacy-staging URL | **PASS** — unit-тесты `tests/robots-env.test.ts` (5 кейсов) |
| canonical `/case/design/m/2-0/bmw` | **PASS** — `<link rel="canonical">` = `https://carzo-storefront.vercel.app/case/design/m/2-0` |
| JSON-LD Product на брендированном URL | **PASS** — name «Автокейс M Carzo 2.0», url = canonical, price 2249, `offers.url` = canonical; идентично базовой странице `/case/design/m/2-0` |

---

## 4. HTTP-заголовки (локально на production-сборке, `curl -sI`)

| Проверка | Результат |
| --- | --- |
| `X-Content-Type-Options: nosniff` | **PASS** |
| `X-Frame-Options: SAMEORIGIN` | **PASS** |
| `Referrer-Policy: strict-origin-when-cross-origin` | **PASS** |
| `Permissions-Policy: camera=(), microphone=(), geolocation=()` | **PASS** |
| `Content-Security-Policy: frame-ancestors 'self'; base-uri 'self'; object-src 'none'` | **PASS** |
| `X-Robots-Tag` на production-сценарии отсутствует | **PASS** (локально не выставляется) |
| `X-Robots-Tag: noindex, nofollow` на preview / legacy staging | **PASS** — unit-тесты C-16 (4 кейса) |
| Заголовки на реальном Vercel Preview/Production | **не проверялись** (деплой не выполняется по заданию); логика покрыта тестами |

---

## 5. CMS-ссылки и визуальные смоуки

| Проверка | Результат |
| --- | --- |
| Разрешённые href (https, http, mailto, tel, `/path`, `#anchor`, `/path#frag`) | **PASS** — 9 кейсов |
| Опасные href (`javascript:`, `data:`, `vbscript:`, `//evil.com`, пробелы/табуляция, backslash, bare slug, пустые) | **PASS** — 13 кейсов → `'#'` |
| Рендер CMS-страниц `/privacy-policy`, `/public-offer` | **PASS** — 200, внутренние и внешние ссылки целы, кнопки не сломаны |
| Главная `/` и товарная `/case/design/m/2-0` | **PASS** — 200 |
| Визуальные регрессии (пиксель-сравнение) | **не выполнялись** (нет браузерного прогона); изменения в UI-разметке отсутствуют — модифицированы только `href` в `CmsLink` и серверные метаданные |

---

## 6. Цены и скидки (регрессии)

| Проверка | Результат |
| --- | --- |
| `test:supabase-catalog` (read-only, живая БД) — цены корзины | **PASS** 8/8 |
| Идентичность цен до/после для published-данных | **PASS** по построению: изменение только добавляет `.eq('status','published')`; в живой `discount_tiers` все строки `published` (2 шт.) — выход маппера идентичен; подтверждено интеграционным тестом |
| draft/archived `discount_tiers` исключаются | **PASS** — мок-тест (фикстура с draft+archived → в каталоге только published) |
| Корзина / checkout код не изменялся | **PASS** — `git diff` не затрагивает `lib/cart/*`, `app/actions/checkout.ts`, `lib/data/orders/*` |

---

## 7. Мобильная / десктопная версии (C-11, диагностика)

Замеры субагентом (curl по URL из живого HTML Production, 2026-11-13):

| Ассет | Байт | Десктоп | Мобайл | Кеш |
| --- | --- | --- | --- | --- |
| `/carmat-mobile.png` | 2 292 986 | качается (двойной `<img>` в DOM) | качается | `public, max-age=0, must-revalidate` |
| `cover-video.webp` (R2) | 272 464 | качается | качается | Cache-Control **отсутствует**, `cf-cache-status: DYNAMIC` |
| галерея `01/02.webp` (R2) | 63–64 КБ | качается (URL оригинала в миниатюре) | качается | Cache-Control **отсутствует** |

- Реальная Network-панель браузера **не использовалась** (числа — curl); вывод о загрузке
  `display:none`-картинок — уровень спецификации/кода, не browser-verified.
- Двойной загрузки миниатюр галереи **нет** (одинаковые URL дедуплицируются) — тезис аудита
  о двойной загрузке миниатюр не подтвердился.
- Простое предложение (WebP для `carmat-mobile.png`) вынесено в CODEX_HANDOFF — **не внедрено**.

---

## 8. Production / Preview конфигурация Vercel (read-only, без раскрытия секретов)

Выполнено субагентом через Vercel CLI (аутентификация уже существовала); **изменений не было**.

| Проверка | Результат |
| --- | --- |
| Function Region | `iad1` (без failover); Supabase в `eu-west-1` — трансатлантические запросы |
| Возможность `iad1`→`dub1` на текущем тарифе | по актуальным докам Vercel — один регион на hobby выбрать можно (включая `dub1`); **не переключалось**, требуется решение владельца |
| 6 STORE-флагов Production | все `supabase` |
| 6 STORE-флагов Preview[dev] | 5× `supabase`; **`CUSTOMER_STORE=directus` — баг подтверждён** |
| STORE-флаги Preview[feature/*] | **отсутствуют** (код падает в дефолт `directus` — подтверждено `env pull --git-branch`) |
| Изоляция Supabase | публичных ключей нет; **новая находка: `SUPABASE_SECRET_KEY` выдаётся всем preview-веткам** |
| `DIRECTUS_ADMIN_TOKEN` в Production | присутствует (риск) |
| Root Directory | `product-page` (верно); `.vercel/project.json` без токенов |
| Автодеплой GitHub | push-автодеплой отключён (деплой CLI), productionBranch `main` |
| Deployment Protection preview | включена |

Перечень безопасных действий (не выполнены) — в [CODEX_HANDOFF.md](./CODEX_HANDOFF.md).

---

## 9. Прочее

- **Production и база данных не изменялись.** Все обращения к Supabase — только SELECT
  (юнит-моки и один read-only интеграционный сьют). Vercel — только чтение. Деплои не
  выполнялись. Значения секретов в документацию не попали.
- `.env.local` скопирован в worktree только для сборки/тестов и **игнорируется git**
  (в diff не входит — проверено `git status`).
