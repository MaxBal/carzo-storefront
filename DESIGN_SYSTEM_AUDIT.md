# Carzo Design System Audit

## 1. Краткое резюме

Проект Carzo использует кастомную дизайн-систему поверх Tailwind CSS и shadcn/ui. Основные цвета: чёрный `#000000`, белый `#ffffff`, серая шкала и фирменный мятно-зелёный акцент `#5ce4ab`. Шрифт — Inter (Google Fonts). Типографика не стандартизирована: используются произвольные значения `13px`, `15px`, `17px`, `19px` наряду с системными шагами Tailwind.

**Статистика:**
- Уникальных цветов: ~45 (включая оттенки серой шкалы)
- Семейств шрифтов: 1 (Inter)
- Уникальных размеров шрифта: ~22
- Типографических комбинаций: ~60+
- Близких дублей и несогласованностей: ~15

---

## 2. Область анализа

Анализированы все страницы и компоненты проекта, кроме контента, используемого исключительно на главной странице.

### Проанализированные страницы:
- Карточка товара (`/case/design/[...slug]`)
- Страница «Про нас» (`/about`)
- Страница 404 (`/_not-found`)
- Корзина (CartDrawer)
- Checkout (форма оформления заказа)
- Глобальный Header
- Глобальный Footer
- Мобильное меню
- Все модальные окна (InfoModal, LogoModal, BenefitModal, SimpleModal, ReviewsModal)
- Общие UI-компоненты (button, input, select, dialog)

### Исключённые компоненты:
- `components/cms/PageRenderer.tsx` — блоки контента главной страницы (hero, feature grid, CTA и т.д.)
- `components/cms/PageFooter.tsx` — старый футер (заменён на новый глобальный)
- Контентные блоки Directus, используемые только на главной

---

## 3. Используемые шрифты

| Шрифт | Тип | Подключение | Начертания | Использование |
|-------|-----|-------------|------------|---------------|
| **Inter** | Основной | Google Fonts (`next/font/google`) | 400, 500, 600, 700, 900 | Весь текст проекта |

**Fallback-цепочка:** `'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif`

**Примечание:** Все начертания реально используются. Шрифт подключён с подмножествами `latin` и `cyrillic`.

---

## 4. Размеры и стили типографики

### 4.1. Заголовки

| Роль | Размер | Вес | Межстрочный | Трекинг | Цвет | Где используется |
|------|--------|-----|-------------|---------|------|-----------------|
| H1 (product) | 24px (text-2xl) | 700 | 1.25 (leading-tight) | — | black | ProductOptions |
| H1 (about hero) | 32px / 40px / 48px | 900 | 1.25 (leading-tight) | -0.025em (tracking-tight) | black | about/page.tsx |
| H1 (404) | 36px / 60px | 900 | — | -0.025em | black | not-found.tsx |
| H2 (section) | 24px / 28px / 32px | 700 | 1.25 (leading-tight) | — | black | about/page.tsx, CaseReviewsSection |
| H2 (reviews) | 28px / 32px / 36px | 700 | 1.25 / 1.15 | — | black | CaseReviewsSection |
| H3 (rich content) | text-2xl (24px) | 700 | — | — | white | ProductRichContent |
| H3 (modal) | 20px / 22px | 700 | 1.25 | — | #111827 | globals.css (.modal-title) |
| H3 (footer) | 13px | 600 | — | 0.05em (tracking-wider) | gray-400 | Footer |
| H4 (modal card) | 16px | 600 | 1.35 | — | #111827 | globals.css (.modal-card-title) |

### 4.2. Основной текст

| Роль | Размер | Вес | Межстрочный | Цвет | Где используется |
|------|--------|-----|-------------|------|-----------------|
| Body (modal) | 16px | 400 | 1.5 | #4d4d4d | globals.css (.modal-body-text) |
| Body (about) | 15px / 16px / 17px | 400 | 1.625 (leading-relaxed) | gray-600 | about/page.tsx |
| Body (reviews) | 14px / 16px / 17px | 400 | 1.625 | gray-600 | CaseReviewsSection |
| Body (SimpleModal) | 15px | 400 | 1.625 | gray-600 | SimpleModal |
| Body (cart) | 14px / 16px | 400 | — | gray-600 | CartDrawer |

### 4.3. Подписи и вспомогательный текст

