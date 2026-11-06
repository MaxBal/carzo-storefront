# CARZO → keyCRM — Отчёт Phase 0 (read-only аудит)

Дата: 2026-11-06. Код: `carzo-storefront` @ `dev` c390888 (Production = Supabase). Изменений в коде/БД не производилось.

Источники истины: актуальный код `product-page/` (не устаревшие docs/ Directus-эпохи), живая Supabase (read-only SQL), три CSV из `carzo-storefront-r2-migration/Keycrm/`, официальная документация keyCRM (OpenAPI `docs.keycrm.app/api.yaml` v1.2.0 + help.keycrm.app).

---

## A. Текущая архитектура Carzo

### A.1 Checkout (что реально происходит)

Точка входа — `product-page/app/actions/checkout.ts` → `createOrder()` (строка 204). Последовательность:

1. Maintenance-gate `isCheckoutMaintenance()` (env `CHECKOUT_MAINTENANCE`).
2. In-memory rate limit IP: 20 запросов / 60 с.
3. Zod-валидация `checkoutSchema` (`lib/cart/validation.ts`).
4. Нормализация телефона `normalizeCustomerPhone` → `+380XXXXXXXXX` (`lib/cart/customer-phone.ts:10-32`; формы 380XXXXXXXXX / 0XXXXXXXXX / XXXXXXXXX; лишние цифры не обрезаются).
5. `resolveOrderStoreBackend()` — env `ORDER_STORE`, production = `supabase`.
6. Обязателен `checkoutAttemptId` (UUID клиента) + `requestFingerprint` (SHA-256 по телефону/связи/доставке/строкам корзины; цены в фингерпринт не входят) — `lib/cart/checkout-attempt.ts`.
7. Replay-probe `findOrderByAttemptId()` ДО ценообразования: уже созданный заказ возвращается как `replayed:true`, повторные side-effects не выполняются. Несовпадение фингерпринта → `ATTEMPT_REUSED`.
8. Серверный пересчёт корзины `quoteCartItems()` — `lib/cart/server.ts:66-163`, fail-closed при ошибке каталога.
9. Ценовой гейт `withCheckoutPricing` — `lib/cart/checkout-pricing.ts`: лояльность считается серверно, итог сравнивается с клиентским `expectedTotal`/`expectedBaseTotal`; расхождение → `PRICE_CHANGED`/`LOYALTY_CHANGED` без записи.
10. `buildOrderSnapshot` → `createOrderRecord` → **атомарный RPC** `create_order_with_items` (supabase/migrations/20261031164057 + 20261031180954).

Запись в БД: только `public.orders` (1 строка) + `public.order_items` (N строк) в одной транзакции. Таблицы `checkout_attempts` **нет** — идемпотентность несёт `orders.checkout_attempt_id uuid UNIQUE` + `orders.request_fingerprint text` + advisory lock.

После успешной записи (только при `created:true`) — best-effort side-effects через `runPostOrderSideEffectsOnCreate` (`lib/cart/checkout-reliability.ts:57-63`):
- Telegram `notifyNewOrder` (`lib/order-notifications.ts`);
- `upsertCustomerByPhone({phone, fullName, source:'site', imported:false})` — **именно этот вызов кладёт нового покупателя в customers сразу после заявки** (`checkout.ts:348-355`).

Ошибки side-effects логируются и **не** превращают успешный checkout в ошибку. Повторные отправки (replay) не шлют уведомлений и не делают upsert.

### A.2 Деньги (формула суммы)

Все суммы — целые гривны.

- `unit_price = variants.price + brands.logo_extra + fixationExtra(size)` — `lib/cart/server.ts:104-105`. **unit_price уже включает платный шильд и платную фиксацию.**
- `line_total = unit_price × quantity`.
- `subtotal = Σ line_total`.
- `quantity_discount` — фиксированная сумма из `discount_tiers` (quantity-2: −200 ₴ при ≥2 ед.; quantity-3: −500 ₴ при ≥3 ед.; берётся максимальный подходящий тир, ограничивается eligible-суммой).
- `loyalty_discount_amount = trunc((subtotal − quantity_discount) × 5 / 100)` — `lib/cart/loyalty-math.ts:36-48`, константа `LOYALTY_DISCOUNT_PERCENT = 5`.
- `total = subtotal − quantity_discount − loyalty_discount_amount` — инвариант проверяется в SQL RPC (`TOTAL_FORMULA_MISMATCH`).

Проверено на живых заказах: CZ-20261002-EEF70B (5519 − 200 → 5319; 5% → 265; total 5054); CZ-20261105-E2BFCE (L4.0 base 2590×2 + «дно+стінка»+шильд Toyota: 2590+290+100=2980; subtotal 8160 ✓).

### A.3 Схема заказа (Supabase, verbatim-ключевые поля)

`orders`: id, order_number (UNIQUE, `CZ-YYYYMMDD-XXXXXX`, генерится в RPC), checkout_attempt_id (UNIQUE), request_fingerprint, status enum(`new`,`in_progress`,`done`,`cancelled`), created_at, updated_at, customer_id (FK customers, **боевым checkout не заполняется**), customer_name, customer_phone, customer_email (**в схеме есть, checkout не пишет**), customer_comment, contact_method enum(`phone`,`telegram`,`viber`,`whatsapp`), delivery_method enum(`BRANCH`,`POSTOMAT`,`COURIER`), delivery_city_ref, delivery_city_name, delivery_point_ref, delivery_point_number, delivery_point_name, delivery_point_address, delivery_point_type, delivery_street_ref, delivery_street_name, delivery_street_type, delivery_house, delivery_apartment, items_quantity, subtotal, quantity_discount, loyalty_phone, loyalty_eligible, loyalty_discount_percent, loyalty_discount_amount, loyalty_phone_mismatch, total, discount_tier_key, manager_note.

