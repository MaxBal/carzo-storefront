# Фактическая верификация
16.11.2026, рабочее дерево /workspace/carzo-storefront, combined #4–8 + Codex fixes. Секреты не загружались; .env.local отсутствует. Все внешние записи ограничены собственными feature branches и draft PR.

| Проверка | Результат |
|---|---|
| regression до исправления: conflict/reload, TTL, NP body | FAIL: 2 заказа вместо 1, новый UUID, deadline-missed |
| courier delimiter до исправления | FAIL: разные house/apartment дают равный SHA |
| финальные unit/mock | PASS 540 тестов / 83 suite / 0 skipped |
| TypeScript pnpm exec tsc --noEmit | PASS |
| ESLint pnpm run lint | PASS: 0 errors, 10 warnings img/alt |
| git diff --check | PASS |
| первый next build, synthetic PostgREST | PASS, редакционный fallback зафиксирован, не доказательство live content |
| final next build после fingerprint fix | PASS, exit 0; без EDITORIAL_FALLBACK_ACTIVE/Error в логе; только синтетические данные |
| gallery Chromium 375/768/1440 | interaction PASS локально; 768 overflow NEEDS_FOLLOWUP |
| live RPC race, реальный заказ/Telegram/keyCRM | NOT_TESTED, запрещён Production write |
| Vercel project/production/env | NOT_TESTED: get_project 403 |

Команда safe tests:
```bash
node --import tsx --require ./tests/helpers/server-only-stub.cjs --test $(rg --files tests -g '*.test.ts' | rg -v 'supabase-catalog-integration|supabase-editorial-integration|carmat-quote-supabase-integration|editorial-fallback-detection')
```
Четыре live/env suites исключены; editorial-fallback-detection требует специального env и может читать настроенный Directus. Полный runnable список определяется командой; «все unit/mock» не означает «все существующие integration». tsx CLI в sandbox получил EPERM IPC; node --import tsx успешно выполнил тесты.

Build env: SUPABASE_URL=http://127.0.0.1:4320, SUPABASE_SECRET_KEY=synthetic-only, все 5 STORE=supabase; mock backend принимает только GET и отклоняет записи. Первый сервер :4319 не имел editorial fixture, финальный :4320 содержит синтетические seed catalog, 17 placeholder media и локальную gallery. Это не production schema parity. На Next :4321 измерено: два quote POST → 2 запроса к каждой из 8 catalog tables; два product GET → один общий набор stale revalidation reads. Логи /tmp/carzo-unit-final.log, /tmp/carzo-build-final.log; локальная browser программа /tmp/carzo-browser-review.py. Эти временные файлы не являются долгосрочными CI artifacts.

Browser внешние HTTP запросы заблокированы; Production/провайдеры не использовались. Реальный cold R2 трафик, first-swipe latency, Draft cookie, 60s price mutation, CDN hit ratio и SQL concurrency требуют изолированного Preview.