| Роль | Размер | Вес | Цвет | Где используется |
|------|--------|-----|------|-----------------|
| Subtitle (modal) | 16px | 400 | #858585 | globals.css (.modal-subtitle) |
| Secondary (modal) | 14px | 400 | #858585 | globals.css (.modal-secondary-text) |
| Caption (reviews date) | 12px | — | gray-500 | CaseReviewsSection |
| Caption (footer copyright) | 12px | — | gray-500 | Footer |
| Caption (footer legal) | 13px | — | gray-400 | Footer |
| Label (overview-btn) | 13px | 400 | #4d4d4d | globals.css (.overview-btn) |
| Label (footer section) | 13px | 600 | gray-400 | Footer |
| Helper (form) | 12px (text-xs) | — | gray-500 | NovaPoshtaSelector |

### 4.4. Навигация

| Роль | Размер | Вес | Межстрочный | Трекинг | Цвет | Где используется |
|------|--------|-----|-------------|---------|------|-----------------|
| Desktop nav | 15px | 400 | 20px (leading-5) | -0.01em | #f2f2f2 | Header |
| Mobile nav (top) | 18px (text-lg) | 400 | 24px (leading-6) | — | white | Header |
| Mobile nav (child) | 16px (text-base) | 400 | 20px (leading-5) | — | gray-400 | Header |
| Footer link | 14px | — | — | — | gray-300 | Footer |
| Footer accordion | 15px | 500 | — | — | white | Footer |

### 4.5. Кнопки и CTA

| Роль | Размер | Вес | Межстрочный | Цвет | Где используется |
|------|--------|-----|-------------|------|-----------------|
| CTA (primary) | 15px / 16px | 600 / 700 | 24px (leading-6) | white on black | ProductOptions, CartDrawer |
| CTA (reviews) | 14px | 500 | 20px (leading-5) | #181818 on #5ae4aa | CaseReviewsSection |
| Phone CTA (mobile) | 16px (text-base) | 600 | 24px (leading-6) | white | Header, Footer |
| Button (shadcn) | 14px (text-sm) | 500 | — | varies by variant | ui/button.tsx |
| Overview btn | 13px | 400 | 16px | #4d4d4d | globals.css |

### 4.6. Карточки товара

| Роль | Размер | Вес | Цвет | Где используется |
|------|--------|-----|------|-----------------|
| Price (current) | 26px / 32px | 600 | black | ProductOptions |
| Price (old) | 16px (text-base) | — | #9aa1ac (line-through) | ProductOptions |
| Sale badge | 12px (text-xs) | — | #f97316 on #ffe3cc | ProductOptions |
| Size label | 14px (text-sm) | 500 | gray-900 | ProductOptions |
| Size price | 12px (text-xs) | — | gray-500 | ProductOptions |
| Design label | 16px (text-base) | 600 | black | ProductOptions |
| Characteristics | 14px (text-sm) | 400 | gray-900 | ProductOptions |

### 4.7. Модальные окна

| Роль | Размер | Вес | Межстрочный | Цвет | Где используется |
|------|--------|-----|-------------|------|-----------------|
| Modal title | 20px / 22px | 700 | 1.25 | #111827 | globals.css |
| Modal subtitle | 16px | 400 | 1.4 | #858585 | globals.css |
| Modal body | 16px | 400 | 1.5 | #4d4d4d | globals.css |
| Modal FAQ question | 16px | 600 | 1.35 | #111827 | globals.css |
| Modal FAQ answer | 16px | 400 | 1.5 | #4d4d4d | globals.css |
| Modal secondary | 14px | 400 | 1.4 | #858585 | globals.css |
| Modal tab | 15px | 500 | 1.35 | #9ca3af / #111827 | globals.css |
| Modal card title | 16px | 600 | 1.35 | #111827 | globals.css |
| Benefit hero value | text-5xl (48px) | 900 | — | #5ce4ab | BenefitModal |
| Benefit discount | text-2xl (24px) | 700 | — | #5ce4ab | BenefitModal |

### 4.8. Корзина и checkout

