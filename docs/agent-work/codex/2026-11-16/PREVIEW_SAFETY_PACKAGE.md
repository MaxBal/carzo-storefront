# CARZO — защита legacy интеграций в Preview

Дата: 16.11.2026. Пакет подготовлен по поручению владельца продолжить защиту Directus/carmat и план изоляции. База: origin/main baf997e4359bfd41cdacf315ceefdc15ce956c82. Собственная ветка codex/preview-legacy-integration-guards; production-baseline patch и чужие ветки в этот PR не включаются.

## Изменения кода

Один predicate isVercelProduction разрешает legacy рабочие операции только при точном VERCEL_ENV=production. NODE_ENV=production, unset, preview, development и custom-staging не дают разрешения. Новых переменных для обхода guard нет.

| Граница | Production | Остальные окружения |
|---|---|---|
| createDirectusOrderRepository.createOrder | прежняя запись и snapshot | OrderStoreError WRITE_FAILED до чтения credentials, генерации body и POST |
| notifyNewOrder, Directus path | прежние email/Telegram назначения | выход до запроса настроек/токенов; статический warning |
| notifyNewCarMatQuote, legacy Directus path | прежняя доставка | false до запроса настроек/токенов |
| deliverCarMatQuoteTelegram, отдельный бот | прежний sender | false до чтения credentials, sendMessage и diagnostics getMe/getChat |
| Supabase order notifications | без изменений | прежние TELEGRAM_TEST_CHAT_IDS routing и блокировка при отсутствии test recipients |

Guard не скрывает ошибку заявки на коврики успешным ответом: существующий action получает false и показывает ошибку отправки. Для заказа Directus существующий error handler сохраняет корзину и возвращает FAILED. Локальный next start также блокируется по умолчанию; production-like тесты используют synthetic env и mock fetch, не рабочие ключи.

Это точечная защита перечисленных границ, а не запрет всех записей приложения: Supabase order/customer writers и keyCRM webhook в пакет не входят. Отдельный staging-проект, развёрнутый с VERCEL_ENV=production, пройдёт predicate; его изоляция должна обеспечиваться собственными credentials и отдельной проверкой целевого проекта. Не подменять системное VERCEL_ENV ради тестов с рабочими ключами.

## Проверки

- До guard: первые 9 новых тестов дали 8 FAIL / 1 PASS (production compatibility). В частности, Preview разрешал Directus POST и вызывал carmat sender.
- Новая suite содержит 13 проверок: preview, development, unknown/unset; отдельные write и notification assertions; NODE_ENV=production при non-production target; случайно присутствующие credentials; запрет diagnostics; production destinations через mocks.
- Самостоятельная ветка от main: 447 safe unit/mock PASS / 72 suites; tsc PASS; ESLint PASS, прежние 10 warnings; synthetic next build PASS.
- Совместимость с #4–10 и известным baseline patch: commit локально применён к /workspace/carzo-baseline-composition без конфликтов, baseline patch остался отдельными незакоммиченными изменениями. 553 safe unit/mock PASS / 84 suites; tsc PASS.
- Build полной композиции: результат указан в финальном отчёте после завершения процесса.
- В safe run исключены supabase-catalog-integration, supabase-editorial-integration, carmat-quote-supabase-integration и editorial-fallback-detection (live/env suites). Никаких реальных заказов, писем, Telegram-сообщений, keyCRM или записей в БД.

Запуск узкой проверки: из product-page выполнить npm run test:preview-safety. Скрипт использует node --import tsx и существующий server-only stub, новых зависимостей нет. Полный safe test run — тот же список тестов из предыдущего VERIFICATION.md.

## План env: подготовлен, НЕ применён

| Настройка | Предложенное состояние Preview | Что требуется / проверка |
|---|---|---|
| SUPABASE_URL + SUPABASE_SECRET_KEY | отдельная подтверждённая тестовая БД, собственный ключ | отдельно согласовать ресурс/бюджет; не копировать клиентские данные; сравнить назначения без вывода ключей |
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
