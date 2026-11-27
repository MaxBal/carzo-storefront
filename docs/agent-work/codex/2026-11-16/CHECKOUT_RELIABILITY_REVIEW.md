# Checkout — PR #6 и совместимость с #7
## Подтверждённые дефекты
- **CR-01 BLOCKER / FAIL исходному PR.** tracker resolveOutcome(ATTEMPT_REUSED) удаляет запись; CartDrawer дополнительно resetCheckoutAttemptId. Сценарий: commit A/F1 → потерянный ответ → reload → адрес B/F2 → конфликт → следующее нажатие создаёт UUID B и второй заказ. [Исходный tracker](https://github.com/MaxBal/carzo-storefront/blob/7ae433375d0d704fd3dd393beb6d693cb5fca480/product-page/lib/cart/checkout-attempt-client.ts#L283), [форма](https://github.com/MaxBal/carzo-storefront/blob/7ae433375d0d704fd3dd393beb6d693cb5fca480/product-page/components/cart/CartDrawer.tsx#L213). Модель с Map заказов воспроизвела 2 вместо 1.
- **CR-02 BLOCKER / FAIL.** readPersistedCheckoutAttempt удаляет любую попытку через 24 часа; hydrate без записи обнуляет память. Неподтверждённая попытка может исчезнуть, хотя заказ сохранён. MAINTENANCE/INVALID возвращаются до replay probe, поэтому переход в idle при этих ответах не доказывает отсутствие предыдущей записи. Новый тест подтвердил смену UUID по TTL.
- **CR-03 BLOCKER / FAIL.** Courier target строится через join('|'). house='12|3', apartment='4' и house='12', apartment='3|4' дают один fingerprint. checkoutSchema разрешает такие строки. Это структурная коллизия, не криптоанализ SHA-256; разные адреса могут получить успешный replay.
- **CR-04 NEEDS_FOLLOWUP.** Полная очистка localStorage с reload, недоступный storage и гонки между независимыми вкладками не решаются гарантированно данным клиентским tracker. Подмена/потеря UUID оставляет сервер без идентичности предыдущей покупки. Нужен отдельный recovery contract; это не повод дедуплицировать покупки только по телефону.

## Исправления Codex
Draft #9: конфликт хранится и блокирует следующий beginSubmit даже после reload; UI не сбрасывает UUID и не предлагает повторно оформить. Незавершённые попытки не истекают по TTL; локальная память сохраняется при удалении storage; pre-write rejection сохраняет uncertain. Адрес кодируется JSON-массивом, исключая коллизии разделителя. Тесты сначала воспроизвели ошибки, затем прошли. Исправление консервативно: менеджер должен проверить конфликт; автоматического создания нового заказа нет. Цена, скидки, Telegram/keyCRM и SQL не менялись.

Риск исправления: конфликт может надолго заблокировать повторную покупку в этом браузере; нужен удобный серверный recovery и явное решение покупателя после подтверждения предыдущего заказа. Изменение hash несовместимо со старыми сохранёнными fingerprint: release должен предусматривать ручную проверку старых pending attempts. Не переписывать существующие заказы.

## Проверенные и непроверенные сценарии
| Сценарий | Результат |
|---|---|
| double click / submit до re-render | PASS: синхронный submittingRef + in_flight guard |
| reload in_flight → uncertain; identical replay | PASS unit/model |
| телефон, loyaltyPhone, город, branch, courier, payment, quantity | PASS fingerprint tests; изменённый intent конфликтует |
| потеря до записи / после записи | PASS модель proceed/replay/conflict; не live RPC |
| повтор после конфликта | исходный FAIL, #9 PASS модель |
| TTL / maintenance / storage event удаления | исходный FAIL, #9 PASS модель |
| очистка storage и reload / запрет storage | NEEDS_FOLLOWUP: identity может потеряться |
| две настоящие вкладки / гонка SQL | NOT_TESTED end-to-end; storage events не являются mutex |
| Supabase outage | FAIL-CLOSED по коду, FAILED сохраняет uncertain; recovery UX не завершён |

Цепочка server action → findOrderByAttemptId → fingerprint → RPC проверена. #7 ставит no-store на общий admin client; probe не попадает в public cache. RPC SQL содержит advisory_xact_lock, UNIQUE(checkout_attempt_id), fingerprint mismatch и атомарную вставку orders+items. Конкурентный тест SQL не запускался без изолированной БД; Production вызовов не было.

