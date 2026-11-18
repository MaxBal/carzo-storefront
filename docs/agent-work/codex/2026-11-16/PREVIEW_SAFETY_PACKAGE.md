# CARZO — защита legacy интеграций в Preview

Дата: 16.11.2026. Пакет подготовлен по поручению владельца продолжить защиту Directus/carmat и план изоляции. База: origin/main baf997e4359bfd41cdacf315ceefdc15ce956c82. Собственная ветка codex/preview-legacy-integration-guards; production-baseline patch и чужие ветки в этот PR не включаются.

## Актуальное дополнение — одна база до запуска, 18 ноября 2026

По решению владельца отдельный hosted-проект сейчас не требуется. Актуальная процедура общей базы — PREVIEW_ISOLATION_HANDOFF.md. Ниже сохранено описание первоначального пакета и варианта полной изоляции.

Новый SUPABASE_ALLOW_SHARED_PREVIEW=true разрешает существующую Supabase только при target=preview, совпадающем точном ref и HTTPS origin. Он не разрешает другие интеграции. В этом режиме Supabase order/quote notifications блокируются до чтения настроек/credentials; delivery core блокируется даже с test chat IDs. Default остаётся fail-closed. Production routing сохраняется. Это доступ к общей БД, а не изоляция; env и rollout в этом дополнении не применялись.

## Изменения кода

Один predicate isVercelProduction разрешает legacy рабочие операции только при точном VERCEL_ENV=production. NODE_ENV=production, unset, preview, development и custom-staging не дают разрешения. SUPABASE_ALLOW_SHARED_PREVIEW не изменяет этот predicate и не разрешает legacy интеграции.

| Граница | Production | Остальные окружения |
|---|---|---|
| createDirectusOrderRepository.createOrder | прежняя запись и snapshot | OrderStoreError WRITE_FAILED до чтения credentials, генерации body и POST |
| notifyNewOrder, Directus path | прежние email/Telegram назначения | выход до запроса настроек/токенов; статический warning |
| notifyNewCarMatQuote, legacy Directus path | прежняя доставка | false до запроса настроек/токенов |
| deliverCarMatQuoteTelegram, отдельный бот | прежний sender | false до чтения credentials, sendMessage и diagnostics getMe/getChat |
| Supabase order notifications | без изменений | прежние TELEGRAM_TEST_CHAT_IDS routing и блокировка при отсутствии test recipients |

Guard не скрывает ошибку заявки на коврики успешным ответом: существующий action получает false и показывает ошибку отправки. Для заказа Directus существующий error handler сохраняет корзину и возвращает FAILED. Локальный next start также блокируется по умолчанию; production-like тесты используют synthetic env и mock fetch, не рабочие ключи.

После дополнительной проверки пакет расширен в том же PR №12:

- Общая проверка Supabase target применяется ко всем трём клиентам: admin, editorial и pages. Вне Production удалённый backend требует SUPABASE_PREVIEW_PROJECT_REF и точного HTTPS origin этого проекта. Рабочий project ref kmhegysmtsjqtwwaacht по умолчанию запрещён даже при включении в эту настройку; shared Preview является явным исключением, описанным выше. Это защищает order RPC, customer upsert/lookup и чтения через отдельные клиенты.
- Локальные loopback URL разрешены только без VERCEL и VERCEL_ENV: для Supabase CLI/Docker или synthetic server. На Vercel loopback запрещён. Другие custom domains/proxy URL по умолчанию не разрешены.
- Directus customer lookup и обе ветки регистрации (collection POST и singleton registry PATCH) блокируются до чтения credentials/клиентских данных.
- keyCRM: checkout sync возвращает disabled, непосредственное создание заказа отклоняется, webhook возвращает 503 disabled_environment до чтения keyCRM и записи клиента. Только VERCEL_ENV=production сохраняет прежнюю обработку.

Изолированные Supabase order/customer writes доступны с собственным тестовым ключом и явно указанным отдельным проектом; флаг общей базы не разрешает другие интеграции. Telegram через Supabase по-прежнему использует только TELEGRAM_TEST_CHAT_IDS вне Production. Dedicated carmat и legacy Directus sender остаются отключены; для них использовать mocks.

Это защита текущих приложенческих границ, не отзыв credentials и не сетевая песочница. Отдельный staging-проект, развёрнутый с VERCEL_ENV=production, пройдёт predicate; его изоляция должна обеспечиваться собственными credentials и отдельной проверкой целевого проекта. Не подменять системное VERCEL_ENV ради тестов с рабочими ключами. При смене рабочего Supabase-проекта обновить защищённый публичный ref в lib/supabase/environment.ts.

## Проверки дополнения 18 ноября

- 467 safe unit/mock tests / 74 suites — PASS.
- 138 tests команды test:preview-safety — PASS, включая opt-in, отклонение других targets/origins, mock RPC/customer POST и отсутствие отправок при унаследованных credentials.
- Production notification routing проверен с shared-флагом через mocks; поведение сохраняется.
- TypeScript — PASS; ESLint — без ошибок, 10 прежних warnings.
- Build — PASS с synthetic localhost backend и ожидаемым editorial fallback. Первый запуск не загрузил Google Fonts без сетевых proxy-настроек; повтор с восстановленными proxy-настройками прошёл. Это не проверка живого контента или браузерного checkout.
- Реальные заказы, внешние уведомления, SQL, Vercel env и deployments в этом дополнении не изменялись.

## Проверки первоначального пакета

