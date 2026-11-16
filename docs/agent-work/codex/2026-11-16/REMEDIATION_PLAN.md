# План и границы исправлений
1. BLOCKER CR-01/02/03: ревью draft #9, принять минимальный fail-closed guard только вместе с #6. Регрессионные тесты PASS. Объяснить менеджеру recovery при conflict; старые hashes не переписывать.
2. До объявления C-04 полностью закрытым спроектировать безопасное восстановление после полного удаления storage и координацию вкладок. Нужен серверный status/recovery с авторизацией по непрогнозируемому токену, с привязкой исходного intent и минимальным ответом без утечки PII. При необходимости таблица recovery/lease потребует отдельного SQL review и разрешения владельца. Не вводить автоматический новый create после неизвестного результата. До этой работы полная гарантия «никаких дублей» отсутствует.
3. MAJOR IN-01: принять #10 в пакет #8. Проверить timeout response body на isolated Preview; ограничение памяти и auth тесты сохранить.
4. MAJOR SEO-01: выбрать стратегию branded structured data/feed, проверить visible price/canonical/offer. Платёжные цены и скидки не менять. До этого не объявлять Merchant Center готовым.
5. Собрать пакеты с documented conflict resolution, повторить CI; снять 768 overflow и cold swipe замеры. На изолированной БД проверить live price drift, Draft Mode, outage, SQL races.
6. Xiaomi сверяет Vercel project/region/env и отсутствие Production credentials в Preview перед любыми write tests. Production deploy — только отдельное разрешение, main merge — также отдельное.
7. C-02, C-03, C-06, NEW-03, NEW-05 оставлены по решению владельца; текущий scope не расширялся. Directus/Railway, тарифы, R2 объекты, credentials, SQL не менялись.

Риски guard: блокировка покупки при unresolved conflict (преднамеренный fail-closed); миграция fingerprint меняет совместимость старых pending attempts; no-store может увеличить операционный DB трафик, но предотвращает stale order probe; 60s public cache допускает видимую старую цену, checkout обязан предложить актуальную сумму до записи.

