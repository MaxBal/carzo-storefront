# CODEX HANDOFF — Xiaomi MiMo → OpenAI Codex

**Важно:** проверяйте фактический Git diff этой ветки относительно `origin/main`
(`baf997e4359bfd41cdacf315ceefdc15ce956c82`), а не только выводы в этом документе.
Документ — навигация и контекст; истина — в diff и в коде.

## 1. Git-идентификаторы

| Параметр | Значение |
| --- | --- |
| Исходный SHA (`origin/main`, база ветки) | `baf997e4359bfd41cdacf315ceefdc15ce956c82` |
| Локальный `main` на момент старта (чужой коммит, НЕ входит в работу) | `f8e0e63c9cda807d13a30b0b90970d4717298893` (`AGENTS.md`, `.gitignore`) |
| Рабочая ветка | `fix/xiaomi-audit-2026-11-13` |
| Конечный SHA | вершина ветки `fix/xiaomi-audit-2026-11-13` (`git rev-parse HEAD`); порядок коммитов — §2 |
| Pull Request | см. ссылку в конце документа (обновляется после создания PR) |

Worktree для независимой локальной проверки: `/Users/qq/Documents/GitHub/carzo-xiaomi-audit-2026-11-13`
Валидация перед ревью: `cd product-page && pnpm install && pnpm exec tsc --noEmit &&
pnpm run lint && pnpm run test:audit-fixes && pnpm run build` (для build нужны env-переменные
Supabase, см. `.env.example`; сборка выполняет только чтение каталога).

## 2. Перечень изменённых файлов (ровно эти файлы в diff)

| Файл | Коммит-группа | Изменение |
| --- | --- | --- |
| `product-page/lib/data/catalog/supabase.ts` | C-07 | `+{ publishedOnly: true }` для `discount_tiers` |
| `product-page/tests/supabase-catalog-published-filter.test.ts` | C-07 | новый тест (мок PostgREST) |
| `product-page/package.json` | C-07 | скрипт `test:audit-fixes` |
| `product-page/app/sitemap.ts` | NEW-04 | запись `/catalog-carmat` |
| `product-page/app/llms.txt/route.ts` | NEW-04 | строка «Автокилимки CARZO» |
| `product-page/app/robots.ts` | C-09 | `isNonProduction` через `VERCEL_ENV` |
| `product-page/next.config.js` | C-09+C-16 | `isNonProduction` + 5 security headers |
| `product-page/tests/robots-env.test.ts` | C-09+C-16 | 9 тестов окружений/заголовков |
| `product-page/lib/cms/href.ts` | NEW-06 | новый `sanitizeCmsHref` |
| `product-page/components/cms/PageRenderer.tsx` | NEW-06 | `CmsLink` через `sanitizeCmsHref` |
| `product-page/tests/cms-href.test.ts` | NEW-06 | 22 allowlist-теста |
| `product-page/app/case/design/[...slug]/page.tsx` | NEW-10 | JSON-LD от канонических параметров |
| `docs/agent-work/xiaomi/2026-11-13/*` | docs | README, CHANGELOG, VERIFICATION, SUBAGENTS_REPORT, CODEX_HANDOFF |

## 3. Исправленные проблемы и технические решения

1. **C-07 (выполнено).** `discount_tiers` читался без фильтра статуса при том, что в таблице
   есть колонка `status` (live-проверка: 2 строки, обе `published`). Решение — одна строка:
   `{ publishedOnly: true }` (как у остальных каталог-таблиц и в старом Directus-адаптере).
   Тест мокает `globalThis.fetch` (supabase-js резолвит fetch в момент вызова) и проверяет,
   что уходит `status=eq.published`, а draft/archived из фикстуры не попадают в каталог.
2. **NEW-04 (выполнено).** Добавлены `/catalog-carmat` в `sitemap.ts` (weekly/0.8) и в
   `llms.txt`. Дубли исключены (`Map` в sitemap; CMS-slug `catalog-carmat` не существует).
3. **C-09 (выполнено).** Детекция Preview через `VERCEL_ENV !== 'production'` (с сохранением
   legacy-проверок URL — staging-проект деплоится с `VERCEL_ENV=production`). Production
   индексируется; preview/development — нет; локальная разработка (`VERCEL_ENV` не задан)
   не меняется.