| Роль | Размер | Вес | Цвет | Где используется |
|------|--------|-----|------|-----------------|
| Cart title | text-lg (18px) | 700 | black | CartDrawer |
| Cart total | text-lg (18px) | 700 | black | CartDrawer |
| Cart item title | 14px (text-sm) | 500 | gray-900 | CartDrawer |
| Cart item quantity | 14px (text-sm) | 600 | black | CartDrawer |
| Cart form label | 14px (text-sm) | 500 | gray-900 | CartDrawer |
| Cart input | 16px / 14px (sm) | — | — | CartDrawer |
| Cart empty heading | text-xl (20px) | — | — | CartDrawer |
| Cart empty text | text-base (16px) | — | gray-500 | CartDrawer |
| Order confirmation | text-2xl (24px) | 700 | — | CartDrawer |

---

## 5. Различия между desktop и mobile

| Элемент | Desktop | Mobile | Breakpoint | Где используется |
|---------|---------|--------|------------|-----------------|
| Header nav text | 15px, #f2f2f2 | 18px (top) / 16px (child), white/gray-400 | md (768px) | Header |
| Modal position | Centered | Bottom sheet | md (768px) | globals.css |
| Modal border-radius | 16px | 24px 24px 0 0 | md (768px) | globals.css |
| Modal title size | 22px | 20px | md (768px) | globals.css |
| Product price | 32px | 26px | sm (640px) | ProductOptions |
| Reviews title | 36px | 28px | lg (1024px) | CaseReviewsSection |
| Reviews description | 17px | 14px | lg (1024px) | CaseReviewsSection |
| About hero heading | 48px | 32px | lg (1024px) | about/page.tsx |
| About section heading | 32px | 24px | lg (1024px) | about/page.tsx |
| About body text | 17px | 15px | sm (640px) | about/page.tsx |
| Footer layout | 5-column grid | Accordion | md (768px) | Footer |
| Footer section header | 13px, uppercase, gray-400 | 15px, medium, white | md (768px) | Footer |
| Cart input size | 14px (sm) | 16px | sm (640px) | CartDrawer |
| Gallery | Thumbnails (80x80) | Swipe carousel + dots | md (768px) | ProductGallery |
| 404 heading | 60px | 36px | sm (640px) | not-found.tsx |

---

## 6. Полная палитра цветов

### 6.1. Основная палитра

| HEX | Название | Назначение |
|-----|----------|------------|
| `#000000` | Black | Header bg, footer bg, mobile menu bg, CTA buttons, text |
| `#ffffff` | White | Body bg, modal bg, cart bg, text on dark |
| `#5ce4ab` | Brand Teal | Основной акцент: hover, badge, pill, иконки |
| `#5ae4aa` | Brand Teal (variant) | Reviews CTA button |
| `#4cd99d` | Brand Teal (hover) | Reviews CTA hover |
| `#40cc91` | Brand Teal (active) | Reviews CTA active |
| `#28C5A6` | Brand Teal (deep) | Magnet icon, design dots |
| `#159E85` | Brand Teal (text) | CMS links, cart discount, 404 label |
| `#F0FCF9` | Teal Light | Logo preview button bg |
| `#E5F9F4` | Teal Light (hover) | Logo preview button hover |

### 6.2. Серая шкала

| HEX | Tailwind | Назначение |
|-----|----------|------------|
| `#111827` | gray-900 | Modal title, FAQ question, card title, active tab |
| `#1A1A1A` | — | Active border (design, size) |
| `#181818` | — | Rich content info card bg, reviews CTA text |
| `#222` | — | Hover text (overview-btn) |
| `#4d4d4d` | — | Modal body, close icon, overview-btn text |
| `#596170` | — | Size option inactive text |
| `#626975` | — | Brand info text |
| `#6b7280` | gray-500 | CMS blockquote text |
| `#858585` | — | Modal subtitle, secondary text, focus ring |
| `#9aa1ac` | — | Old price strikethrough |
| `#9ca3af` | gray-400 | Modal tab inactive |
| `#cfcfcf` | — | Hover border |
| `#d1d5db` | gray-300 | Gallery inactive dot |
| `#dedede` | — | Card border, modal border, overview-btn border |
| `#e5e7eb` | gray-200 | Inactive border (design, size) |
| `#e8e8e8` | — | Modal close hover bg |
| `#ececec` | — | Overview-btn active bg |
| `#f0f0f0` | — | Nested block bg, divider, info icon bg |
| `#f2f2f2` | — | Header nav text |
| `#f3f3f3` | — | Overview-btn hover bg, modal close bg |
| `#f5f7f6` | — | 404 page bg |
| `#F7F7F7` | — | Size option active bg |
| `#fafafa` | — | Card bg, info box bg, FAQ bg, overview-btn bg |

