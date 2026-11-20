# Самостоятельное задание Xiaomi MiMo
Репозиторий https://github.com/MaxBal/carzo-storefront, приложение product-page, Vercel team yevgens-projects / project carzo-storefront. Прочитай docs/agent-work/codex/2026-11-16, проверяй факты заново. Не доверяй старым SHA/отчётам без fetch.

Проверенные исходные HEAD:
- main baf997e4359bfd41cdacf315ceefdc15ce956c82
- PR #4 17cdb4efc5e4c5df536996001516f402694adadc
- PR #5 df322e1c05cafaf2ef903096f4ccd468d43ae1d3 (base #4)
- PR #6 7ae433375d0d704fd3dd393beb6d693cb5fca480
- PR #7 6f9d0fbfe08eff8add6a5648cd474c88086b4e41
- PR #8 dd8aaa60c1d148af73b108cc319362bc69a4c9ba
- draft Codex #9 8ca2de39bb06ae95dc460f01e36fb6b190eb1b58, base #6: conflict/TTL и однозначный fingerprint
- draft Codex #10 2dc495a43db6f28e7df01a52957371c08772399e, base #8: timeout body.

Сейчас Production НЕ разрешён. Не выполнять merge в main/dev, Production deploy, миграции, изменения Production env/credentials/тарифов/медиа. Подготовить безопасную проверку. Preview deploy выполнять только в пределах отдельного разрешения владельца и после доказанной изоляции backend. Исторически Preview получал Production Supabase service key: наличие preview URL НЕ разрешает создание тестовых заказов.

Порядок подготовки: #9 поверх #6, #10 поверх #8; затем локально #4 → #5 → исправленный #6 → #7 → исправленный #8. При будущем разрешённом merge #5 нужно retarget на main после #4. В конфликте catalog/supabase оставить publishedOnly:true И cacheMode; в package.json сохранить test:audit-fixes, test:caching, test:integrations. Чужие ветки не переписывать. Сейчас к isolated Preview кандидатны #4+#5, #7 и #8+#10; checkout #6+#9 только с менеджерским recovery и дополнительными тестами, общая Production готовность не подтверждена.

Сначала read-only Vercel: deployment ID/SHA/branch/status для Production и Preview, Root Directory=product-page, framework/build/install commands/Node, protection Preview, function region. Предыдущие сообщения указывали iad1 при Supabase eu-west-1; проверь, не меняй регион без разрешения. Сверь текущую активную Supabase schema/RPC signature, UNIQUE attempt, invoker/grants и миграции чтением.

Env проверять только по именам, scopes и безопасному сравнению, без вывода значений: SUPABASE_URL, SUPABASE_SECRET_KEY; CATALOG_STORE, CONTENT_STORE, PAGE_STORE, ORDER_STORE, CUSTOMER_STORE=supabase; NOTIFICATION_SETTINGS_STORE следует нужному backend; SITE_URL; PREVIEW_SECRET; NOVA_POSHTA_API_KEY; KEYCRM_WEBHOOK_SECRET, KEYCRM_LOYALTY_STATUS_IDS и KEYCRM_* для sync; TELEGRAM_BOT_TOKEN, TELEGRAM_TEST_CHAT_IDS; отдельные TELEGRAM_CARMAT_BOT_TOKEN/CHAT_ID. Production/Preview должны иметь разные безопасные назначения. Для isolated write tests KEYCRM_SYNC_ENABLED=false, Telegram sender mocked/тестовый, carmat отдельный бот не имеет общего preview guard. Если отсутствует изолированная БД и изоляция уведомлений — остановить write tests, сохранить ограничение. Не копировать Production key в тестовую среду.

Разрешённая Preview верификация после сборки:
1. tsc, lint, 540 unit/mock tests, build; проверить собственные новые тесты и deployed SHA.
2. /, /about, /catalog-carmat, 12 case variants, legal, 404, sitemap, llms, canonical, preview robots/noindex, security headers.
3. Галерея 375/768/1440, dots/swipe/back/resize/design/size, cold slow-network first swipe, реальный R2 bytes; 768 overflow локализовать. Проверить branded visible price против JSON-LD — остаётся риск.
4. Cache: public reads bounded 60s; warm GET без повторных backend запросов; change synthetic price → propagation, checkout PRICE_CHANGED перед записью; Draft no-store. Orders/customer/notifications/quote всегда no-store, без PII в public cache.
5. Checkout ТОЛЬКО isolated DB: double click, same UUID concurrent, lost response до/после commit, reload, changed address→conflict→повтор без нового заказа, TTL, phone/loyalty/payment/cart edits, две вкладки, storage denied/cleared. Проверить RPC атомарность и уведомления через mock. Полное storage loss recovery ещё не реализовано; не объявлять C-04 полностью PASS.
6. NP: autocomplete normal burst/shared NAT, 429 и 5xx, malformed JSON, stalled headers/body, invalid refs, fail-closed address.
7. keyCRM: auth до JSON и quota, query secret compatibility, wrong secret/flood, repeated statuses в isolated customer store. Реальный рабочий webhook и URL не менять.
8. Логи брать обезличенно: build ошибки, runtime counts, failed checkout, EDITORIAL_FALLBACK_ACTIVE, notification errors. Не публиковать phone/name/address/secrets.

Условия остановки/отката: дубль заказа, потеря состава/неверная сумма/адрес, stale order lookup, PII cache, Production backend у Preview, блокировка нормальной доставки, рост 5xx, broken gallery, отсутствие cache propagation. Остановить тест/релиз, зафиксировать SHA и evidence. Production rollback также требует разрешения владельца; заранее определить last-known-good deployment, не менять рабочую БД. Вернуть Markdown evidence со статусами PASS/FAIL/NEEDS_FOLLOWUP/NOT_TESTED и рекомендацией владельцу. Ничего автоматически не сливать и не продвигать.

