# CARZO — Preview с общей базой до запуска

Актуальное решение: 18 ноября 2026. Дополнение к Draft PR №12.

## Решение

Магазин ещё не запущен. Отдельный hosted Supabase не создаём; существующий проект kmhegysmtsjqtwwaacht используется для синтетических проверок. Прежний план обязательного отдельного backend заменён этим режимом. Это общая база, а не изолированная среда.

Default остаётся fail-closed. Исключение требует точного VERCEL_ENV=preview, SUPABASE_ALLOW_SHARED_PREVIEW=true, SUPABASE_PREVIEW_PROJECT_REF=kmhegysmtsjqtwwaacht и точного HTTPS origin этого проекта. Development, unset и custom environments флагом не разрешаются. VERCEL_ENV вручную не подменять.

Исключение разрешает обычные операции приложения с общей БД: создание заказов, customer upsert и чтение существующих данных. Код не ограничивает записи тестовой маркировкой. Preview должен быть доступен только участникам проверки; тестовые записи учитывать по точным ID. Существующие данные не менять/удалять. Reset, seed и миграции общей базы в этап не входят.

## Интеграции

В shared Preview оба Supabase notification entrypoints завершаются до чтения настроек/credentials и отправки. Car-mat delivery core возвращает false даже с bot token и корректными test chat IDs. Отключённая доставка заявки не объявляется успешной.

Directus orders/customers и legacy notifications, dedicated carmat sender, keyCRM outbound и inbound webhook остаются заблокированы вне Production. Флаг их не включает. Production routing сохраняется даже при случайном наличии shared-флага в Production env.

## Предлагаемый diff Vercel — НЕ применён

Только branch-specific Preview assignments для codex/preview-legacy-integration-guards:

| Переменная | Значение |
|---|---|
| SUPABASE_URL | https://kmhegysmtsjqtwwaacht.supabase.co |
| SUPABASE_SECRET_KEY | существующий ключ проекта, server-side; значение не выводить |
| SUPABASE_PREVIEW_PROJECT_REF | kmhegysmtsjqtwwaacht |
| SUPABASE_ALLOW_SHARED_PREVIEW | true |
| CATALOG_STORE, CONTENT_STORE, PAGE_STORE, ORDER_STORE, CUSTOMER_STORE, NOTIFICATION_SETTINGS_STORE | все supabase |
| KEYCRM_SYNC_ENABLED | false |
| TELEGRAM_TEST_CHAT_IDS | пусто |
| Telegram, keyCRM, Directus credentials | не добавлять; проверить унаследованные assignments |

Production assignments сохраняются. Не менять target на Production ради обхода проверки. Перед checkout подтвердить Deployment Protection, SHA и branch overrides. Отсутствие защиты доступа — причина отложить write-тест.

## Порядок

1. Read-only проверить PR head и Vercel team/project, branch overrides и Deployment Protection. Ранее Cloud MCP возвращал 403; новый доступ не подтверждён.
2. Применить согласованный branch-specific diff и создать Preview из дополненного PR №12. Push сам по себе не включает общий backend: новый флаг по умолчанию отсутствует/false.
3. Подтвердить target=preview, SHA, Supabase origin и отсутствие внешних отправок. Секреты не выводить.
4. Проверить карточка → корзина → checkout → сохранённый synthetic заказ. SQL replay/concurrency отдельно уже проверены; повторять без причины не нужно. PR №12 сам по себе не включает другие checkout/UI исправления.
5. До публичного запуска убрать shared opt-in и прекратить исполнение Preview deployments, содержащих этот режим. Для дальнейших тестов использовать mocks либо отдельный backend. Удаление env assignment не меняет старые snapshots; удаления alias недостаточно.

Unit/mock-проверки не подтверждают актуальные Vercel scopes или отсутствие отправок из старых deployments. В этом дополнении инфраструктура, основной deployment, credentials и БД не менялись.
