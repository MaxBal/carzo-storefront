# CARZO: решение по Preview и передача инфраструктуры Xiaomi

Дата: 16 ноября 2026. Код проверен в ветке codex/preview-legacy-integration-guards, Draft PR №12. Production/main не менялись.

## Техническое заключение

Первоначальный PR №12 закрывал только legacy Directus order write и два пути уведомлений. Сохранялись Supabase RPC create_order_with_items (lib/data/orders/supabase.ts), customer upsert/update (lib/cart/customer-store/supabase.ts), Directus customer POST/PATCH (lib/cart/customer-store/directus.ts), keyCRM order POST и webhook, изменяющий клиентов (lib/keycrm/{client,sync,webhook}.ts).

Дополнение в том же PR закрывает эти пути для рабочего backend вне Production. Все три Supabase client factory проверяют цель: отдельный явно указанный hosted project либо локальный loopback без Vercel. Изолированные Supabase записи остаются доступны. Directus customer операции, keyCRM запись/webhook и dedicated carmat delivery в Preview отключены. Для Supabase Telegram обязательны тестовые chat IDs; рабочий бот в Preview всё равно не нужен. Nova Poshta использует адресные справочники (HTTP POST является транспортом чтения), создания ТТН в проверенном модуле нет. R2 используется приложением для чтения медиа; upload/admin scripts не запускать с рабочими ключами.

Код и env нужны вместе: удалить рабочие credentials из Preview обязательно. Elevated Supabase secret обходит RLS; отдельная схема/табличный префикс при том же service key не создаёт полноценную изоляцию. Guard не отзывает ключ и не исправляет старые deployments. VERCEL_ENV=production в другом Vercel-проекте также разрешает Production path; не использовать --prod для обхода Preview ограничений.

## Бесплатная изоляция

Для локальной разработки: Supabase CLI + Docker, локальная схема/RPC и только synthetic seed. Hosted Supabase-проект не обязателен. Обычный PostgreSQL отдельно не воспроизводит PostgREST и Supabase API; mocks удобны для большинства unit-тестов, но не доказывают SQL atomicity/concurrency.

Для общего Vercel Preview: отдельный Free Supabase project, если доступна бесплатная квота. Указать SUPABASE_URL, его собственный SUPABASE_SECRET_KEY и SUPABASE_PREVIEW_PROJECT_REF. Базу владельца не клонировать с PII/уведомлениями. Локальный Docker недоступен Vercel напрямую; публичный туннель сейчас не нужен. Платное branching не требуется. Актуальную квоту/условия проверить перед созданием ресурса.

## Старые deployments и production key

1. Read-only инвентаризация: Production deployment/aliases, Preview deployment IDs/ветки/SHA, env scopes и branch overrides. Не раскрывать значения секретов. Исторические сведения о Production+Preview scope считать основанием проверки, не свежим подтверждением.
2. Подготовить точный diff scopes: SUPABASE_SECRET_KEY оставить Production, убрать только Preview/Development assignments с рабочим значением; не удалять общий env объект целиком. Проверить оставшиеся branch overrides. Удаление Preview assignment влияет на будущие сборки, не отзывает ключ и не изменяет snapshots существующих deployments.
3. Подготовить список старых deployments с рабочими credentials или неизвестным snapshot, исключив активный Production и необходимые rollback deployments. Предложить удаление/отключение их исполнения только после согласования конкретных IDs. Удаление alias не закрывает deployment URL. Deployment Protection — временное ограничение доступа, не отзыв выданного секрета.
4. Если нельзя гарантировать прекращение использования ключа старыми deployments или возможна утечка, нужен согласованный отзыв/ротация. Для современного отдельного secret key сначала создать замену, обновить все подтверждённые Production consumers, выполнить разрешённый Production redeploy и проверить доступность без заказа, затем отозвать старый key. Не ротировать JWT signing secret вслепую. Полный отзыв старого рабочего ключа затрагивает Production и требует владельца.
5. После подтверждения отсутствия рабочих credentials и всех внешних маршрутов — новый чистый Preview build из согласованного SHA. Зафиксировать deployment ID/SHA/target и назначения, затем isolated checkout/retry/concurrency тесты. Новый deploy не обезвреживает старые URL.

## Полномочия Xiaomi

Самостоятельно: read-only инвентаризация через уже авторизованный локальный MCP/CLI; сверка PR/SHA; таблица scopes без значений; подготовка env diff и списка старых deployment IDs; локальные tests/build с mocks или Docker; synthetic seed для локальной БД; документация. После доказанной изоляции может работать с изолированным Preview в пределах уже выданных полномочий.

Сначала согласование владельца: merge в main, Production deploy/promote/rollback; любые записи/миграции рабочей Supabase; изменение/отзыв рабочих credentials и интеграций; изменение assignments общего рабочего ключа; удаление/отключение старых deployments до подтверждения их назначения; платные ресурсы/новая подписка. До изоляции не запускать Preview checkout или Telegram/keyCRM webhook. Создание hosted Free проекта согласовать по организации и доступной квоте; локальная изоляция такого решения не требует.

## Организация работы

Оставить один PR №12 для кода безопасности, без включения UI, кеширования, миграций и других PR. Xiaomi ведёт инфраструктурный чек-лист в этом пакете, не создаёт PR для env-only изменений. До согласованной очистки общих секретов и старых deployment snapshots — только read-only и local synthetic tests. Не возвращать рабочие credentials в Preview как rollback; безопасное состояние — закрытый checkout.

Vercel MCP в данной Cloud-сессии вернул 403 forbidden для yevgens-projects. Свежие env scopes, deployment snapshots и логи здесь не подтверждены. Для инфраструктурных шагов использовать авторизованный локальный MCP владельца с явным team/project scope; не заменять его другим аккаунтом/командой.

Источники: https://supabase.com/docs/guides/local-development ; https://supabase.com/docs/guides/database/postgres/row-level-security ; https://vercel.com/docs/environment-variables .