### 6.3. Семантические цвета

| HEX | Назначение |
|-----|------------|
| `#f97316` | Sale badge text (orange) |
| `#ffe3cc` | Sale badge bg (light orange) |
| `#ef4444` (red-500) | Error borders |
| `#dc2626` (red-600) | Error text |
| `#fef2f2` (red-50) | Error bg |
| `#b91c1c` (red-700) | Error text (darker) |

### 6.4. Прозрачность / Alpha

| Значение | Назначение |
|----------|------------|
| `bg-black/55` | Cart backdrop (desktop) |
| `bg-black/50` | Modal backdrop (SimpleModal, ReviewsModal) |
| `bg-black/60` | Order confirmation backdrop |
| `bg-black/80` | Dialog overlay (shadcn) |
| `rgba(0,0,0,0.5)` | InfoModal, LogoModal backdrop |
| `rgba(0,0,0,0.45)` | BenefitModal backdrop |
| `rgba(40,197,166,0.12)` | Logo preview icon badge bg |
| `rgba(40,197,166,0.42)` | Magnet icon drop-shadow |
| `border-white/75` | Mobile phone CTA border |
| `border-white/10` | Footer borders |

---

## 7. Цвета по назначению

### 7.1. Текст

| Назначение | Цвет | Где |
|------------|------|-----|
| Основной текст | black / gray-900 | Везде |
| Вторичный текст | gray-600 | About, reviews, cart |
| Третичный текст | gray-500 | Footer copyright, dates, helpers |
| Текст на тёмном фоне | white / #f2f2f2 | Header, footer, mobile menu |
| Текст на зелёном фоне | #181818 | Reviews CTA |
| Акцентный текст | #5ce4ab | Hover states, benefit modal values |
| Ссылки (CMS) | #159e85 | CMS rich text |
| Зачёркнутая цена | #9aa1ac | ProductOptions |
| Ошибка | red-600 | Forms |
| Sale | #f97316 | Sale badge |

### 7.2. Фон

| Назначение | Цвет | Где |
|------------|------|-----|
| Основной фон | white | Body, modals, cards |
| Тёмный фон | black | Header, footer, mobile menu |
| Светло-серый | #fafafa | Cards, info boxes, FAQ |
| Серый | #f0f0f0 | Nested blocks, dividers |
| Очень светлый | #f5f7f6 | 404 page |
| Зелёный акцент | #5ce4ab | Cart badge, pills |
| Зелёный светлый | #F0FCF9 | Logo preview button |
| Ошибка | red-50 | Error states |

### 7.3. Обводки

| Назначение | Цвет | Где |
|------------|------|-----|
| Стандартная | #dedede | Cards, modals, overview-btn |
| Неактивная | #e5e7eb | Design/size options |
| Активная | #1A1A1A | Design/size options |
| Hover | #cfcfcf | Overview-btn, design-option |
| Разделитель | #f0f0f0 | Modal divider, tab bar |
| Footer | white/10 | Footer borders |
| Ошибка | red-400 / red-500 | Form inputs |

### 7.4. Кнопки

| Назначение | Фон | Текст | Где |
|------------|-----|-------|-----|
| Primary CTA | black | white | ProductOptions, CartDrawer |
| Reviews CTA | #5ae4aa | #181818 | CaseReviewsSection |
| Phone CTA | transparent | white | Header, Footer |
| Modal close | #f3f3f3 | #4d4d4d | Modals |
| Overview btn | #fafafa | #4d4d4d | ProductOptions |
| Shadcn primary | bg-primary | primary-foreground | UI primitives |
| Shadcn destructive | bg-destructive | destructive-foreground | UI primitives |

### 7.5. Модальные окна

| Элемент | Цвет |
|---------|------|
| Overlay | black/50 или rgba(0,0,0,0.5) |
| Panel bg | white |
| Title | #111827 |
| Subtitle | #858585 |
| Body text | #4d4d4d |
| Close bg | #f3f3f3 |
| Close hover | #e8e8e8 |
| Close active | #dedede |
| Divider | #f0f0f0 |
| Tab inactive | #9ca3af |
| Tab active | #111827 |
| Card bg | #fafafa |
| Card border | #dedede |