`order_items`: id, order_id, sort, item_key (`size:designSlug:brandId:fixation`), title, design_slug, design_label, size_code, size_label, brand_slug, brand_name, fixation_key, fixation_label, unit_price, quantity, line_total, quantity_discount_eligible. **JSON-блока опций нет, колонок SKU нет, цены допопций отдельно не хранятся.**

`customers`: id, phone (UNIQUE, CHECK `^\+380[0-9]{9}$`), full_name, source (default `'site'`), imported (default false), legacy_orders_count, legacy_products_count, legacy_city, legacy_delivery, created_at, updated_at. Merge-политика (`lib/cart/customer-store/merge.ts`): при upsert существующей записи не затираются source/imported/legacy_*/created_at.

Состояние данных (read-only): customers — **5998** строк (5994 imported, 28 с source `keycrm,wrike`, 4 созданы сайтом); orders — 15 (все `new`, customer_id не привязан); каталог: designs 2-0/3-0/4-0; sizes S/M/L/XL; variants 12 (S=1790, M=2249, L=2590, XL=2990, old_price есть); fixations none/bottom/wall (extra 0) + both (`fixation_size_extras`: S=60, M=80, L=100, XL=120); brands 25 + `none`, у всех `logo_extra=290`; discount_tiers quantity-2/quantity-3.

### A.4 Telegram

`lib/order-notifications.ts` → `notifyNewOrder`. Шаблон/чаты из `notification_settings`, токен из env `TELEGRAM_BOT_TOKEN`. Отправка строго после коммита заказа, best-effort. Формат строк: `• {title} × {qty} — {lineTotal} ₴` + `Фіксація: {label}`. Менять не требуется.

### A.5 Лояльность сегодня

- Проверка 5%: opt-in поле `loyaltyPhone` в checkout; должно совпасть с телефоном заказа → `findCustomerByPhone` (existence-only запрос по каноничному телефону). Нашли → 5% от базы после количественной скидки. Не нашли → заказ проходит без скидки. Ошибка стора → checkout блокируется с предложением повторить (не «скидки нет»).
- Превью на сайте: `app/api/customer-discount/check/route.ts` (тот же lookup, rate-limit, при падении стора — 502).
- **Регистрация:** `upsertCustomerByPhone` вызывается после каждого успешного заказа сайта (см. A.1) — заявка без покупки уже даёт право на скидку. Это нужно изменить.

---

## B. Анализ трёх CSV-каталогов Keycrm

Файлы: `carzo-storefront-r2-migration/Keycrm/` (`Автокейс_каталог_Keycrm.csv`, `Фіксація_каталог_Keycrm.csv`, `Шильд_каталог_Keycrm.csv`). Кодировка UTF-8, разделитель `;`, 37 колонок (ID, Название, Артикул, Стоимость, Закупочная стоимость, Количество, Свойство N / Значение свойства N, Дизайн, Розмір, Материал …). Папка добавлена в `.gitignore` репозитория `carzo-storefront-r2-migration` (`/Keycrm/`), в GitHub не загружена. CSV — источник соответствия артикулов, **не** источник актуальных цен сайта.

| Файл | Позиций | Что внутри | Дубликаты артикулов |
|---|---|---|---|
| Автокейс | 12 | S/M/L/XL × 2.0/3.0/4.0, артикулы `S2.0`…`XL4.0`, цена S=1790, M=2249, L=2590, XL=2990 (одинакова для всех дизайнов размера) | нет |
| Фіксація | 5 | только платная «Дно+стінка»: `FIX-S-DW`=60, `FIX-M-DW`=80, `FIX-L-DW`=100, `FIX-XL-DW`=120, `FIX-2XL-DW`=140 | нет |
| Шильд | 28 | стальные шильды брендов: 25 × 290 ₴ (`AUDI-ST`…`VOLKSWAGEN-ST`), `BYD-ST`=300, `AMG-ST`=300, `CUSTOM-ST`=350 | нет |

Примечания: у `FIX-L-DW` в CSV «Количество» = −2 (остаток, на интеграцию не влияет). Бесплатные фиксації (`без фіксації`, `на дні`, `на стінці`) в CSV **отсутствуют** — ожидаемо, они не должны быть отдельными SKU. Внутри каждого файла артикулы уникальны.

Сопоставление с сайтом (Supabase-каталог): цены автокейсов совпадают точно; доплаты `FIX-*-DW` совпадают точно с `fixation_size_extras` (60/80/100/120); `logo_extra=290` совпадает с ценой 25 шильдов. Сайт не знает размера 2XL и брендов BYD/AMG/Custom — соответствующие 4 SKU в CSV лишние для текущей витрины (см. C).

---

## C. Таблица SKU

### C.1 Автокейсы (базовая позиция)