4. **NEW-06 (выполнено).** `sanitizeCmsHref` (allowlist: `https:`, `http:`, `mailto:`, `tel:`,
   `/…` без `//`, `#…`; иначе `'#'`) — закрывает `javascript:`/`data:`/`vbscript:` и обходы
   (пробелы, табуляция, backslash). Дизайн CMS-кнопок не изменён.
5. **C-16 (выполнено).** 5 защитных заголовков всегда (nosniff, SAMEORIGIN,
   strict-origin-when-cross-origin, Permissions-Policy, минимальный CSP
   `frame-ancestors/base-uri/object-src`). Строгая CSP (script-src/style-src) НЕ внедрялась —
   по заданию требуется отдельная проверка совместимости с Next.js/R2/мессенджерами/аналитикой.
6. **NEW-10 (выполнено).** JSON-LD Product строится от `brandId: 'none'` — name/url/price
   согласованы с canonical (проверено live на локальной production-сборке).

## 4. Новые тесты

- `tests/supabase-catalog-published-filter.test.ts` — 3 теста (C-07): запрос с
  `status=eq.published`, исключение draft/archived, фильтр только для status-таблиц.
- `tests/cms-href.test.ts` — 22 теста (NEW-06): 10 разрешённых форм + 13 запрещённых.
- `tests/robots-env.test.ts` — 9 тестов (C-09+C-16): `robots()` и `headers()` для
  production/preview/development/unset/legacy-staging.
- Запуск: `pnpm run test:audit-fixes` (скрипт добавлен в `package.json`).

## 5. Результаты проверок (детали — VERIFICATION.md)

- `tsc --noEmit` PASS; `lint` PASS; `build` PASS (с env Production-конфигурации).
- `test:audit-fixes` 35/35 PASS; 13 существующих юнит-сьютов PASS (суммарно ~330 тестов);
  `test:supabase-catalog` (read-only живая БД) 8/8 PASS.
- Не запускались: `test:supabase-editorial`, `test:carmat-supabase` (интеграционные против
  живой БД), `test-checkout.py` (устаревший Playwright).
- SEO live-проверка локальной production-сборки: sitemap/llms/robots/canonical/JSON-LD — PASS.
- Заголовки live: все 5 security headers присутствуют — PASS.

## 6. Результаты диагностики изображений (C-11)

- `/carmat-mobile.png` (2 292 986 Б) скачивается и десктопом, и мобайлом (оба `<img>` без
  `loading`; браузеры фетчат `display:none`-картинки — код-уровень, не browser-verified).
- Миниатюры галереи используют URL оригиналов (63–64 КБ webp), но **двойной загрузки нет**
  (дедупликация по URL) — тезис аудита о двойной загрузке миниатюр не подтвердился.
- На R2-ассетах нет `Cache-Control` (`cf-cache-status: DYNAMIC`) — проблема конфигурации
  Cloudflare/R2, не кода приложения.
- **Простое безопасное предложение (НЕ внедрено):** сжать `public/carmat-mobile.png` в WebP
  (~150–250 КБ) и поменять `src` в `components/car-mats/CarmatPageContent.tsx:76`; опционально
  `loading="lazy"` для десктопного варианта баннера. Глобальную оптимизацию Next.js и
  архитектуру изображений не менять — это отдельное решение.
- Ограничение замеров: без реальной Network-панели браузера (curl по URL из живого HTML).

## 7. Read-only проверка Vercel + перечень безопасных действий

