# CARZO — проверка кандидата 9ffa6da

Дата: 18 ноября 2026. Проверяемая ветка: xiaomi/prelaunch-integration-review, исходный SHA 9ffa6dab8fe8dff97ddeba307cc0d167a6a403b4.

## Состав

Git ancestry подтверждает включение текущих heads PR №4, 5, 6, 7, 8, 9, 10 и 12, включая f110017. Известный production baseline 437f399 также является предком. Merge baseline содержит 8 файлов, +78/−9, что соответствует переданному patch. Это не подтверждает неизвестный dirty snapshot работающего deployment.

## PRELAUNCH-01 — P2: cached catalog client пропускает target policy

PR №7 добавил отдельный getRevalidatingCatalogClient в product-page/lib/data/catalog/supabase.ts. В композиции он создавал elevated Supabase client без assertSafeSupabaseTarget из PR №12. loadCatalog({cache:'revalidate'}) начинал запросы к общей БД без opt-in и к неразрешённому origin.

Это SELECT-путь каталога; обход записи заказов этим тестом не обнаружен. Риск: несогласованное чтение и передача Authorization header по ошибочному SUPABASE_URL. Проверки остальных client factories не защищают эту отдельную factory.

Исправление: та же assertSafeSupabaseTarget перед createClient. Cache policy, published filters и конфигурация разрешённых targets не менялись.

Четыре regression cases проверяют default deny, deny чужого origin при shared flag, разрешённый shared Preview и Production. Все HTTP обращения перехватываются mock fetch, credentials синтетические. До исправления: 2 FAIL / 2 PASS; после — все случаи проходят в полном safe run.

## Проверки исправленной композиции

- Safe unit/mock run: 577 tests / 86 suites, PASS.
- TypeScript: PASS.
- ESLint: PASS, 10 прежних warnings.
- Synthetic production build: PASS (exit 0), loopback PostgREST fixture localhost:4320 и synthetic-only key. Это не проверка live content или браузерного checkout.
- Live/env suites исключены; реальные Supabase/R2/Telegram/keyCRM записи и отправки не выполнялись.

## Перед Preview

Добавить этот отдельный fix commit к кандидату обычным cherry-pick и зафиксировать новый SHA. Предложенный branch-specific env diff соответствует shared-mode f110017, но здесь не применялся. Перед browser write-test нужны подтверждённые branch overrides, Deployment Protection, target=preview и deployment SHA уже с исправлением. Выбор test phone не должен приводить к merge существующего customer; заранее проверять отсутствие совпадения, сохранять точные IDs тестовых записей.

Main/dev, рабочий deployment, env и данные не менялись. Изменения подготовлены в собственной feature-ветке codex/prelaunch-catalog-target-guard; исходная ветка Xiaomi сохранена.