SKU = `{Розмір}{Версия}` без разделителя. Соответствие 1:1, все 12 комбинаций сайта покрыты, дублей нет, расхождений цен нет.

| Товар сайта (size × design) | SKU keyCRM | Название в CRM | Цена в CRM | Соответствие | Проблемы |
|---|---|---|---|---|---|
| S × 2.0 / 3.0 / 4.0 | S2.0 / S3.0 / S4.0 | Автокейс S 2.0 / 3.0 / 4.0 | 1790 | полное | — |
| M × 2.0 / 3.0 / 4.0 | M2.0 / M3.0 / M4.0 | Автокейс M … | 2249 | полное | — |
| L × 2.0 / 3.0 / 4.0 | L2.0 / L3.0 / L4.0 | Автокейс L … | 2590 | полное | — |
| XL × 2.0 / 3.0 / 4.0 | XL2.0 / XL3.0 / XL4.0 | Автокейс XL … | 2990 | полное | — |

Фиксация, логотип, дизайн в артикул базовой позиции **не входят** (кроме версии дизайна): одинаковые кейсы с разными бесплатными фиксаціями обязаны иметь одинаковый SKU.

### C.2 Платные фиксації

| Вариант сайта | SKU keyCRM | Название в CRM | Цена в CRM | Цена на сайте | Проблемы |
|---|---|---|---|---|---|
| фікс.дно+стінка, S | FIX-S-DW | Дно+стінка S | 60 | 60 | — |
| …, M | FIX-M-DW | Дно+стінка M | 80 | 80 | — |
| …, L | FIX-L-DW | Дно+стінка L | 100 | 100 | остаток −2 в CSV |
| …, XL | FIX-XL-DW | Дно+стінка XL | 120 | 120 | — |
| — (нет на сайте) | FIX-2XL-DW | Дно+стінка 2XL | 140 | — | **осиротевший SKU**: размера 2XL на сайте нет |
| без фіксації / на дні / на стінці | нет SKU | — | 0 | 0 | ожидаемо: передаются свойствами/комментарием |

### C.3 Шильды (логотипы)

Правило соответствия: slug бренда сайта → артикул `{BRAND}-ST` (регистр верхний, дефисы убраны). **Не формульные случаи:** `rr` → `RANGEROVER-ST`, `alfa` → `ALFAROMEO-ST`, `bmw-m` → `BMWM-ST`, `s-line` → `SLINE-ST`. Поэтому нужна явная маппинг-таблица (не конкатенация).

| Бренд сайта (brand_slug) | SKU keyCRM | Цена в CRM | logo_extra на сайте | Соответствие |
|---|---|---|---|---|
| audi / bmw / toyota / tesla / kia | AUDI-ST / BMW-ST / TOYOTA-ST / TESLA-ST / KIA-ST | 290 | 290 | полное |
| rr / renault / alfa / volvo / bmw-m | RANGEROVER-ST / RENAULT-ST / ALFAROMEO-ST / VOLVO-ST / BMWM-ST | 290 | 290 | полное |
| ford / honda / hyundai / jeep / land-rover | FORD-ST / HONDA-ST / HYUNDAI-ST / JEEP-ST / LANDROVER-ST | 290 | 290 | полное |
| lexus / mazda / mercedes / mitsubishi / nissan | LEXUS-ST / MAZDA-ST / MERCEDES-ST / MITSUBISHI-ST / NISSAN-ST | 290 | 290 | полное |
| peugeot / porsche / s-line / subaru / volkswagen | PEUGEOT-ST / PORSCHE-ST / SLINE-ST / SUBARU-ST / VOLKSWAGEN-ST | 290 | 290 | полное |
| none («Без логотипа») | — | 0 | 0 | не передаётся позицией |
| — | BYD-ST / AMG-ST / CUSTOM-ST | 300 / 300 / 350 | — | **осиротевшие SKU**: на сайте нет брендов BYD, AMG, Custom |

### C.4 Отдельный список проблем

- **Отсутствующих SKU для текущей витрины нет** — все 12 кейсов, 4 платные фиксаціи (S/M/L/XL) и 25 шильдов покрыты.
- **Осиротевшие SKU (4):** `FIX-2XL-DW`, `BYD-ST`, `AMG-ST`, `CUSTOM-ST`. Не мешают интеграции; вопрос владельцу: планируются ли 2XL/BYD/AMG на сайте и что из себя представляет `CUSTOM-ST` («Шильд кастом (сталь)», 350) — это «фирменный шильд Carzo» или услуга кастомного лого? В CSV отдельного SKU «Шильд Carzo» нет.
- **Дубликатов артикулов нет** ни внутри CSV, ни при сопоставлении.
- **Расхождений цен** между CSV и Supabase-каталогом по сопоставленным позициям нет (290/60/80/100/120/1790/2249/2590/2990 совпадают).
- **Расхождения названий косметические** («Автокейс M 4.0» в CRM vs «Автокейс M Carzo 4.0» в title сайта; «Дно+стінка M» vs «фікс.дно+стінка»). Ключ сопоставления — артикул.
- **Одинаковые артикулы для разных фиксацій:** у бесплатных фиксацій SKU один (базовый) — это и есть требование; платная «дно+стінка» вынесена в FIX-*-DW.

---

## D. Формирование заказа keyCRM (примеры payload)

