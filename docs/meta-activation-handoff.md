# Продолжение подключения Meta — CARZO

Подготовленный код: PR https://github.com/MaxBal/carzo-storefront/pull/28,
ветка `codex/meta-pixel-capi`. Проект Vercel: `yevgens-projects/carzo-storefront`
(`prj_D6HYKiqCDNcJoMl2rah8ImaPimXW`). Supabase: `kmhegysmtsjqtwwaacht`.

## Проверенное состояние на 25 ноября 2026

- Владелец сообщил о сохранении `META_CARZO_ACCESS_TOKEN` как Secret только для
  Production. Значение не запрашивалось и не читалось.
- PR открыт как draft; Preview Ready, main ещё без интеграции.
- Supabase ACTIVE_HEALTHY; сигнатура старого RPC совпадает с подготовленной миграцией.
  Таблица очереди и новые функции отсутствуют. Заказы и клиенты не изменялись.
- Миграция была отклонена автоматической проверкой: для Production DDL требуется
  отдельное явное согласие владельца. Не повторять действие до такого согласия.
- Подключение Vercel возвращает 403 для команды; восстановление доступа по team ID
  и slug возвращает 404 Team not found. Секрет не подтверждён через API.
- `pg_cron` и `pg_net` доступны, но не установлены; Vault установлен.
  Имена `carzo_meta_worker_url` и `carzo_meta_delivery_secret` отсутствуют.
- Предварительные advisors: Health без замечаний, Security только INFO
  `rls_enabled_no_policy` для существующих закрытых таблиц, Performance только INFO
  unused indexes. Политики этих таблиц не расширять ради устранения INFO.

## Действия после явного согласия на Production

1. Ещё раз проверить main, head PR и состояние миграций. Применить только
   `supabase/migrations/20261125150208_meta_conversion_outbox.sql`, если она ещё
   не применена. Старый `create_order_with_items` не заменять.
2. Проверить RLS и отсутствие доступа anon/authenticated к таблице и пяти новым
   RPC; service_role должен иметь нужные права. Выполнить advisors и безопасные
   запросы по пустой очереди. Не создавать заказы/клиентов для этой проверки.
3. Включить Supabase pg_cron и pg_net, затем установить
   `supabase/operations/meta-recovery-scheduler.sql`. Проверить владельца задания,
   расписание и успешный первый запуск. Это задание очищает очередь и не делает
   HTTP-запросов без ожидающих событий и полной конфигурации.
4. Сгенерировать независимый случайный секрет не менее 32 символов. Сохранить
   одно и то же значение как Production Secret `META_DELIVERY_SECRET` в Vercel
   и `carzo_meta_delivery_secret` в Vault. Не помещать его в чат, Git, аргументы
   процесса или вывод команд. CAPI-токен читать/заменять не требуется.
5. Добавить Production Config-переменные:
   - `META_ENABLED=false`;
   - `META_ALLOWED_HOSTS=carzo.com.ua,www.carzo.com.ua`;
   - `META_DESTINATIONS` — JSON ниже.
   Проверить только метаданные наличия `META_CARZO_ACCESS_TOKEN`, Secret, Production.
6. После проверки PR опубликовать подготовленный код через обычный merge в main
   и Production build. Проверить точный commit, Ready, основной alias и доступность
   главной/карточки/корзины. Не переключать DNS и не отключать Tilda.

```json
[{"key":"carzo","pixelId":"449610966173734","productTypes":["case","car-mat"],"pagePaths":["/","/about","/catalog-carmat"],"pathPrefixes":["/case/"]}]
```

## Финальное включение после переноса домена

Пока `carzo.com.ua` обслуживает Tilda, `META_ENABLED` остаётся false, а URL worker
в Vault не устанавливается. После согласованного переноса, проверки сертификата и
доступности нового worker сохранить его точный URL в `carzo_meta_worker_url`.
Проверить права Dataset, настройки событий/каталога, согласие и privacy policy,
затем включить Meta отдельным redeploy. Принимать Graph success только как приём
запроса; доставку, дедупликацию и атрибуцию проверять отдельно в Events Manager.
`test_event_code` не считать гарантией изоляции рекламной статистики.

Подробности данных, маршрутизации, ограничений Lead и отката:
`docs/meta-pixel-capi.md`. Итоговый отчёт должен разделять выполненные действия,
непроверенные пункты и заблокированный доступ; не утверждать, что CAPI уже работает.