---

## 8. CSS-переменные и дизайн-токены

### 8.1. Определённые CSS-переменные

| Переменная | Значение | Файл |
|------------|----------|------|
| `--teal` | `#5ce4ab` | globals.css:45 |

### 8.2. Tailwind semantic tokens (из конфига)

| Токен | Определение | Фактическое значение |
|-------|-------------|---------------------|
| `background` | `hsl(var(--background))` | Не определена в globals.css |
| `foreground` | `hsl(var(--foreground))` | Не определена |
| `primary` | `hsl(var(--primary))` | Не определена |
| `primary-foreground` | `hsl(var(--primary-foreground))` | Не определена |
| `destructive` | `hsl(var(--destructive))` | Не определена |
| `border` | `hsl(var(--border))` | Не определена |
| `input` | `hsl(var(--input))` | Не определена |
| `ring` | `hsl(var(--ring))` | Не определена |
| `accent` | `hsl(var(--accent))` | Не определена |
| `muted` | `hsl(var(--muted))` | Не определена |

**Примечание:** Большинство shadcn CSS-переменных не определены в globals.css. UI-компоненты используют значения по умолчанию из shadcn или Tailwind.

---

## 9. Близкие дубли и несогласованности

### 9.1. Цветовые дубли

| Группа | Цвета | Рекомендация |
|--------|-------|-------------|
| Brand teal (основной) | `#5ce4ab`, `#5ae4aa`, `#4cd99d`, `#40cc91` | Оставить `#5ce4ab` как основной, варианты hover/active вычислять программно |
| Brand teal (глубокий) | `#28C5A6`, `#159E85` | `#28C5A6` используется только для magnet icon — можно объединить с `#5ce4ab` |
| Серый (тёмный) | `#111827`, `#1A1A1A`, `#181818`, `#222` | Различия минимальны. `#111827` — стандартный для заголовков, остальные — локальные |
| Серый (средний) | `#4d4d4d`, `#596170`, `#626975`, `#6b7280` | `#4d4d4d` — стандартный для тела, `#6b7280` — для CMS. Остальные — локальные |
| Серый (светлый) | `#dedede`, `#e5e7eb`, `#E5E7EB` | `#dedede` и `#e5e7eb` отличаются на 4 единицы. Объединить |
| Фон (светлый) | `#fafafa`, `#f5f7f6`, `#F7F7F7`, `#f3f3f3` | `#fafafa` — стандартный. Остальные — локальные вариации |

### 9.2. Типографические несогласованности

| Проблема | Детали | Рекомендация |
|----------|--------|-------------|
| Произвольные размеры | 13px, 15px, 17px, 19px, 26px | Стандартизировать на 12/14/16/18/20/24/32/48 |
| Разные веса для одной роли | Footer section header: 600 на desktop, 500 на mobile | Унифицировать |
| Разные цвета для одной роли | Modal body: #4d4d4d в CSS, gray-600 в компонентах | Выбрать один |
| Несогласованный line-height | Modal body: 1.5, About body: 1.625, Reviews: 1.625 | Стандартизировать на 1.5 или 1.625 |
| Tracking только в некоторых местах | Header nav: -0.01em, About hero: -0.025em, Footer: 0.05em | Стандартизировать |

### 9.3. Дубли стилей модалок

| Проблема | Детали |
|----------|--------|
| Два типа модалок | `modal-shell` (CSS) и `SimpleModal` (inline styles) — разные реализации |
| Backdrop | 4 разных значения прозрачности: 0.45, 0.5, 0.55, 0.8 |
| Border-radius | 16px (desktop CSS), 24px (mobile CSS), 16px (SimpleModal), 12px (карточки) |

---

## 10. Рекомендованная унифицированная палитра

### Основные цвета

| Токен | HEX | Назначение |
|-------|-----|------------|
| `--color-black` | `#000000` | Текст, фон header/footer |
| `--color-white` | `#ffffff` | Фон, текст на тёмном |
| `--color-brand` | `#5ce4ab` | Основной акцент |
| `--color-brand-hover` | `#4cd99d` | Hover-состояние акцента |
| `--color-brand-active` | `#40cc91` | Active-состояние акцента |
| `--color-brand-light` | `#F0FCF9` | Светлый фон акцента |