Все имена полей — verbatim из OpenAPI (`POST https://openapi.keycrm.app/v1/order`, `Authorization: Bearer <KEYCRM_API_KEY>`). Персональных данных реальных клиентов нет — телефоны/имена обезличены.

### D.0 Принципы сборки (кратко)

1. `source_id` = `KEYCRM_SOURCE_ID` (обязателен), `source_uuid` = `orders.order_number` (стабильный внешний номер; повторный POST с тем же `source_uuid` в том же источнике отклоняется keyCRM: "The source uuid has already been taken").
2. Группировка позиций: строки order_items с одинаковой базой `{size}{version}` объединяются в **одну** позицию keyCRM (`sku=M4.0`, quantity = сумма), распределение фиксацій уходит в `products[].comment` (поле подтверждено спекой). Разные SKU не объединяются.
3. Платная фиксація → отдельная позиция `FIX-{S|M|L|XL}-DW` (quantity = число кейсов с `fixation_key='both'`), цена = доплата.
4. Шильд → отдельная позиция `{BRAND}-ST` (quantity = число кейсов с данным `brand_slug`), цена = `logo_extra`.
5. Разделение цены: цена базовой позиции = `variants.price` (без допопций), чтобы сумма строк keyCRM была точно равна `orders.subtotal`. Это предотвращает двойное начисление (полный `unit_price` + отдельная FIX/ST-строка).
6. Скидки: одна order-level `discount_amount = quantity_discount + loyalty_discount_amount` (разбивку — в `manager_comment`), тогда `grand_total` сходится с `orders.total`.
7. `products[].purchased_price` = 0 (в CSV закупка 0), `name`/картинки/свойства подтянутся из каталога CRM по артикулу.
8. Опционально `payments[]` (решение владельца, см. K).

### D.1 Обычный автокейс

Заказ: Автокейс M Carzo 4.0, без логотипа, без фіксації, 1 шт. (orders: CZ-…, subtotal 2249, total 2249).

```json
{
  "source_id": 12,
  "source_uuid": "CZ-20261106-ABC123",
  "buyer": { "full_name": "Приклад Ім'я", "phone": "+380000000000", "email": null },
  "buyer_comment": "Замовлення з сайту Carzo CZ-20261106-ABC123",
  "shipping": {
    "shipping_service": "Нова Пошта",
    "delivery_service_id": 3,
    "warehouse_ref": "<delivery_point_ref — UUID відділення НП>",
    "shipping_address_city": "Київ",
    "shipping_receive_point": "Відділення №123: вул. Прикладна, 1"
  },
  "products": [
    { "sku": "M4.0", "price": 2249, "purchased_price": 0, "quantity": 1,
      "comment": "Фіксація: 1 шт — без фіксації" }
  ],
  "custom_fields": [ { "uuid": "OR_XXXX", "value": ["Зателефонувати"] } ]
}
```

### D.2 Два одинаковых кейса с разными бесплатными фиксаціями

Заказ (реальный образец из Supabase, CZ-20261105-3146A2): 2 × M 4.0 без логотипа: 1 «на дні», 1 «на стінці». order_items — две строки по 2249, subtotal 4498.

```json
{
  "source_id": 12,
  "source_uuid": "CZ-20261105-3146A2",
  "buyer": { "full_name": "…", "phone": "+380…" },
  "products": [
    { "sku": "M4.0", "price": 2249, "purchased_price": 0, "quantity": 2,
      "comment": "Фіксація: 1 шт — фікс.на дні; 1 шт — фікс.на стінці" }
  ]
}
```

Одна базовая позиция 2 шт. — как в требовании 7.2. Комментарий сохраняет распределение.

### D.3 Кейс с платной фиксаціей (вместе с бесплатной)

Заказ (CZ-20261105-E2BFCE): L 4.0 без логотипа «без фіксації» ×2 + L 4.0 Toyota «дно+стінка» ×1. unit_price: 2590, 2590, 2980 (=2590+290+100). subtotal 8160, quantity_discount 500, total 7660.

```json
{
  "source_id": 12,
  "source_uuid": "CZ-20261105-E2BFCE",
  "buyer": { "full_name": "…", "phone": "+380…" },
  "discount_amount": 500,
  "manager_comment": "Знижка за кількість: 500 ₴ (quantity-3). Без знижки постійного клієнта.",
  "products": [
    { "sku": "L4.0", "price": 2590, "purchased_price": 0, "quantity": 3,
      "comment": "Фіксація: 2 шт — без фіксації; 1 шт — фікс.дно+стінка" },
    { "sku": "FIX-L-DW", "price": 100, "purchased_price": 0, "quantity": 1 },
    { "sku": "TOYOTA-ST", "price": 290, "purchased_price": 0, "quantity": 1 }
  ]
}
```

Сумма: 2590×3 + 100 + 290 = 8160 = subtotal ✓; 8160 − 500 = 7660 = total ✓. Двойного начисления нет.

### D.4 Кейс с шильдом и лояльностью 5%

Заказ: M 3.0 для Volvo, без фіксації, 1 шт (2539 = 2249+290) + M 3.0 для Honda «дно+стінка» (2980 = 2249+290+100)… упростим до одного реального: CZ-20261002-6CC41B — M 4.0 Kia «дно+стінка» ×1, unit_price 2619, subtotal 2619, loyalty 130, total 2489.

