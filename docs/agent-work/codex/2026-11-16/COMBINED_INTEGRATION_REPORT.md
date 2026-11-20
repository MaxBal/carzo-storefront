# Совместная интеграция
Локальная codex/review-integration-2026-11-16 создана от актуального origin/main. Выполнено 5 локальных merge по порядку #4 → #5 → #6 → #7 → #8, НЕ в main/dev. Получена база композиции 9616ad1. Ветка интеграции не публиковалась.

Два реальных конфликта:
1. catalog/supabase.ts (#4+#7): у discount_tiers оставить {publishedOnly:true, cacheMode}; site_settings получает cacheMode.
2. package.json (#7+#8): сохранить ОБА test:caching и test:integrations, плюс test:audit-fixes из #5. Зависимости не менялись, lockfile без изменений.

Другие пересечения: #4/#5 PageRenderer, href, product page, package.json и tests/cms-href, tests/supabase-catalog-published-filter. #6 файлово не пересекается с другими, но зависит по поведению от admin cache #7. #7/#8 пересекают package.json. Отсутствие текстового конфликта не доказывает совместимость checkout.

Codex fixes на локальной codex/review-fixes-2026-11-16: eed71c1 (conflict/TTL), a2c4ae0 (body timeout), ab34584 (fingerprint delimiters). Они отдельно опубликованы как #9 поверх #6 и #10 поверх #8; чужие ветки не изменялись. Проверка combined tree: 540 safe tests PASS, typecheck PASS, lint PASS с 10 существующими warnings. Synthetic production build и browser результаты — VERIFICATION.md.

Правильный граф после разрешения владельца: сначала принять #9 в ветку #6 и #10 в ветку #8 (или эквивалентно cherry-pick с перепроверкой), затем #4 → retarget #5 на main → #5 → исправленный #6 → #7 с фильтром скидок → исправленный #8 с сохранением scripts. Ни один из этих merge здесь не выполнен на GitHub.

Production SHA, env, регион и конфигурация БД не подтверждены заново; Vercel API 403. Предыдущие документы утверждают выдачу Production key в Preview — до независимой сверки это достаточное основание НЕ тестировать запись через Preview.