Проверено (Vercel CLI, ничего не менялось): регион `iad1` (Supabase в `eu-west-1`); Production:
6× `supabase`; Preview[dev]: `CUSTOMER_STORE=directus` (**баг**); Preview[feature/*]:
STORE-флагов нет (дефолт `directus`); **новое: `SUPABASE_SECRET_KEY` выдаётся всем
preview-веткам**; `DIRECTUS_ADMIN_TOKEN` в Production; Root Directory `product-page`;
push-автодеплой выключен (деплой CLI); Deployment Protection на preview включена.

**SAFE ACTIONS FOR CODEX (НЕ выполнены Xiaomi, требуют явного статуса изменения):**
1. `CUSTOMER_STORE=supabase` для preview[branch=dev].
2. Проставить все 6 STORE-флагов `=supabase` для всех preview-веток (снять привязку к dev).
3. Удалить `DIRECTUS_ADMIN_TOKEN` из Production.
4. Сузить scope `SUPABASE_SECRET_KEY` — прекратить выдачу произвольным preview-веткам.
5. Добавить `SUPABASE_URL` на preview-ветки, где работают supabase-store-флаги.
6. Рассмотреть Function Region `iad1`→`dub1` (согласовать с владельцем).
7. Убрать `DIRECTUS_URL`/`DIRECTUS_READ_TOKEN` из preview после отказа от Directus-fallback.

**FORBIDDEN без разрешения владельца:** смена/ротация production-креденшелов; смена региона;
деплои; изменения доменов, Git-интеграции, защиты деплоев.

## 8. Оставшиеся риски

1. Строгая CSP не внедрялась (по ограничению задания) — `script-src`/`style-src` не заданы.
2. WebP-оптимизация `/carmat-mobile.png` не внедрена (по заданию) — 2.29 МБ на визит остаются.
3. R2/CDN без `Cache-Control` — вне кода, требует доступа к Cloudflare.
4. `X-Frame-Options: SAMEORIGIN` запретит сторонний фрейминг — намеренно, но проверьте
   отсутствие легитимных кейсов встраивания.
5. JSON-LD брендированных страниц теперь без брендового текста/наценки — если нужны rich
   results per-brand, это бизнес-решение (см. §9).
6. После деплоя нужно живое подтверждение заголовков/robots на реальном Preview и Production
   (сейчас покрыто только unit-тестами и локальным `next start`).

## 9. Нерешённые вопросы

1. **NEW-10, альтернативный вариант:** при `brand !== 'none'` добавлять наценку логотипа
   (+290 ₴) в `offers.price` вместо канонического описания. Это бизнес-решение (UI-цена
   зависит и от выбранной фиксации) — Xiaomi его не выполнял. Решить владельцу/Codex.
2. Предложение по C-11 (WebP-сжатие мобильного баннера) — нужно одобрение на замену ассета.
3. `.env.example` содержит устаревший `SITE_URL=https://carzo-eight.vercel.app` — не трогал
   (вне списка задач); возможно, стоит актуализировать отдельно.

## 10. Что Codex должен независимо перепроверить

1. **Полный diff `fix/xiaomi-audit-2026-11-13` vs `origin/main`** — ровно перечень §2, никаких
   посторонних файлов (цен, корзины, checkout, чужих наработок, секретов, `.env*`).
2. Каждую проблему (C-07, NEW-04, C-09, NEW-06, C-16, NEW-10) по исходному коду и аудиту
   `docs/audits/antigravity/2026-11-13/`.
3. Тесты: ловят ли они реальную регрессию (а не сами себя); мок PostgREST корректно
   эмулирует eq-фильтры; кейсы allowlist полные.
4. Отсутствие новых багов и визуальных регрессий (CMS-кнопки, страница товара, sitemap).
5. Безопасность: опасные URL блокируются; security headers не ломают Next.js/R2/мессенджеры;
   секреты отсутствуют в diff и в документации.
6. SEO: sitemap/llms/robots/canonical/JSON-LD согласованы; Production индексируется, Preview — нет.
7. Цены/скидки/корзина/checkout для published-данных не изменились (сверить diff и
   `test:supabase-catalog` / `test:loyalty`).
8. **Выводы каждого субагента в [SUBAGENTS_REPORT.md](./SUBAGENTS_REPORT.md) — сверить с
   кодом и фактами независимо**, включая выводы Vercel-аудита (их подтверждают только
   чтение настроек проекта).
9. Явно сформулировать ошибочные предположения Xiaomi (если найдены).
10. Итог разделить на **PASS / FAIL / NEEDS_FOLLOWUP** по каждому пункту.
11. **Не выполнять merge в Production без разрешения владельца.**

## 11. Связанные документы

- [README.md](./README.md) — контекст, разрешённые/запрещённые задачи.
- [CHANGELOG.md](./CHANGELOG.md) — журнал всех действий Xiaomi (10 полей на каждое исправление).
- [VERIFICATION.md](./VERIFICATION.md) — протоколы проверок (что реально запускалось).
- [SUBAGENTS_REPORT.md](./SUBAGENTS_REPORT.md) — выводы 4 субагентов.

## 12. Pull Request

Ссылка на PR: _(обновляется ниже после создания)_

> PR создан для ветки `fix/xiaomi-audit-2026-11-13` в репозитории `MaxBal/carzo-storefront`.
> В описании PR есть ссылка на этот файл.