```json
{
  "source_id": 12,
  "source_uuid": "CZ-20261002-6CC41B",
  "buyer": { "full_name": "…", "phone": "+380…" },
  "discount_amount": 130,
  "manager_comment": "Знижка постійного клієнта 5%: 130 ₴ (телефон лояльності збігається).",
  "products": [
    { "sku": "M4.0", "price": 2249, "purchased_price": 0, "quantity": 1,
      "comment": "Фіксація: 1 шт — фікс.дно+стінка" },
    { "sku": "FIX-M-DW", "price": 80, "purchased_price": 0, "quantity": 1 },
    { "sku": "KIA-ST", "price": 290, "purchased_price": 0, "quantity": 1 }
  ],
  "custom_fields": [ { "uuid": "OR_XXXX", "value": ["Viber"] } ]
}
```

Сумма: 2249+80+290 = 2619 ✓; 2619 − 130 = 2489 ✓ (130 = trunc(2619×5/100)).

### D.5 Заказ со скидкой за количество + 2 SKU

CZ-20261013-BD3D52 (реальный): M4.0 Kia «дно+стінка» ×2 (2×2619=5238) + L4.0 «на стінці» (2590) + L4.0 «дно+стінка» (2690). subtotal 10518, quantity_discount 500, total 10018.

```json
{
  "source_id": 12,
  "source_uuid": "CZ-20261013-BD3D52",
  "buyer": { "full_name": "…", "phone": "+380…" },
  "discount_amount": 500,
  "manager_comment": "Знижка за кількість: 500 ₴ (quantity-3).",
  "products": [
    { "sku": "M4.0", "price": 2249, "quantity": 2, "purchased_price": 0,
      "comment": "Фіксація: 2 шт — фікс.дно+стінка" },
    { "sku": "FIX-M-DW", "price": 80, "quantity": 2, "purchased_price": 0 },
    { "sku": "KIA-ST", "price": 290, "quantity": 2, "purchased_price": 0 },
    { "sku": "L4.0", "price": 2590, "quantity": 2, "purchased_price": 0,
      "comment": "Фіксація: 1 шт — фікс.на стінці; 1 шт — фікс.дно+стінка" },
    { "sku": "FIX-L-DW", "price": 100, "quantity": 1, "purchased_price": 0 }
  ]
}
```

Сумма: 2249×2 + 80×2 + 290×2 + 2590×2 + 100 = 4498+160+580+5180+100 = 10518 ✓; −500 = 10018 ✓.

### D.6 Проверка API keyCRM по спеке (7.5)

| Вопрос | Ответ (источник) |
|---|---|
| Привязка товара по SKU | да, `products[].sku`; достаточно sku+price+purchased_price, остальное тянется из каталога (help «send-orders-via-api», [SPEC] `createNewOrder`) |
| properties у позиции | да, `products[].properties: [{name, value}]` ([SPEC]); атрибут без name/value игнорируется |
| Комментарий позиции | **да**, `products[].comment` — «Коментар до товару», обновляется в PUT всегда ([SPEC]) |
| Объединение одинаковых SKU CRM-ом | **не подтверждено документацией** — мы объединяем сами на своей стороне; поведение при разных properties у одного SKU не описано (тест на стенде) |
| Платные допродажи | отдельной строкой products[] с собственным sku («разовые» товары тоже допустимы — [ONE-TIME]); флаг `upsale` только для чтения |
| Скидки | на позицию: `products[].discount_percent/amount`; на заказ: `discount_percent`/`discount_amount` (фикс. сумма) + `promocode` ([SPEC]) |
| Итоговая сумма | отдельного поля «итог» нет — CRM считает `grand_total` из строк − скидки; для совпадения с Supabase нужно, чтобы Σ строк = subtotal и discount_amount = обе скидки |
| status_id при создании | **нельзя** (нет в POST-схеме) — только `PUT /order/{orderId}` после создания |
| Курс/валюта | валюта источника/каталога, UAH |
| Лимит | 20 запросов/мин на API-ключ |

Не подтверждено и не используется: поле Ref города НП (`city_ref`) в keyCRM нет — только текст `shipping_address_city`; отдельного поля «номер отделения» нет — `warehouse_ref` (UUID склада НП, обязательно вместе с `delivery_service_id`) + текст `shipping_receive_point`; подписи/секрета у webhook нет (только статические query-параметры в URL).

---

## E. Источник заказов «Сайт»

- Список источников: `GET https://openapi.keycrm.app/v1/order/source` ([SPEC] `getPaginatedListOfSources`). Поля: `id` (integer), `name`, `alias`, `driver`, `source_uuid` (uuid магазина источника — не путать с uuid заказа), `currency_code`.
- Создание источника — **только через UI keyCRM** (справка «Как добавить источник»); API-создания источника в спеке нет. Если источника «Сайт»/«Сайт Carzo» нет — владелец создаёт его вручную (Настройки → Источники), затем передаёт нам `id`.
- Передача при создании заказа: `source_id` (обязательное поле). Значение — в env `KEYCRM_SOURCE_ID`.
- `source_uuid` на заказе = «Номер замовлення у джерелі» — используем **существующий `orders.order_number`** (`CZ-YYYYMMDD-XXXXXX`). Он стабилен, уникален и уже генерится RPC; случайный id не создаём.
- Дедупликация: повторный `POST /order` с тем же `source_uuid` в том же источнике отклоняется keyCRM («The source uuid has already been taken», FAQ Q8). Это наша штатная защита от дублей на стороне CRM — в дополнение к `checkout_attempt_id` в Supabase.
- Отдельное пользовательское поле для источника не создаётся.