- До guard: первые 9 новых тестов дали 8 FAIL / 1 PASS (production compatibility). В частности, Preview разрешал Directus POST и вызывал carmat sender.
- Новая suite содержит 13 проверок: preview, development, unknown/unset; отдельные write и notification assertions; NODE_ENV=production при non-production target; случайно присутствующие credentials; запрет diagnostics; production destinations через mocks.
- Первоначальный пакет от main: 447 safe unit/mock PASS / 72 suites; tsc PASS; ESLint PASS, прежние 10 warnings; synthetic next build PASS.
- Совместимость с #4–10 и известным baseline patch: commit локально применён к /workspace/carzo-baseline-composition без конфликтов, baseline patch остался отдельными незакоммиченными изменениями. 553 safe unit/mock PASS / 84 suites; tsc PASS.
- Build полной композиции: PASS (exit 0), синтетический PostgREST localhost:4320, без live credentials. Публичные static/data-cache границы сохранились.
- В safe run исключены supabase-catalog-integration, supabase-editorial-integration, carmat-quote-supabase-integration и editorial-fallback-detection (live/env suites). Никаких реальных заказов, писем, Telegram-сообщений, keyCRM или записей в БД.

Запуск узкой проверки: из product-page выполнить npm run test:preview-safety. Скрипт использует node --import tsx и существующий server-only stub, новых зависимостей нет. Полный safe test run — тот же список тестов из предыдущего VERIFICATION.md.

Актуальная расширенная ветка: 463 safe tests / 74 suites PASS, в том числе 134 tests / 20 suites команды test:preview-safety. TypeScript и ESLint PASS (прежние 10 warnings). Synthetic next build PASS на localhost:4320, без рабочих credentials. Новые проверки требуют нулевых сетевых обращений при ошибочно выданных synthetic credentials и неверной цели. Положительный Preview тест проверяет маршрутизацию order RPC и customer POST только в явно разрешённый тестовый origin через mock fetch. Production compatibility также проверяется только mock transport. Более ранняя проверка композиции 553 tests относится к первоначальному пакету; расширение пока не проверено в той композиции.

## План env: подготовлен, НЕ применён

| Настройка | Предложенное состояние Preview | Что требуется / проверка |
|---|---|---|
| SUPABASE_URL + SUPABASE_SECRET_KEY | отдельная подтверждённая тестовая БД, собственный ключ | отдельно согласовать ресурс/бюджет; не копировать клиентские данные; сравнить назначения без вывода ключей |
| SUPABASE_PREVIEW_PROJECT_REF | ref отдельного hosted тестового проекта | совпадение с SUPABASE_URL обязательно; рабочий ref отклоняется кодом; локальный Docker не требует этой настройки |
| Production key assignment | убрать Preview target только после подготовки замены | Production target не менять; не удалять secret целиком по общему ID |
| CATALOG_STORE, CONTENT_STORE, PAGE_STORE, ORDER_STORE, CUSTOMER_STORE, NOTIFICATION_SETTINGS_STORE | явно supabase в нужных Preview branch scopes | отсутствие флага не допускается как конфигурация теста, даже с новым guard: чтение всё ещё может выбирать Directus |
| DIRECTUS_READ_TOKEN / DIRECTUS_URL | убрать рабочие credentials из Preview; старые сервисы сохранить | guard — второй барьер, не замена управления секретами; учесть dev/ветки и уже выпущенные deployments |
| KEYCRM_SYNC_ENABLED | false в изолированном Preview | рабочие API key и webhook secret не выдавать тестовому контуру; реальные webhook не вызывать |
| TELEGRAM_BOT_TOKEN / TELEGRAM_TEST_CHAT_IDS | только тестовый бот и согласованные test chats для Supabase path | отсутствие credentials блокирует отправку; не проверять реальным рабочим sendMessage |
| TELEGRAM_CARMAT_* | не выдавать рабочие credentials Preview | этот PR блокирует весь dedicated sender вне Production; отдельный тестовый transport не реализован, использовать mock tests |
| SITE_URL | согласованный production canonical origin либо отдельный origin согласно SEO плану | текущий fallback не является доказанным дефектом; Preview noindex проверить после разрешённой сборки |
| Function region | отдельное решение после latency benchmark | использовать код региона Vercel, а не AWS eu-west-1; изменения не включены |

Не делать массовое изменение всех Preview scopes без инвентаризации dev и существующих assignments. Новые project env scopes повлияют на новые builds; старые deployments сохраняют прежние снимки. Изменение scopes не отзывает выданный раньше ключ. Нужен отдельный план ограничения старых Preview deployments либо управляемой ротации/отзыва ключа с владельцем. Не удалять/отключать deployment и не ротировать ключ автоматически; Production может зависеть от него.

## Последовательность после ревью

1. Владелец проверяет и отдельно разрешает merge пакета. До merge/развёртывания guard не защищает существующие Preview.
2. Согласовать конкретные Preview assignments и изолированный backend. При ошибке держать Preview без write-тестов; не восстанавливать Production credentials автоматически.
3. После отдельного разрешения создать чистую сборку нужной композиции и подтвердить deployment SHA, env назначения и отсутствие рабочей маршрутизации.
4. Только затем разрешать isolated checkout/cache mutation/concurrency тесты. Известный dirty Production snapshot остаётся UNKNOWN; этот пакет его не восстанавливает.

Rollback кода в Production — только по отдельному решению. Для Preview безопасное состояние при сбое — заблокированные legacy write/send paths и отсутствие рабочих credentials, а не возврат общего ключа.

Vercel/env/SQL/регион/тарифы и реальные интеграции в рамках пакета не менялись. Production merge и deployment не выполнялись.
