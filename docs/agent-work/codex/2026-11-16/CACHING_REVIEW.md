# Кеширование — PR #7
PASS на уровне исходников и mock HTTP:
- общий admin global.fetch принудительно cache=no-store; orders probe/RPC, customers, notification_settings используют его;
- quoteCartItems вызывает loadCatalogData без параметров: no-store, live price и stock;
- getContentSource для витрины передаёт cache=revalidate; catalog fetch имеет next.revalidate=60, tag catalog;
- editorial content fetch имеет revalidate=60, tags content/settings; Draft Mode переводит запрос в no-store;
- CMS published loader и facade используют module-scoped React.cache. Это дедупликация внутри render request, не общий пользовательский кеш;
- preview page reads no-store; цены не считаются из редакционного fallback.

Реальные локальные измерения Next production server с синтетическим HTTP backend: две quote POST дали по два обращения к каждой из 8 таблиц каталога и total=2249. Два подряд product GET после истечения кеша суммарно дали только один набор чтений каталога/editorial (обновление stale cache); второй запрос использовал Data Cache. Повторный warm запрос проверять отдельно от первого stale read. Никаких клиентских заказов для этого не создавали.

Build показал ○ для /, /about, /catalog-carmat, sitemap.xml, llms.txt; product catch-all и CMS catch-all остались ƒ. Следовательно, утверждение «всё стало ISR» неверно: публичные product страницы используют кеш данных, но продолжают серверный render. Таблица build не является измерением CDN hit rate.

Пересечение #4+#7 в catalog/supabase.ts требует ОБОИХ publishedOnly:true и cacheMode у discount_tiers. Временная интеграционная ветка сохраняет оба.

NEEDS_FOLLOWUP: тесты caching-strategy проверяют параметры fetch и стабильность ссылок функций; React.cache в test stub — pass-through. Они не проверяют реальные Draft cookies, минутное обновление изменённой цены, CDN cache, отмену кеша и перезапуск. Финальный build на полной синтетической фикстуре требуется отличать от первого smoke build с редакционным fallback. При отказе CMS published loader возвращает null/[]: возможен 404 или неполный sitemap; live outage/TTL сценарий не подтверждён. Сервер при изменении цены возвращает PRICE_CHANGED/LOYALTY_CHANGED перед записью; соответствующие unit-тесты проходят.

Security: проекции публичного каталога/editorial не содержат customers/orders. Сервисный ключ не импортируется клиентскими компонентами; cached public data и операционный клиент разделены. Проверка настроек реальных Production/Preview ключей заблокирована Vercel 403.