## F. Дополнительное поле «Спосіб зв'язку»

Данные Carzo: `orders.contact_method` enum(`phone`,`telegram`,`viber`,`whatsapp`) — `lib/cart/contact-method.ts:1`, метки UI: «Зателефонувати» / «Telegram» / «Viber» / «WhatsApp».

keyCRM: поля создаются **только в UI** («Свои поля в заказы»); API — только чтение `GET /custom-fields?include=options` ([SPEC] `getListOfCustomFields`). Нужно поле модели `order`, тип `select` (список), с 4 опциями, **текст которых обязан точно совпадать** с передаваемыми значениями (иначе значение молча не применяется).

Передача при создании заказа:

```json
"custom_fields": [ { "uuid": "OR_XXXX", "value": ["Telegram"] } ]
```

`uuid` = «внешний идентификатор поля» (формат вида `OR_1037`), для select значение — **массив строк** ([SPEC], help «dopolnitelnye polya»). Маппинг: phone→`["Зателефонувати"]`, telegram→`["Telegram"]`, viber→`["Viber"]`, whatsapp→`["WhatsApp"]`.

Не создаём доп. поля для: номера заказа (это `source_uuid`), источника (`source_id`), телефона/имени/суммы (стандартные поля `buyer`/`grand_total`), доставки (стандартный `shipping`). Размер/дизайн/фіксація/шильд — атрибуты товарных позиций (`products[].sku` + `comment`/`properties`), не заказа.

## G. Программа лояльности

### G.1 Текущее поведение → изменение

Сейчас `checkout.ts:348-355` после каждого созданного заказа вызывает `upsertCustomerByPhone({source:'site', imported:false})` → заявка без покупки сразу даёт 5% в дальнейшем. **Изменение: убрать этот вызов.** Всё остальное в лояльности (lookup, расчёт 5%, превью, checkout) не трогаем.

### G.2 Новое правило

Право на 5% — только после первой **фактически завершённой** покупки (любой источник: Сайт, Rozetka, офлайн, Instagram, Viber…). Заявка / отмена / отправлен-но-не-получен — скидки не дают.

### G.3 keyCRM → Supabase customers (webhook)

Маршрут (единственный разумный по документации):

1. В keyCRM: триггер автоматизации (Настройки → Дополнительно → Автоматизация) с событием **«Изменение статуса заказа»** (`order.change_order_status`), отфильтрованный по финальному статусу (значение статуса выбирается в триггере), действие «Отправить Webhook» (POST) на `https://carzo-storefront.vercel.app/api/keycrm/webhook?secret=<KEYCRM_WEBHOOK_SECRET>`. Подписи/HMAC в keyCRM нет — статический query-параметр и есть единственный документированный механизм защиты ([WEBHOOK]).
2. Новый endpoint `app/api/keycrm/webhook/route.ts`:
   - проверка `secret`, rate limit как в `customer-discount/check`;
   - тело `{event, context}`; принимаем только `event === "order.change_order_status"` и `context.status_id === KEYCRM_COMPLETED_STATUS_ID` (дополнительная защита, даже если триггер уже отфильтрован);
   - в webhook-контексте **нет телефона покупателя** — поэтому `GET /order/{id}?include=buyer` ([WEBHOOK] явно требует доп. запрос для деталей; [SPEC] `getOrderById`);
   - `normalizeCustomerPhone(buyer.phone)` → валидный → `upsertCustomerByPhone({phone, fullName: buyer.full_name, source: 'keycrm', imported: false})` — существующая merge-политика не затирает provenance исторических записей;
   - ответ 200 (иначе keyCRM повторит, всего 3 попытки).
3. Работает для **всех** источников заказов keyCRM (триггер не фильтруем по источнику) — условие «покупка состоялась» = финальный статус.

Финальный статус: владелец определяет в `GET /order/status` (`id`, `name`, `alias`, `group_id`, `is_closing_order`). Системные «Новый/Выполнен/Отменен» зарезервированы. Никаких выдуманных status_id — конфиг в env `KEYCRM_COMPLETED_STATUS_ID`.

### G.4 Что сохраняется / чего нет

- Все 5998 существующих записей customers остаются нетронутыми; скриптов очистки/миграции нет; новой таблицы `loyalty_members` не создаём.
- Новые покупатели перестают появляться «по факту заявки»; появляются «по факту завершённой покупки» (с любого канала keyCRM).
- 4 уже существующих «сайтовых» клиента (imported=false) остаются с правом на скидку — ретроактивно ничего не отбираем.

### G.5 Риски и штатные проверки

- Потеря webhook (keyCRM: 3 попытки → отказ) — клиент не попадёт в customers автоматически. Отдельной системы восстановления **не строим** (по заданию). Штатная проверка: менеджер видит завершённый заказ в CRM; при обращении клиента «где моя скидка» — ручной upsert (или разовый скрипт по заказам в финальном статусе, если понадобится позже). Логируем (без ПДн) каждую обработку webhook.
- Срабатывание по статусу, который менеджер поставил ошибочно → скидка выдана преждевременно. Минимизация: фильтр статуса в триггере + проверка status_id в коде.
- Прекращение авто-upsert не ломает: поиск постоянного клиента (`findCustomerByPhone` не трогаем), подтверждение телефона, расчёт 5%, checkout, Telegram — все они не зависят от момента создания записи.