### Серая шкала

| Токен | HEX | Назначение |
|-------|-----|------------|
| `--color-gray-900` | `#111827` | Заголовки, активный текст |
| `--color-gray-700` | `#374151` | Основной текст |
| `--color-gray-600` | `#4b5563` | Вторичный текст |
| `--color-gray-500` | `#6b7280` | Третичный текст, подписи |
| `--color-gray-400` | `#9ca3af` | Неактивный текст |
| `--color-gray-300` | `#d1d5db` | Неактивные элементы |
| `--color-gray-200` | `#e5e7eb` | Обводки |
| `--color-gray-100` | `#f3f4f6` | Светлые фоны |
| `--color-gray-50` | `#f9fafb` | Очень светлые фоны |

### Семантические

| Токен | HEX | Назначение |
|-------|-----|------------|
| `--color-error` | `#ef4444` | Ошибки |
| `--color-success` | `#22c55e` | Успех |
| `--color-warning` | `#f97316` | Предупреждения, sale |

---

## 11. Рекомендованная типографическая шкала

| Размер | Название | Использование |
|--------|----------|---------------|
| 12px | xs | Подписи, даты, helper text |
| 14px | sm | Мелкий текст, кнопки, лейблы форм |
| 16px | base | Основной текст, поля ввода |
| 18px | lg | Навигация, заголовки аккордеонов |
| 20px | xl | Заголовки модалок (mobile) |
| 24px | 2xl | Заголовки секций, H3 |
| 32px | 3xl | Заголовки страниц, H2 |
| 48px | 4xl | Hero-заголовки, H1 |

### Рекомендованные веса

| Вес | Название | Использование |
|-----|----------|---------------|
| 400 | Regular | Основной текст |
| 500 | Medium | Кнопки, навигация, лейблы |
| 600 | Semibold | Заголовки карточек, цены |
| 700 | Bold | Заголовки секций |
| 900 | Black | Hero-заголовки |

---

## 12. Список проанализированных файлов

| Файл | Тип |
|------|-----|
| `app/globals.css` | Глобальные стили |
| `tailwind.config.ts` | Конфигурация Tailwind |
| `components.json` | Конфигурация shadcn |
| `app/layout.tsx` | Root layout |
| `app/about/page.tsx` | Страница «Про нас» |
| `app/not-found.tsx` | Страница 404 |
| `app/case/design/[...slug]/page.tsx` | Product page (server) |
| `app/case/design/[...slug]/ProductPageClient.tsx` | Product page (client) |
| `components/Header.tsx` | Header |
| `components/Footer.tsx` | Footer |
| `components/ProductOptions.tsx` | Product options |
| `components/ProductGallery.tsx` | Product gallery |
| `components/ProductRichContent.tsx` | Rich content |
| `components/CaseReviewsSection.tsx` | Reviews section |
| `components/BenefitCards.tsx` | Benefit cards |
| `components/BenefitModal.tsx` | Benefit modal |
| `components/InfoModal.tsx` | Info modal |
| `components/LogoModal.tsx` | Logo modal |
| `components/SimpleModal.tsx` | Simple modal (B2B, Blog) |
| `components/ModalProvider.tsx` | Modal provider |
| `components/ManagedProductImage.tsx` | Image with fallback |
| `components/cart/CartDrawer.tsx` | Cart drawer |
| `components/cart/NovaPoshtaSelector.tsx` | Nova Poshta selector |
| `components/cart/NovaPoshtaTrustRow.tsx` | Nova Poshta trust row |
| `components/ui/button.tsx` | shadcn Button |
| `components/ui/dialog.tsx` | shadcn Dialog |
| `components/ui/input.tsx` | shadcn Input |
| `components/ui/select.tsx` | shadcn Select |

---

## 13. Исключённые файлы

| Файл | Причина |
|------|---------|
| `components/cms/PageRenderer.tsx` | Блоки контента главной страницы |
| `components/cms/PageFooter.tsx` | Старый футер (заменён) |
| `components/cms/PageHeader.tsx` | Если существует — только для CMS |
| `content/carzo-content.seed.json` | Seed data, не UI |
| `lib/content/*.ts` | Data layer, не стили |
| `app/page.tsx` | Главная страница |
| `app/[...slug]/page.tsx` | CMS страницы (могут содержать только homepage контент) |