---

## H. Изменения в коде

### Создать (новое)

| Файл | Назначение |
|---|---|
| `product-page/lib/keycrm/client.ts` | серверный API-клиент: `createOrder(payload)`, `getOrder(id, include)`, `listSources()`, `listStatuses()`, `listCustomFields()`; Bearer auth, timeout, обработка 429/5xx, логирование без ПДн |
| `product-page/lib/keycrm/order-payload.ts` | сборка payload из `OrderSnapshot` + quote: группировка по базовому SKU, комментарии фиксацій, строки FIX-*/ST, discount_amount, custom_fields, shipping-блок |
| `product-page/lib/keycrm/sku.ts` | маппинг-таблицы: `(size, designVersion) → SKU кейса`, `fixation 'both' → FIX-{S\|M\|L\|XL}-DW`, `brand_slug → {BRAND}-ST` (25 строк, не формула) |
| `product-page/app/api/keycrm/webhook/route.ts` | входящий webhook завершённого заказа → upsert customers |

### Изменить

| Файл | Что |
|---|---|
| `product-page/app/actions/checkout.ts` | в `runPostOrderSideEffectsOnCreate` добавить третий best-effort callback `pushToKeyCrm` (после Telegram; ошибка логируется, заказ остаётся успешным); **убрать** вызов `upsertCustomerByPhone` |
| `product-page/lib/cart/checkout-reliability.ts` | расширить `PostOrderSideEffectsInput` опциональным `pushToKeyCrm?: () => Promise<void>` (та же семантика try/catch) |
| `product-page/lib/cart/server.ts` | в `CartQuoteLine` добавить компоненты цены `basePrice`, `logoExtra`, `fixationExtra` (нужны для корректного разделения unit_price при сборке payload; формула уже известна на строке 105) |
| `product-page/.env.example` | документация новых переменных |

### Не менять

Checkout RPC и его идемпотентность, `checkout-attempt.ts`, Telegram-подсистему, `loyalty-math.ts`/процент 5%, `findCustomerByPhone` и UI-превью, `customers` merge-политику, Nova Poshta-интеграцию, валидацию корзины, каталог Supabase, структуру `order_items`, страницы/компоненты витрины.

---

## I. Изменения Supabase

**Не требуются.** Все данные для корректной передачи либо уже есть (`orders.*`, `order_items.*`), либо вычисляются в момент отправки из того же каталога, что и котировка (отправка синхронна созданию заказа в рамках одного server-action).

Опциональное предложение (не применять в этой фазе): если позже понадобится ручная пересылка заказа из БД после изменения цен каталога — добавить в `order_items` три nullable-колонки `base_price`, `logo_extra`, `fixation_extra` и писать их в RPC. До появления такой необходимости расширение не нужно.

---

## J. Проверки (план тестов до Production)

Безопасно: юнит-тесты на сборщик payload (чистая функция), заказы только на staging, webhook — на webhook.site / локальный URL, ключ — тестовый/песочница.

| # | Сценарий | Что проверяем |
|---|---|---|
| 1 | Один автокейс | 1 строка products, sku верный, сумма = subtotal |
| 2 | Два одинаковых кейса, одинаковая фиксація | 1 строка, qty 2, комментарий одной строкой |
| 3 | Два одинаковых, разные бесплатные фиксаціи | 1 базовая строка qty 2 + комментарий с распределением |
| 4 | Кейс с платной фиксаціей | база + FIX-*-DW отдельной строкой, без двойного начисления |
| 5 | Кейс с платным шильдом | база + {BRAND}-ST отдельной строкой, unit_price разделён |
| 6 | Несколько кейсов с разными SKU | разные базовые строки, без слияния |
| 7 | Скидка за количество | discount_amount = quantity_discount, итог = total |
| 8 | Скидка постоянного клиента 5% | discount_amount включает loyalty-часть, разбивка в manager_comment |
| 9 | Точное совпадение суммы | Σ(products) − discount_amount = orders.total во всех кейсах 1–8 |
| 10 | Источник «Сайт» | source_id из env, заказ виден в нужном источнике |
| 11 | Способ связи | custom_fields значение = выбранное, опция не теряется |
| 12 | Повторная отправка того же заказа | второй заказ в CRM не создаётся (source_uuid дедуп) |
| 13 | Ошибка API keyCRM (таймаут/500/429) | checkout успешен, в логе ошибка без ПДн, Telegram пришёл |
| 14 | Новый клиент не добавляется при заявке | после checkout customers не вырос |
| 15 | Клиент добавляется после завершённой покупки | webhook → upsert, скидка активна со следующего заказа |
| 16 | Заказ Rozetka (в CRM) → финальный статус | тот же webhook добавляет клиента |
| 17 | Существующий клиент не дублируется | upsert по телефону — 1 строка, provenance не затёрт |
| 18 | Исторические клиенты сохраняют 5% | выборка до/после изменений идентична по составу |
| 19 | Telegram без изменений | то же сообщение, тот же чат, при ошибке keyCRM тоже |

---

## K. Настройки владельца (keyCRM + Vercel)

1. **Источник.** keyCRM: проверить/создать источник «Сайт» (или «Сайт Carzo»). Узнать id: `GET /order/source` (или в UI). → значение в `KEYCRM_SOURCE_ID`.
2. **API-ключ.** keyCRM → Профиль/Настройки → API-ключ. Скопировать **только в Vercel Secrets** (в чат/отчёт не выкладывать).
3. **Поле «Спосіб зв'язку».** keyCRM → заказы → свои поля: создать поле типа «Список» с опциями `Зателефонувати`, `Telegram`, `Viber`, `WhatsApp` (точно в этом написании). Узнать uuid: `GET /custom-fields?include=options&filter[model]=order`. → `KEYCRM_CUSTOM_FIELD_CONTACT_METHOD_UUID`.
4. **Финальный статус.** Определить статус «покупка состоялась / товар получен» (`GET /order/status`, id поля `id`). → `KEYCRM_COMPLETED_STATUS_ID`.
5. **Служба доставки НП.** `GET /order/delivery-service` — id службы «Нова Пошта» (`source_name: novaposhta`). → `KEYCRM_DELIVERY_SERVICE_ID`.
6. **Webhook-триггер.** keyCRM → Настройки → Дополнительно → Автоматизация: событие «Изменение статуса заказа» со значением статуса из п.4; действие «Отправить Webhook», POST, URL `https://<домен>/api/keycrm/webhook?secret=<секрет>`. Секрет придумать → `KEYCRM_WEBHOOK_SECRET`.
7. **Vercel (Production + staging):** добавить `KEYCRM_API_KEY`, `KEYCRM_SOURCE_ID`, `KEYCRM_CUSTOM_FIELD_CONTACT_METHOD_UUID`, `KEYCRM_COMPLETED_STATUS_ID`, `KEYCRM_DELIVERY_SERVICE_ID`, `KEYCRM_WEBHOOK_SECRET`. Redeploy.
8. **Опционально — payments.** Решить, передавать ли блок `payments[]` (например `payment_method` «Післяплата», `status: not_paid`). На сайте выбора оплаты нет; без блока заказ просто создаётся без платежа.
9. **Вопрос по каталогу.** Нужны ли на витрине 2XL / BYD / AMG / Custom-шильд (SKU уже есть в CRM) и что такое `CUSTOM-ST`.
10. **Перед боем** — прогнать список J на staging.

---

## L. План реализации (минимальные последовательные задачи)

1. **Клиент keyCRM.** Цель: серверный HTTP-клиент openapi.keycrm.app/v1. Изменения: `lib/keycrm/client.ts` (+ тесты на разбор ошибок). Критерии: createOrder/getOrder работают против тестового ключа, ошибки нормализуются, ПДн в логах нет.
2. **SKU-маппинг и сборщик payload.** Цель: чистая функция `buildKeyCrmOrder(order, quote)`. Изменения: `lib/keycrm/sku.ts`, `lib/keycrm/order-payload.ts`, расширение `CartQuoteLine` компонентами цены, юнит-тесты на сценарии J1–J9 (включая точность сумм). Критерии: суммы payload = subtotal/total из снапшота во всех кейсах.
3. **Отправка заказов.** Цель: новые заказы попадают в keyCRM с источником «Сайт». Изменения: `checkout.ts` + `checkout-reliability.ts` (третий side-effect), env. Критерии: заказ создаётся в CRM, source_id верный, source_uuid = order_number, ошибка CRM не ломает checkout, replay не дублирует.
4. **Поле «Спосіб зв'язку».** Изменения: маппинг contact_method → custom_fields в payload. Критерии: значение видно в CRM (J11).
5. **Стоп-регистрация по заявке.** Изменения: удалить `upsertCustomerByPhone` из checkout. Критерии: J14, J18; лояльный lookup работает как раньше.
6. **Webhook завершённой покупки.** Изменения: `app/api/keycrm/webhook/route.ts` (+ нормализация телефона, upsert `source:'keycrm'`). Критерии: J15–J17, ответ 200, повторный webhook идемпотентен.
7. **Стендовые проверки и задокументирование env.** Критерии: чек-лист J пройден на staging, `.env.example` обновлён.

### Блокирующие вопросы (без кабинета keyCRM / решения владельца)

1. `KEYCRM_SOURCE_ID` — id источника «Сайт» (создать в UI, если нет).
2. UUID пользовательского поля «Спосіб зв'язку» после его создания в UI.
3. `KEYCRM_COMPLETED_STATUS_ID` — какой статус означает «покупка состоялась».
4. `KEYCRM_DELIVERY_SERVICE_ID` — id службы НП в keyCRM.
5. API-ключ (попадает только в Vercel Secrets).
6. Секрет webhook-URL (задаётся при настройке триггера).
7. Передавать ли `payments[]` и каким методом.
8. Судьба осиротевших SKU: FIX-2XL-DW, BYD-ST, AMG-ST, CUSTOM-ST (и является ли CUSTOM-ST фирменным шильдом Carzo).
9. Подтверждение непроверяемых по документации фактов на стенде: поведение CRM при разных `properties` у одинакового SKU, принятие цены строки, отличающейся от цены каталога (ожидаем: принимается — цена передаётся в строке).

---

*Конец отчёта Phase 0. Реализация не начата.*
