import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  ACCESS_POLICY_DEFINITIONS,
  ACCESS_ROLE_DEFINITIONS,
  buildAccessGrants,
  managedPermissionCollections,
} from '../directus/access-control.mjs';
import {
  DIRECTUS_COLLECTION_GROUPS,
  DIRECTUS_COLLECTION_NAVIGATION,
  studioTranslations,
} from '../directus/navigation.mjs';

const baseUrl = process.env.DIRECTUS_URL?.replace(/\/$/, '');
const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;

if (!baseUrl || !adminToken) {
  throw new Error('DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN are required');
}

const root = resolve(import.meta.dirname, '..');
const seed = JSON.parse(await readFile(resolve(root, 'content/carzo-content.seed.json'), 'utf8'));
const pageSeed = JSON.parse(await readFile(resolve(root, 'content/carzo-pages.seed.json'), 'utf8'));
const headers = { Authorization: `Bearer ${adminToken}` };
const ORDER_NOTIFICATION_FLOW_NAME = 'Carzo — Нове замовлення';
const ORDER_NOTIFICATION_OPERATION_KEY = 'carzo_new_order_notification';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: options.body instanceof FormData
      ? headers
      : { ...headers, 'Content-Type': 'application/json', ...options.headers },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.errors?.map(error => error.message).join('; ') || `${response.status} ${response.statusText}`;
    const error = new Error(`${options.method || 'GET'} ${path}: ${message}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload?.data ?? payload;
}

function meta(interfaceName, extra = {}) {
  return { interface: interfaceName, width: 'full', ...extra };
}

function field(name, type, interfaceName, schema = {}, fieldMeta = {}) {
  return {
    field: name,
    type,
    interface: interfaceName,
    schema: { is_nullable: true, ...schema },
    meta: meta(interfaceName, fieldMeta),
  };
}

function idField() {
  return field('id', 'uuid', 'input', { is_primary_key: true, is_nullable: false }, {
    hidden: true,
    readonly: true,
    special: ['uuid'],
  });
}

function statusField() {
  return field('status', 'string', 'select-dropdown', {
    default_value: 'draft',
    is_nullable: false,
    max_length: 24,
  }, {
    options: {
      choices: [
        { text: 'Чернетка', value: 'draft', color: '#A2B5CD' },
        { text: 'Опубліковано', value: 'published', color: '#2ECDA7' },
        { text: 'Архів', value: 'archived', color: '#F87171' },
      ],
    },
  });
}

function sortField() {
  return field('sort', 'integer', 'input', { is_nullable: true }, { width: 'half' });
}

function keyField(name = 'key') {
  return field(name, 'string', 'input', { is_nullable: false, is_unique: true, max_length: 128 }, {
    required: true,
    width: 'half',
  });
}

function shortText(name, { required = false, unique = false, width = 'full', note } = {}) {
  return field(name, 'string', 'input', {
    is_nullable: !required,
    is_unique: unique,
    max_length: 255,
  }, { required, width, note });
}

function secretText(name, { note } = {}) {
  return field(name, 'string', 'input', {
    is_nullable: true,
    max_length: 255,
  }, {
    width: 'full',
    note,
    options: { masked: true },
  });
}

function longText(name, { required = false, note, placeholder } = {}) {
  return field(name, 'text', 'input-multiline', { is_nullable: !required }, {
    required,
    note,
    options: placeholder ? { placeholder } : undefined,
  });
}

function richText(name, { required = false, note } = {}) {
  return field(name, 'text', 'input-rich-text-html', { is_nullable: !required }, { required, note });
}

function choice(name, choices, {
  required = false,
  defaultValue = null,
  width = 'half',
  note,
} = {}) {
  return field(name, 'string', 'select-dropdown', {
    is_nullable: !required,
    default_value: defaultValue,
    max_length: 64,
  }, {
    required,
    width,
    note,
    options: {
      choices: choices.map(item => (
        typeof item === 'string' ? { text: item, value: item } : item
      )),
    },
  });
}

function integer(name, { required = false, defaultValue = null, note } = {}) {
  return field(name, 'integer', 'input', {
    is_nullable: !required,
    default_value: defaultValue,
  }, { required, width: 'half', note });
}

function float(name, { note } = {}) {
  return field(name, 'float', 'input', { is_nullable: true }, { width: 'half', note });
}

function toggle(name, defaultValue = false, note) {
  return field(name, 'boolean', 'boolean', {
    is_nullable: false,
    default_value: defaultValue,
  }, { width: 'half', note });
}

function json(name, note) {
  return field(name, 'json', 'input-code', { is_nullable: true }, {
    options: { language: 'JSON' },
    note,
  });
}

function tags(name, note) {
  return field(name, 'json', 'tags', { is_nullable: true }, {
    options: { iconRight: 'label' },
    note,
  });
}

function relationField(name, note, { required = false, unique = false } = {}) {
  return field(name, 'uuid', 'select-dropdown-m2o', {
    is_nullable: !required,
    is_unique: unique,
  }, {
    special: ['m2o'],
    note,
    required,
  });
}

function imageField(name, note) {
  return field(name, 'uuid', 'file-image', { is_nullable: true }, {
    special: ['file'],
    note,
  });
}

function aliasField(name, interfaceName, fieldMeta = {}) {
  return {
    field: name,
    type: 'alias',
    schema: null,
    meta: meta(interfaceName, fieldMeta),
  };
}

function collection(name, icon, note, fields, options = {}) {
  const archiveField = options.archiveField === undefined ? 'status' : options.archiveField;
  return {
    collection: name,
    meta: {
      collection: name,
      icon,
      note,
      display_template: options.displayTemplate || '{{key}}',
      singleton: options.singleton || false,
      archive_field: archiveField,
      archive_value: archiveField ? (options.archiveValue || 'archived') : null,
      unarchive_value: archiveField ? (options.unarchiveValue || 'draft') : null,
      archive_app_filter: Boolean(archiveField),
      sort_field: fields.some(item => item.field === 'sort') ? 'sort' : null,
    },
    schema: { name },
    fields,
  };
}

function collectionGroup(definition) {
  return {
    collection: definition.collection,
    meta: {
      collection: definition.collection,
      icon: definition.icon,
      note: definition.note,
      translations: studioTranslations(definition.label),
      hidden: false,
      singleton: false,
      group: definition.group || null,
      sort: definition.sort,
      collapse: definition.collapse || 'closed',
    },
    schema: null,
  };
}

const collectionGroups = DIRECTUS_COLLECTION_GROUPS.map(collectionGroup);

const collections = [
  collection('carzo_pages', 'web', 'Сторінки сайту, їх SEO та стан публікації.', [
    idField(), statusField(), keyField(),
    shortText('title', { required: true }),
    shortText('slug', {
      required: true,
      unique: true,
      width: 'half',
      note: 'URL без початкового слеша. Для головної сторінки використовуйте home.',
    }),
    choice('page_type', [
      { text: 'Лендінг', value: 'landing' },
      { text: 'Інформаційна', value: 'content' },
      { text: 'Юридична', value: 'legal' },
    ], { required: true, defaultValue: 'content' }),
    shortText('seo_title', { note: 'Заголовок для пошукових систем та вкладки браузера.' }),
    longText('seo_description', { note: 'Опис сторінки для пошукових систем.' }),
    imageField('seo_image', 'Зображення для соціальних мереж.'),
    toggle('show_header', true, 'Показувати шапку сайту.'),
    toggle('show_footer', true, 'Показувати підвал сайту.'),
    toggle('no_index', false, 'Заборонити індексацію пошуковими системами.'),
    aliasField('blocks', 'list-o2m', {
      special: ['o2m'],
      note: 'Додавайте та перетягуйте блоки у потрібному порядку.',
      options: {
        template: '{{block_type}} — {{title}}',
        enableCreate: true,
        enableSelect: false,
      },
    }),
  ], { displayTemplate: '{{title}} — /{{slug}}' }),
  collection('carzo_page_blocks', 'dashboard_customize', 'Упорядковувані блоки сторінок сайту.', [
    idField(), statusField(), sortField(), keyField(),
    relationField('page', 'Сторінка, до якої належить блок.', { required: true }),
    choice('block_type', [
      { text: 'Головний екран', value: 'hero' },
      { text: 'Форматований текст', value: 'rich_text' },
      { text: 'Зображення + текст', value: 'image_text' },
      { text: 'Сітка переваг', value: 'feature_grid' },
      { text: 'Питання та відповіді', value: 'faq' },
      { text: 'Заклик до дії', value: 'cta' },
    ], { required: true, defaultValue: 'rich_text' }),
    choice('theme', [
      { text: 'Світла', value: 'light' },
      { text: 'Темна', value: 'dark' },
      { text: 'Мʼяка сіра', value: 'soft' },
      { text: 'Мʼятна', value: 'mint' },
    ], { required: true, defaultValue: 'light' }),
    shortText('anchor', { width: 'half', note: 'Необовʼязковий якір без #, наприклад delivery.' }),
    shortText('eyebrow', { note: 'Короткий підзаголовок над основним заголовком.' }),
    shortText('title'),
    longText('subtitle'),
    richText('body', { note: 'Форматований текст блока.' }),
    imageField('image', 'Зображення блока.'),
    shortText('image_alt', { note: 'Опис зображення для доступності та SEO.' }),
    choice('image_position', [
      { text: 'Ліворуч', value: 'left' },
      { text: 'Праворуч', value: 'right' },
    ], { defaultValue: 'right' }),
    shortText('primary_label', { width: 'half' }),
    shortText('primary_url', { width: 'half', note: 'Внутрішній шлях або повний зовнішній URL.' }),
    shortText('secondary_label', { width: 'half' }),
    shortText('secondary_url', { width: 'half' }),
    json('items', 'Для переваг: [{ title, text }]. Для FAQ: [{ question, answer }].'),
  ], { displayTemplate: '{{block_type}} — {{title}}' }),
  collection('carzo_designs', 'palette', 'Дизайни автокейсу.', [
    idField(), statusField(), sortField(), keyField('slug'),
    shortText('version', { required: true, width: 'half' }),
    shortText('label', { required: true }),
    imageField('selector_image', 'Зображення у вікні вибору дизайну.'),
  ], { displayTemplate: '{{label}}' }),
  collection('carzo_sizes', 'straighten', 'Розміри виробу та їх контентні характеристики.', [
    idField(), statusField(), sortField(), keyField('code'),
    shortText('slug', { required: true, unique: true, width: 'half' }),
    shortText('label', { required: true }),
    integer('width_cm', { required: true }), integer('height_cm', { required: true }), integer('depth_cm', { required: true }),
    shortText('content_group', { required: true, width: 'half', note: 'S, M або LXL.' }),
  ], { displayTemplate: '{{label}}' }),
  collection('carzo_brands', 'directions_car', 'Марки автомобілів та їх візуальний контент.', [
    idField(), statusField(), sortField(), keyField('slug'),
    shortText('name', { width: 'half' }), shortText('flag', { width: 'half' }),
    imageField('logo_image', 'Фото логотипа конкретної марки; порожнє значення використовує резервне фото.'),
  ], { displayTemplate: '{{flag}} {{name}}' }),
  collection('carzo_brand_pricing', 'price_change', 'Комерційні доплати за логотип автомобільної марки.', [
    idField(), statusField(),
    relationField('brand', 'Марка автомобіля.', { required: true, unique: true }),
    integer('logo_extra', { required: true, defaultValue: 0, note: 'Доплата у цілих гривнях.' }),
  ], { displayTemplate: '{{brand}} — {{logo_extra}} ₴' }),
  collection('carzo_size_shipping', 'local_shipping', 'Транспортні профілі упаковки за розміром виробу.', [
    idField(), statusField(),
    relationField('size', 'Розмір виробу.', { required: true, unique: true }),
    integer('length_cm', { required: true, note: 'Довжина упакованої одиниці.' }),
    integer('width_cm', { required: true, note: 'Ширина упакованої одиниці.' }),
    integer('height_cm', { required: true, note: 'Висота упакованої одиниці.' }),
    float('weight_kg', { note: 'Вага упакованої одиниці.' }),
  ], { displayTemplate: '{{size}}' }),
  collection('carzo_fixations', 'link', 'Варіанти фіксації та їх доплати.', [
    idField(), statusField(), sortField(), keyField(),
    shortText('label', { required: true }),
    integer('extra', { required: true, defaultValue: 0, note: 'Доплата у цілих гривнях.' }),
  ], { displayTemplate: '{{label}}' }),
  collection('carzo_variants', 'sell', 'Комерційні варіанти за матрицею дизайн × розмір.', [
    idField(), statusField(), keyField(),
    relationField('design', 'Дизайн варіанта.'), relationField('size', 'Розмір варіанта.'),
    integer('price', { required: true, note: 'Поточна ціна у цілих гривнях.' }),
    integer('old_price', { required: true, note: 'Інформаційна зачеркнута ціна.' }),
    toggle('in_stock', true, 'Чи доступний варіант для покупки.'),
    toggle('quantity_discount_eligible', true, 'Чи враховується одиниця у програмі «Разом дешевше».'),
  ], { displayTemplate: '{{key}} — {{price}} ₴' }),
  collection('carzo_gallery_images', 'photo_library', 'Галерея конкретної товарної конфігурації дизайн × розмір. Інші конфігурації ніколи не використовуються як резерв.', [
    idField(), statusField(), sortField(), keyField(),
    relationField('design', 'Дизайн товарної конфігурації.', { required: true }),
    relationField('size', 'Розмір товарної конфігурації.', { required: true }),
    imageField('image', 'Файл Directus має пріоритет над зовнішнім URL.'),
    shortText('external_url', { note: 'Пряме HTTPS-посилання. Використовується лише якщо файл не завантажено.' }),
    shortText('alt', { note: 'Необов’язково. Порожнє значення створюється автоматично з дизайну, розміру та номера фото.' }),
  ], { displayTemplate: '{{design}} · {{size}} · фото {{sort}}' }),
  collection('carzo_content_sets', 'view_carousel', 'Набори контенту модалок наповнення та фіксації.', [
    idField(), statusField(), keyField(),
    shortText('kind', { required: true, width: 'half', note: 'inside або fixation.' }),
    relationField('design', 'Для фіксації: конкретний дизайн; порожнє значення — резерв.'),
    relationField('size', 'Для фіксації: конкретний розмір; порожнє значення — резерв.'),
    shortText('size_group', { width: 'half', note: 'Для наповнення: S, M або LXL.' }),
    shortText('title', { required: true }),
    shortText('content_tab_label', { required: true }),
    shortText('faq_tab_label', { required: true }),
    longText('info_box'),
  ], { displayTemplate: '{{key}}' }),
  collection('carzo_content_sections', 'article', 'Секції всередині контентних модалок.', [
    idField(), statusField(), sortField(), keyField(),
    relationField('content_set', 'Батьківський набір контенту.'),
    imageField('image', 'Зображення секції.'),
    shortText('external_url'), shortText('image_placeholder'),
    shortText('title', { required: true }), longText('text', { required: true }),
  ], { displayTemplate: '{{title}}' }),
  collection('carzo_faq_items', 'quiz', 'Глобальні FAQ для модалок наповнення, фіксації та логотипа.', [
    idField(), statusField(), sortField(), keyField(),
    shortText('faq_group', { required: true, width: 'half', note: 'inside, fixation або logo.' }),
    shortText('question', { required: true }), longText('answer', { required: true }),
  ], { displayTemplate: '{{question}}' }),
  collection('carzo_logo_settings', 'branding_watermark', 'Глобальні тексти, характеристики та резервне фото логотипа.', [
    idField(), statusField(), shortText('title', { required: true }), longText('info_text', { required: true }),
    imageField('fallback_image', 'Резерв для фото логотипа та його розміщення.'),
    json('specs', 'Список характеристик [{ label, value }].'),
  ], { singleton: true, displayTemplate: '{{title}}' }),
  collection('carzo_logo_placements', 'pin_drop', 'Фото розміщення логотипа за матрицею дизайн × розмір.', [
    idField(), statusField(), sortField(), keyField(),
    relationField('design'), relationField('size'), imageField('image'), shortText('external_url'),
  ], { displayTemplate: '{{key}}' }),
  collection('carzo_rich_sections', 'view_agenda', 'Єдиний впорядковуваний текстовий шаблон rich content для всіх дизайнів і розмірів.', [
    idField(), statusField(), sortField(), keyField(),
    shortText('title', { required: true }), shortText('subtitle', { required: true }),
    longText('description', { required: true }),
    shortText('additional_title'), longText('additional_text'),
    json('additional_list', 'Необов’язковий список рядків.'),
  ], { displayTemplate: '{{title}}' }),
  collection('carzo_rich_section_images', 'collections', 'Зображення rich content для конкретного дизайну. Одне зображення використовується для всіх розмірів цього дизайну.', [
    idField(), statusField(), keyField(),
    relationField('design', 'Дизайн, для якого показується фото.', { required: true }),
    relationField('section', 'Блок глобального текстового шаблону.', { required: true }),
    imageField('image', 'Файл Directus має пріоритет над зовнішнім URL.'),
    shortText('external_url', { note: 'Пряме HTTPS-посилання. Використовується лише якщо файл не завантажено.' }),
    shortText('alt', { note: 'Необов’язково. Порожнє значення створюється автоматично із заголовка блока та дизайну.' }),
  ], { displayTemplate: '{{design}} · {{section}}' }),
  collection('carzo_media_settings', 'image', 'Єдиний плейсхолдер для відсутніх або недоступних фото галереї та rich content.', [
    idField(), statusField(),
    imageField('image', 'SVG, PNG, JPEG, WebP або інший підтримуваний Directus формат. Файл має пріоритет.'),
    shortText('external_url', { note: 'Пряме HTTPS-посилання, якщо файл не завантажено.' }),
  ], { singleton: true, displayTemplate: 'Плейсхолдер медіа' }),
  collection('carzo_benefit_modals', 'featured_play_list', 'Глобальні модалки переваг товару.', [
    idField(), statusField(), sortField(), keyField(),
    shortText('card_label', { required: true }), shortText('title', { required: true }),
    longText('subtitle', { required: true }),
    json('content', 'Типізовані блоки модального вікна.'),
  ], { displayTemplate: '{{title}}' }),
  collection('carzo_discount_tiers', 'percent', 'Рівні глобальної програми «Разом дешевше».', [
    idField(), statusField(), sortField(), keyField(),
    integer('min_quantity', { required: true, note: 'Мінімальна кількість одиниць.' }),
    integer('amount', { required: true, note: 'Фіксована сума знижки у гривнях.' }),
  ], { displayTemplate: 'від {{min_quantity}} — {{amount}} ₴' }),
  collection('carzo_notification_settings', 'notifications_active', 'Канали та шаблони сповіщень про нові замовлення.', [
    idField(),
    choice('channel', [
      { text: 'Вимкнено', value: 'off', color: '#A2B5CD' },
      { text: 'Email', value: 'email', color: '#2F80ED' },
      { text: 'Telegram', value: 'telegram', color: '#27AE60' },
      { text: 'Email + Telegram', value: 'both', color: '#9B51E0' },
    ], {
      required: true,
      defaultValue: 'off',
      note: 'Оберіть канал. Помилка доставки не скасовує створене замовлення.',
    }),
    tags('directus_user_ids', 'UUID користувачів Directus. Для них створюється вхідне сповіщення та, за наявності SMTP, email.'),
    tags('telegram_chat_ids', 'Legacy fallback. Telegram recipients are managed in Telegram bot settings.'),
    shortText('subject_template', {
      required: true,
      note: 'Доступні змінні у форматі {{order_number}}, {{customer_name}}, {{total}} тощо.',
    }),
    longText('message_template', {
      required: true,
      note: 'Доступні: order_number, customer_name, customer_phone, contact_method, items_quantity, items_summary, total, delivery_method, delivery_city, delivery_destination, delivery_point, order_url.',
    }),
  ], {
    singleton: true,
    archiveField: null,
    displayTemplate: 'Сповіщення про замовлення',
  }),
  collection('carzo_telegram_bot_settings', 'send', 'Захищені налаштування Telegram-бота для сповіщень про замовлення.', [
    idField(),
    tags('chat_ids', 'ID приватних чатів, груп або каналів Telegram, куди бот надсилатиме замовлення.'),
    secretText('bot_token', {
      note: 'Секретний токен від BotFather. Доступний лише адміністратору та технічному API застосунку.',
    }),
  ], {
    singleton: true,
    archiveField: null,
    displayTemplate: 'Telegram bot',
  }),
  collection('carzo_orders', 'shopping_bag', 'Замовлення зі знімком покупця, доставки та перевіреної вартості.', [
    idField(),
    choice('status', [
      { text: 'Нове', value: 'new', color: '#2ECDA7' },
      { text: 'В обробці', value: 'processing', color: '#F2C94C' },
      { text: 'Відправлено', value: 'shipped', color: '#2F80ED' },
      { text: 'Виконано', value: 'completed', color: '#9B51E0' },
      { text: 'Скасовано', value: 'cancelled', color: '#F87171' },
    ], { required: true, defaultValue: 'new' }),
    shortText('order_number', { required: true, unique: true, width: 'half' }),
    field('created_at', 'timestamp', 'datetime', { is_nullable: false }, { required: true, width: 'half', readonly: true }),
    shortText('customer_name', { required: true }),
    shortText('customer_phone', { required: true, width: 'half' }),
    shortText('customer_email', { width: 'half' }),
    longText('customer_comment'),
    choice('contact_method', [
      { text: 'Зателефонувати', value: 'phone' },
      { text: 'Telegram', value: 'telegram' },
      { text: 'Viber', value: 'viber' },
      { text: 'WhatsApp', value: 'whatsapp' },
    ], {
      required: true,
      defaultValue: 'phone',
      note: 'Бажаний спосіб підтвердження замовлення менеджером.',
    }),
    choice('delivery_method', [
      { text: 'У відділення', value: 'BRANCH' },
      { text: 'У поштомат', value: 'POSTOMAT' },
      { text: 'Курʼєром', value: 'COURIER' },
    ], { required: true, defaultValue: 'BRANCH' }),
    shortText('delivery_city_ref', { required: true }),
    shortText('delivery_city_name', { required: true }),
    shortText('delivery_point_ref'),
    shortText('delivery_point_number', { width: 'half' }),
    shortText('delivery_point_name'),
    shortText('delivery_point_address'),
    choice('delivery_point_type', [
      { text: 'Відділення', value: 'branch' },
      { text: 'Поштомат', value: 'postomat' },
    ]),
    shortText('delivery_street_ref'),
    shortText('delivery_street_name'),
    shortText('delivery_street_type', { width: 'half' }),
    shortText('delivery_house', { width: 'half' }),
    shortText('delivery_apartment', { width: 'half' }),
    integer('items_quantity', { required: true }),
    integer('subtotal', { required: true }),
    integer('quantity_discount', { required: true, defaultValue: 0 }),
    integer('total', { required: true }),
    shortText('discount_tier_key', { width: 'half' }),
    longText('manager_note'),
    aliasField('items', 'list-o2m', {
      special: ['o2m'],
      options: { template: '{{title}} × {{quantity}}', enableCreate: false, enableSelect: false },
    }),
  ], {
    displayTemplate: '{{order_number}} — {{customer_name}} — {{total}} ₴',
    archiveField: 'status',
    archiveValue: 'cancelled',
    unarchiveValue: 'new',
  }),
  collection('carzo_order_items', 'receipt_long', 'Незмінювані знімки позицій замовлення.', [
    idField(), sortField(),
    relationField('order', 'Замовлення, до якого належить позиція.', { required: true }),
    shortText('item_key', { required: true }),
    shortText('title', { required: true }),
    shortText('design_slug', { required: true, width: 'half' }),
    shortText('design_label', { required: true, width: 'half' }),
    shortText('size_code', { required: true, width: 'half' }),
    shortText('size_label', { required: true, width: 'half' }),
    shortText('brand_slug', { required: true, width: 'half' }),
    shortText('brand_name', { required: true, width: 'half' }),
    shortText('fixation_key', { required: true, width: 'half' }),
    shortText('fixation_label', { required: true, width: 'half' }),
    integer('unit_price', { required: true }),
    integer('quantity', { required: true }),
    integer('line_total', { required: true }),
    toggle('quantity_discount_eligible', true),
  ], { displayTemplate: '{{title}} × {{quantity}}', archiveField: null }),
  collection('carzo_site_settings', 'tune', 'Глобальні тексти товарної сторінки.', [
    idField(), statusField(), longText('design_info_text', { required: true }),
    shortText('feature_magnetic_text', { required: true }),
    shortText('feature_material_flag', { required: true, width: 'half' }),
    shortText('feature_material_text', { required: true }),
    shortText('rich_signoff', { required: true }),
    longText('checkout_payment_details', {
      note: 'Показується під способом зв’язку під час оформлення замовлення. Порожнє значення приховує блок на сайті.',
      placeholder: 'Тут треба вставити реквізити',
    }),
  ], { singleton: true, displayTemplate: 'Налаштування Carzo' }),
];

for (const definition of collections) {
  const navigation = DIRECTUS_COLLECTION_NAVIGATION[definition.collection];
  if (!navigation) {
    throw new Error(`Directus navigation is missing for ${definition.collection}`);
  }
  Object.assign(definition.meta, {
    group: navigation.group,
    sort: navigation.sort,
    translations: studioTranslations(navigation.label),
  });
}

for (const collectionName of Object.keys(DIRECTUS_COLLECTION_NAVIGATION)) {
  if (!collections.some(definition => definition.collection === collectionName)) {
    throw new Error(`Directus navigation references an unknown collection: ${collectionName}`);
  }
}

const relations = [
  {
    collection: 'carzo_page_blocks',
    field: 'page',
    relatedCollection: 'carzo_pages',
    schema: { on_delete: 'CASCADE' },
    meta: { one_field: 'blocks', one_deselect_action: 'delete', sort_field: 'sort' },
  },
  { collection: 'carzo_pages', field: 'seo_image', relatedCollection: 'directus_files' },
  { collection: 'carzo_page_blocks', field: 'image', relatedCollection: 'directus_files' },
  { collection: 'carzo_designs', field: 'selector_image', relatedCollection: 'directus_files' },
  { collection: 'carzo_brands', field: 'logo_image', relatedCollection: 'directus_files' },
  { collection: 'carzo_brand_pricing', field: 'brand', relatedCollection: 'carzo_brands' },
  { collection: 'carzo_size_shipping', field: 'size', relatedCollection: 'carzo_sizes' },
  { collection: 'carzo_variants', field: 'design', relatedCollection: 'carzo_designs' },
  { collection: 'carzo_variants', field: 'size', relatedCollection: 'carzo_sizes' },
  { collection: 'carzo_gallery_images', field: 'design', relatedCollection: 'carzo_designs', schema: { on_delete: 'CASCADE' } },
  { collection: 'carzo_gallery_images', field: 'size', relatedCollection: 'carzo_sizes', schema: { on_delete: 'CASCADE' } },
  { collection: 'carzo_gallery_images', field: 'image', relatedCollection: 'directus_files' },
  { collection: 'carzo_content_sets', field: 'design', relatedCollection: 'carzo_designs' },
  { collection: 'carzo_content_sets', field: 'size', relatedCollection: 'carzo_sizes' },
  { collection: 'carzo_content_sections', field: 'content_set', relatedCollection: 'carzo_content_sets' },
  { collection: 'carzo_content_sections', field: 'image', relatedCollection: 'directus_files' },
  { collection: 'carzo_logo_settings', field: 'fallback_image', relatedCollection: 'directus_files' },
  { collection: 'carzo_logo_placements', field: 'design', relatedCollection: 'carzo_designs' },
  { collection: 'carzo_logo_placements', field: 'size', relatedCollection: 'carzo_sizes' },
  { collection: 'carzo_logo_placements', field: 'image', relatedCollection: 'directus_files' },
  { collection: 'carzo_rich_section_images', field: 'design', relatedCollection: 'carzo_designs', schema: { on_delete: 'CASCADE' } },
  { collection: 'carzo_rich_section_images', field: 'section', relatedCollection: 'carzo_rich_sections', schema: { on_delete: 'CASCADE' } },
  { collection: 'carzo_rich_section_images', field: 'image', relatedCollection: 'directus_files' },
  { collection: 'carzo_media_settings', field: 'image', relatedCollection: 'directus_files' },
  {
    collection: 'carzo_order_items',
    field: 'order',
    relatedCollection: 'carzo_orders',
    schema: { on_delete: 'CASCADE' },
    meta: { one_field: 'items', one_deselect_action: 'delete', sort_field: 'sort' },
  },
];

const physicalRelationRepairKeys = new Set([
  'carzo_media_settings.image',
  'carzo_rich_section_images.design',
  'carzo_rich_section_images.section',
  'carzo_rich_section_images.image',
]);

const legacyReadonlyFields = {
  carzo_brands: ['logo_extra'],
  carzo_sizes: [
    'shipping_length_cm', 'shipping_width_cm', 'shipping_height_cm',
    'shipping_weight_kg',
  ],
  carzo_orders: ['customer_email'],
  carzo_rich_sections: ['design', 'image', 'external_url'],
};

async function backupSchema() {
  const snapshot = await request('/schema/snapshot');
  const directory = resolve(root, 'directus/snapshots');
  await mkdir(directory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await writeFile(resolve(directory, `before-setup-${timestamp}.json`), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
}

async function ensureCollection(definition, existingNames) {
  if (!existingNames.has(definition.collection)) {
    const collectionDefinition = {
      ...definition,
      fields: definition.fields.map((item) => {
        const fieldDefinition = { ...item };
        delete fieldDefinition.interface;
        return fieldDefinition;
      }),
    };
    await request('/collections', { method: 'POST', body: JSON.stringify(collectionDefinition) });
    existingNames.add(definition.collection);
    return;
  }

  const existing = await request(`/fields/${definition.collection}`);
  const existingFieldNames = new Set(existing.map(item => item.field));
  for (const item of definition.fields) {
    if (existingFieldNames.has(item.field)) continue;
    const fieldDefinition = { ...item };
    delete fieldDefinition.interface;
    await request(`/fields/${definition.collection}`, {
      method: 'POST',
      body: JSON.stringify(fieldDefinition),
    });
  }

  await request(`/collections/${definition.collection}`, {
    method: 'PATCH',
    body: JSON.stringify({ meta: definition.meta }),
  });
}

async function ensureCollectionGroup(definition, existingByName) {
  const existing = existingByName.get(definition.collection);
  if (!existing) {
    await request('/collections', {
      method: 'POST',
      body: JSON.stringify(definition),
    });
    existingByName.set(definition.collection, definition);
    return;
  }

  if (existing.schema !== null) {
    throw new Error(`${definition.collection} exists as a data collection and cannot become a navigation folder`);
  }

  await request(`/collections/${definition.collection}`, {
    method: 'PATCH',
    body: JSON.stringify({ meta: definition.meta }),
  });
}

async function retireLegacyFields() {
  for (const [collectionName, fieldNames] of Object.entries(legacyReadonlyFields)) {
    const existing = await request(`/fields/${collectionName}`);
    const existingNames = new Set(existing.map(item => item.field));
    for (const fieldName of fieldNames) {
      if (!existingNames.has(fieldName)) continue;
      await request(`/fields/${collectionName}/${fieldName}`, {
        method: 'PATCH',
        body: JSON.stringify({
          meta: {
            hidden: true,
            readonly: true,
            note: collectionName === 'carzo_orders'
              ? 'Legacy field retained for historical orders. New checkouts do not collect email.'
              : 'Legacy field. The storefront reads this value from a dedicated commercial collection.',
          },
        }),
      });
    }
  }
}

async function configureCheckoutFieldMetadata() {
  await request('/fields/carzo_orders/delivery_method', {
    method: 'PATCH',
    body: JSON.stringify({
      schema: { is_nullable: false, default_value: 'BRANCH' },
      meta: {
        required: true,
        options: {
          choices: [
            { text: 'У відділення', value: 'BRANCH' },
            { text: 'У поштомат', value: 'POSTOMAT' },
            { text: 'Курʼєром', value: 'COURIER' },
          ],
        },
      },
    }),
  });
  for (const fieldName of [
    'delivery_point_ref',
    'delivery_point_number',
    'delivery_point_name',
    'delivery_point_address',
    'delivery_point_type',
  ]) {
    await request(`/fields/carzo_orders/${fieldName}`, {
      method: 'PATCH',
      body: JSON.stringify({
        schema: { is_nullable: true },
        meta: { required: false },
      }),
    });
  }
  await request('/fields/carzo_orders/delivery_point_type', {
    method: 'PATCH',
    body: JSON.stringify({
      meta: {
        options: {
          choices: [
            { text: 'Відділення', value: 'branch' },
            { text: 'Поштомат', value: 'postomat' },
          ],
        },
      },
    }),
  });
  await request('/fields/carzo_orders/contact_method', {
    method: 'PATCH',
    body: JSON.stringify({
      meta: {
        translations: studioTranslations('Спосіб зв’язку'),
        note: 'Бажаний спосіб підтвердження замовлення менеджером.',
      },
    }),
  });
  await request('/fields/carzo_site_settings/checkout_payment_details', {
    method: 'PATCH',
    body: JSON.stringify({
      meta: {
        translations: studioTranslations('Реквізити для оплати'),
        note: 'Показується під способом зв’язку під час оформлення замовлення. Порожнє значення приховує блок на сайті.',
        options: { placeholder: 'Тут треба вставити реквізити' },
      },
    }),
  });
  await request('/fields/carzo_notification_settings/message_template', {
    method: 'PATCH',
    body: JSON.stringify({
      meta: {
        note: 'Доступні: order_number, customer_name, customer_phone, contact_method, items_quantity, items_summary, total, delivery_method, delivery_city, delivery_destination, delivery_point, order_url.',
      },
    }),
  });
}

async function backfillOrderDeliveryMethods() {
  const orders = await request(
    '/items/carzo_orders?limit=-1&fields=id,delivery_method,delivery_point_type',
  );
  let updated = 0;
  for (const order of orders) {
    // Only repair historical locker orders that received the new BRANCH default.
    // Current BRANCH/POSTOMAT values and every COURIER order are already canonical.
    if (order.delivery_point_type !== 'postomat' || order.delivery_method !== 'BRANCH') continue;
    await request(`/items/carzo_orders/${order.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ delivery_method: 'POSTOMAT' }),
    });
    updated += 1;
  }
  return { checked: orders.length, updated };
}

async function configureProductMediaFieldMetadata() {
  for (const fieldName of ['design', 'size']) {
    await request(`/fields/carzo_gallery_images/${fieldName}`, {
      method: 'PATCH',
      body: JSON.stringify({ meta: { required: true } }),
    });
  }
  await request('/fields/carzo_gallery_images/alt', {
    method: 'PATCH',
    body: JSON.stringify({
      schema: { is_nullable: true },
      meta: {
        required: false,
        note: 'Необов’язково. Порожнє значення створюється автоматично з дизайну, розміру та номера фото.',
      },
    }),
  });
}

async function assertRelationReferences(definition) {
  const source = await request(
    `/items/${definition.collection}?limit=-1&fields=id,${definition.field}`,
  );
  const relatedPath = definition.relatedCollection === 'directus_files'
    ? '/files?limit=-1&fields=id'
    : `/items/${definition.relatedCollection}?limit=-1&fields=id`;
  const related = await request(relatedPath);
  const sourceItems = Array.isArray(source) ? source : source ? [source] : [];
  const relatedItems = Array.isArray(related) ? related : related ? [related] : [];
  const relatedIds = new Set(relatedItems.map(item => String(item.id)));
  const orphanedItemIds = sourceItems
    .filter(item => {
      const value = relatedId(item[definition.field]);
      return value !== null && !relatedIds.has(String(value));
    })
    .map(item => item.id);

  if (orphanedItemIds.length > 0) {
    throw new Error(
      `Cannot restore ${definition.collection}.${definition.field} foreign key: `
      + `orphaned values exist in items ${orphanedItemIds.join(', ')}`,
    );
  }
}

async function ensureRelations() {
  const existing = await request('/relations');
  for (const definition of relations) {
    const found = existing.find(relation => (
      relation.collection === definition.collection && relation.field === definition.field
    ));
    const schema = definition.schema || { on_delete: 'SET NULL' };
    const meta = definition.meta || { one_deselect_action: 'nullify' };
    const payload = {
      collection: definition.collection,
      field: definition.field,
      related_collection: definition.relatedCollection,
      schema,
      meta,
    };

    if (!found) {
      await request('/relations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      continue;
    }

    const key = `${definition.collection}.${definition.field}`;
    const schemaMatches = found.schema
      && found.schema.foreign_key_table === definition.relatedCollection
      && found.schema.foreign_key_column === 'id'
      && found.schema.on_delete === schema.on_delete;
    const metaMatches = Object.entries(meta).every(
      ([name, value]) => found.meta?.[name] === value,
    );

    if (schemaMatches && metaMatches) continue;

    // Only these four relations had physical foreign keys in the checked-in
    // baseline. Leave older metadata-only relations unchanged so this setup
    // does not broaden the checkout migration into unrelated database DDL.
    if (!found.schema && !physicalRelationRepairKeys.has(key)) continue;

    if (!found.schema) {
      await assertRelationReferences(definition);
    }

    await request(`/relations/${definition.collection}/${definition.field}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  const refreshed = await request('/relations');
  for (const key of physicalRelationRepairKeys) {
    const [collectionName, fieldName] = key.split('.');
    const definition = relations.find(item => (
      item.collection === collectionName && item.field === fieldName
    ));
    const relation = refreshed.find(item => (
      item.collection === collectionName && item.field === fieldName
    ));
    const expectedOnDelete = definition?.schema?.on_delete || 'SET NULL';
    if (
      !definition
      || !relation?.schema
      || relation.schema.foreign_key_table !== definition.relatedCollection
      || relation.schema.foreign_key_column !== 'id'
      || relation.schema.on_delete !== expectedOnDelete
    ) {
      throw new Error(`Directus did not restore the expected foreign key for ${key}`);
    }
  }
}

async function configurePagePreview() {
  const secret = process.env.DIRECTUS_PREVIEW_SECRET?.trim();
  if (!secret) return false;
  const siteUrl = (process.env.SITE_URL || 'https://carzo-eight.vercel.app').replace(/\/$/, '');
  const previewUrl = `${siteUrl}/api/draft?secret=${encodeURIComponent(secret)}&id={{id}}`;
  await request('/collections/carzo_pages', {
    method: 'PATCH',
    body: JSON.stringify({ meta: { preview_url: previewUrl } }),
  });
  return true;
}

async function ensureOrderNotificationFlow() {
  const existing = await findSystemOne('flows', 'name', ORDER_NOTIFICATION_FLOW_NAME);
  if (existing) {
    return { id: existing.id, name: existing.name, created: false };
  }

  const currentUser = await request('/users/me?fields=id');
  const flowId = randomUUID();
  const operationId = randomUUID();
  const flow = await request('/flows', {
    method: 'POST',
    body: JSON.stringify({
      id: flowId,
      name: ORDER_NOTIFICATION_FLOW_NAME,
      icon: 'notifications_active',
      color: '#2ECDA7',
      description: 'Неблокуюче сповіщення менеджерів після створення нового замовлення Carzo.',
      status: 'active',
      trigger: 'event',
      accountability: '$full',
      options: {
        type: 'action',
        scope: ['items.create'],
        collections: ['carzo_orders'],
      },
    }),
  });

  try {
    const operation = await request('/operations', {
      method: 'POST',
      body: JSON.stringify({
        id: operationId,
        flow: flow.id,
        name: 'Сповістити про нове замовлення',
        key: ORDER_NOTIFICATION_OPERATION_KEY,
        type: 'notification',
        position_x: 19,
        position_y: 1,
        options: {
          recipient: [currentUser.id],
          permissions: '$full',
          subject: 'Нове замовлення {{$trigger.payload.order_number}}',
          message: [
            '**Нове замовлення {{$trigger.payload.order_number}}**',
            '',
            'Покупець: {{$trigger.payload.customer_name}}',
            'Телефон: {{$trigger.payload.customer_phone}}',
            'Кількість товарів: {{$trigger.payload.items_quantity}}',
            'Сума: {{$trigger.payload.total}} ₴',
            'Доставка: {{$trigger.payload.delivery_city_name}}, {{$trigger.payload.delivery_point_name}}',
          ].join('\n'),
          collection: 'carzo_orders',
          item: '{{$trigger.key}}',
        },
      }),
    });

    await request(`/flows/${flow.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ operation: operation.id }),
    });
  } catch (error) {
    try {
      await request(`/flows/${flow.id}`, { method: 'DELETE' });
    } catch {
      // Preserve the original setup error; a partial flow is safe to inspect manually.
    }
    throw error;
  }

  return { id: flow.id, name: flow.name, created: true };
}

async function disableLegacyOrderNotificationFlow() {
  const existing = await findSystemOne('flows', 'name', ORDER_NOTIFICATION_FLOW_NAME);
  if (!existing) return { found: false, disabled: false };
  if (existing.status !== 'inactive') {
    await request(`/flows/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'inactive',
        description: 'Замінено керованими каналами у carzo_notification_settings.',
      }),
    });
  }
  return { id: existing.id, found: true, disabled: true };
}

async function findOne(collectionName, fieldName, value) {
  const query = new URLSearchParams({
    limit: '1',
    [`filter[${fieldName}][_eq]`]: String(value),
  });
  const items = await request(`/items/${collectionName}?${query}`);
  return items[0] || null;
}

async function findSystemOne(endpoint, fieldName, value) {
  const query = new URLSearchParams({
    limit: '1',
    [`filter[${fieldName}][_eq]`]: String(value),
  });
  const items = await request(`/${endpoint}?${query}`);
  return items[0] || null;
}

async function upsert(collectionName, fieldName, value, data) {
  const existing = await findOne(collectionName, fieldName, value);
  if (existing) {
    return request(`/items/${collectionName}/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
  return request(`/items/${collectionName}`, {
    method: 'POST',
    body: JSON.stringify({ id: randomUUID(), ...data }),
  });
}

async function upsertSingleton(collectionName, data) {
  return request(`/items/${collectionName}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

async function ensureNotificationSettings() {
  const existing = await request('/items/carzo_notification_settings?fields=*');
  const currentUser = await request('/users/me?fields=id');
  const defaults = {
    channel: 'off',
    directus_user_ids: [currentUser.id],
    telegram_chat_ids: [],
    subject_template: 'Нове замовлення {{order_number}}',
    message_template: [
      'Покупець: {{customer_name}}',
      'Телефон: {{customer_phone}}',
      'Спосіб зв’язку: {{contact_method}}',
      'Товари:',
      '{{items_summary}}',
      'Кількість: {{items_quantity}}',
      'Сума: {{total}} ₴',
      'Доставка: {{delivery_method}}',
      'Адреса: {{delivery_city}}, {{delivery_destination}}',
      'Замовлення: {{order_url}}',
    ].join('\n'),
  };
  const missing = {};
  for (const [key, value] of Object.entries(defaults)) {
    const current = existing?.[key];
    const needsDefault = current === null
      || current === undefined
      || current === ''
      || (key === 'directus_user_ids' && Array.isArray(current) && current.length === 0);
    if (needsDefault) missing[key] = value;
  }
  if (
    typeof existing?.message_template === 'string'
    && !existing.message_template.includes('{{contact_method}}')
  ) {
    missing.message_template = `${existing.message_template.trim()}\nСпосіб зв’язку: {{contact_method}}`;
  }
  if (Object.keys(missing).length > 0) {
    await upsertSingleton('carzo_notification_settings', missing);
  }
  return { initialized: Object.keys(missing).length > 0 };
}

async function ensureTelegramBotSettings() {
  const [settings, legacySettings] = await Promise.all([
    request('/items/carzo_telegram_bot_settings?fields=*'),
    request('/items/carzo_notification_settings?fields=*'),
  ]);
  const defaults = {
    chat_ids: Array.isArray(legacySettings?.telegram_chat_ids)
      ? legacySettings.telegram_chat_ids
      : [],
    bot_token: legacySettings?.telegram_bot_token
      || process.env.TELEGRAM_BOT_TOKEN?.trim()
      || null,
  };
  const missing = {};
  for (const [key, value] of Object.entries(defaults)) {
    const current = settings?.[key];
    const needsDefault = current === null
      || current === undefined
      || current === ''
      || (key === 'chat_ids' && Array.isArray(current) && current.length === 0);
    if (needsDefault) missing[key] = value;
  }
  if (Object.keys(missing).length > 0) {
    await upsertSingleton('carzo_telegram_bot_settings', missing);
  }
  return { initialized: Object.keys(missing).length > 0 };
}

async function retireLegacyTelegramSettings() {
  const existing = await request('/fields/carzo_notification_settings');
  const existingByName = new Map(existing.map(item => [item.field, item]));
  if (existingByName.has('telegram_chat_ids')) {
    await request('/fields/carzo_notification_settings/telegram_chat_ids', {
      method: 'PATCH',
      body: JSON.stringify({
        meta: {
          hidden: true,
          readonly: true,
          note: 'Legacy fallback. Manage recipients in Telegram bot settings.',
        },
      }),
    });
  }
  if (existingByName.has('telegram_bot_token')) {
    await request('/fields/carzo_notification_settings/telegram_bot_token', {
      method: 'DELETE',
    });
  }
}

async function ensureFolder() {
  const existing = await findSystemOne('folders', 'name', 'Carzo');
  if (existing) return existing;
  return request('/folders', { method: 'POST', body: JSON.stringify({ name: 'Carzo' }) });
}

function mimeType(path) {
  const extension = extname(path).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.svg') return 'image/svg+xml';
  return 'image/jpeg';
}

function relatedId(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && (typeof value.id === 'string' || typeof value.id === 'number')) {
    return String(value.id);
  }
  return null;
}

async function ensureFile(relativePath, folderId) {
  const title = `Carzo: ${relativePath.replaceAll('\\', '/')}`;
  const existing = await findSystemOne('files', 'title', title);
  if (existing) return existing.id;

  const absolutePath = resolve(root, relativePath);
  const bytes = await readFile(absolutePath);
  const form = new FormData();
  form.append('folder', folderId);
  form.append('title', title);
  form.append('file', new Blob([bytes], { type: mimeType(relativePath) }), basename(relativePath));
  const uploaded = await request('/files', { method: 'POST', body: form });
  return uploaded.id;
}

async function seedItems() {
  const folder = await ensureFolder();
  const fallbackFileId = await ensureFile(seed.logoSettings.fallbackImageUpload, folder.id);
  const mediaPlaceholderFileId = await ensureFile('public/media/landscape-placeholder.svg', folder.id);

  for (const page of pageSeed.pages) {
    let savedPage = await findOne('carzo_pages', 'key', page.key);
    if (!savedPage) {
      savedPage = await upsert('carzo_pages', 'key', page.key, {
        status: page.status,
        key: page.key,
        title: page.title,
        slug: page.slug,
        page_type: page.pageType,
        seo_title: page.seoTitle,
        seo_description: page.seoDescription,
        seo_image: null,
        show_header: page.showHeader,
        show_footer: page.showFooter,
        no_index: page.noIndex,
      });
    }

    for (const block of page.blocks) {
      const existingBlock = await findOne('carzo_page_blocks', 'key', block.key);
      if (existingBlock) continue;
      await upsert('carzo_page_blocks', 'key', block.key, {
        status: block.status,
        sort: block.sort,
        key: block.key,
        page: savedPage.id,
        block_type: block.blockType,
        theme: block.theme,
        anchor: block.anchor,
        eyebrow: block.eyebrow,
        title: block.title,
        subtitle: block.subtitle,
        body: block.body,
        image: block.imageUpload ? await ensureFile(block.imageUpload, folder.id) : null,
        image_alt: block.imageAlt,
        image_position: block.imagePosition,
        primary_label: block.primaryLabel,
        primary_url: block.primaryUrl,
        secondary_label: block.secondaryLabel,
        secondary_url: block.secondaryUrl,
        items: block.items,
      });
    }
  }

  const designIds = {};
  for (const item of seed.designs) {
    const saved = await upsert('carzo_designs', 'slug', item.slug, {
      status: 'published', sort: item.sort, slug: item.slug, version: item.version, label: item.label,
      selector_image: fallbackFileId,
    });
    designIds[item.slug] = saved.id;
  }

  const sizeIds = {};
  for (const item of seed.sizes) {
    const saved = await upsert('carzo_sizes', 'code', item.code, {
      status: 'published', sort: item.sort, code: item.code, slug: item.slug, label: item.label,
      width_cm: item.widthCm, height_cm: item.heightCm, depth_cm: item.depthCm,
      content_group: item.contentGroup,
    });
    sizeIds[item.code] = saved.id;
  }

  for (const item of seed.sizes) {
    if (!item.shippingProfile) continue;
    await upsert('carzo_size_shipping', 'size', sizeIds[item.code], {
      status: 'published', size: sizeIds[item.code],
      length_cm: item.shippingProfile.lengthCm,
      width_cm: item.shippingProfile.widthCm,
      height_cm: item.shippingProfile.heightCm,
      weight_kg: item.shippingProfile.weightKg,
    });
  }

  const brandIds = {};
  for (const item of seed.brands) {
    const saved = await upsert('carzo_brands', 'slug', item.slug, {
      status: 'published', sort: item.sort, slug: item.slug, name: item.name, flag: item.flag,
      logo_image: null,
    });
    brandIds[item.slug] = saved.id;
  }

  for (const item of seed.brands) {
    await upsert('carzo_brand_pricing', 'brand', brandIds[item.slug], {
      status: 'published', brand: brandIds[item.slug], logo_extra: item.logoExtra,
    });
  }

  for (const item of seed.fixations) {
    await upsert('carzo_fixations', 'key', item.key, {
      status: 'published', sort: item.sort, key: item.key, label: item.label, extra: item.extra,
    });
  }

  for (const item of seed.variants) {
    await upsert('carzo_variants', 'key', item.key, {
      status: 'published', key: item.key, design: designIds[item.design], size: sizeIds[item.size],
      price: item.price, old_price: item.oldPrice, in_stock: item.inStock,
      quantity_discount_eligible: item.quantityDiscountEligible,
    });
  }

  for (const item of seed.galleryImages) {
    const existing = await findOne('carzo_gallery_images', 'key', item.key);
    if (!existing) continue;
    await request(`/items/carzo_gallery_images/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'archived' }),
    });
  }

  const contentSetIds = {};
  for (const item of seed.contentSets) {
    const saved = await upsert('carzo_content_sets', 'key', item.key, {
      status: 'published', key: item.key, kind: item.kind,
      design: item.design ? designIds[item.design] : null,
      size: item.size ? sizeIds[item.size] : null,
      size_group: item.sizeGroup,
      title: item.title, content_tab_label: item.contentTabLabel,
      faq_tab_label: item.faqTabLabel, info_box: item.infoBox,
    });
    contentSetIds[item.key] = saved.id;
  }

  for (const item of seed.contentSections) {
    await upsert('carzo_content_sections', 'key', item.key, {
      status: 'published', sort: item.sort, key: item.key,
      content_set: contentSetIds[item.contentSet], image: null, external_url: null,
      image_placeholder: item.imagePlaceholder, title: item.title, text: item.text,
    });
  }

  for (const item of seed.faqItems) {
    await upsert('carzo_faq_items', 'key', item.key, {
      status: 'published', sort: item.sort, key: item.key, faq_group: item.group,
      question: item.question, answer: item.answer,
    });
  }

  await upsertSingleton('carzo_logo_settings', {
    status: 'published', title: seed.logoSettings.title, info_text: seed.logoSettings.infoText,
    fallback_image: fallbackFileId, specs: seed.logoSettings.specs,
  });

  for (const item of seed.logoPlacements) {
    await upsert('carzo_logo_placements', 'key', item.key, {
      status: 'published', sort: item.sort, key: item.key,
      design: item.design ? designIds[item.design] : null,
      size: item.size ? sizeIds[item.size] : null,
      image: item.imageUpload ? await ensureFile(item.imageUpload, folder.id) : null,
      external_url: item.externalUrl || null,
    });
  }

  for (const item of seed.richSections) {
    const existing = await findOne('carzo_rich_sections', 'key', item.key);
    const defaultImageId = await ensureFile(item.imageUpload, folder.id);
    const template = existing || await upsert('carzo_rich_sections', 'key', item.key, {
      status: 'published', sort: item.sort, key: item.key,
      title: item.title, subtitle: item.subtitle, description: item.description,
      additional_title: item.additionalTitle, additional_text: item.additionalText,
      additional_list: item.additionalList,
    });
    const migratedImageId = relatedId(existing?.image) || defaultImageId;
    for (const designSlug of ['2-0', '3-0']) {
      const mediaKey = `${designSlug}:${item.key}`;
      const existingMedia = await findOne('carzo_rich_section_images', 'key', mediaKey);
      if (existingMedia) continue;
      await upsert('carzo_rich_section_images', 'key', mediaKey, {
        status: 'published', key: mediaKey, design: designIds[designSlug], section: template.id,
        image: migratedImageId, external_url: null, alt: null,
      });
    }
  }

  for (const [index, item] of seed.benefitModals.entries()) {
    await upsert('carzo_benefit_modals', 'key', item.key, {
      status: 'published', sort: index + 1, key: item.key, card_label: item.cardLabel,
      title: item.title, subtitle: item.subtitle, content: item.content,
    });
  }

  for (const item of seed.discountTiers) {
    await upsert('carzo_discount_tiers', 'key', item.key, {
      status: 'published', sort: item.sort, key: item.key,
      min_quantity: item.minQuantity, amount: item.amount,
    });
  }

  await upsertSingleton('carzo_site_settings', {
    status: 'published', design_info_text: seed.siteSettings.designInfoText,
    feature_magnetic_text: seed.siteSettings.featureMagneticText,
    feature_material_flag: seed.siteSettings.featureMaterialFlag,
    feature_material_text: seed.siteSettings.featureMaterialText,
    rich_signoff: seed.siteSettings.richSignoff,
  });

  const mediaSettings = await request('/items/carzo_media_settings?fields=*');
  if (!relatedId(mediaSettings?.image) && !mediaSettings?.external_url) {
    await upsertSingleton('carzo_media_settings', {
      status: 'published', image: mediaPlaceholderFileId, external_url: null,
    });
  }

  return folder.id;
}

async function ensurePolicy(definition) {
  const existing = await findSystemOne('policies', 'name', definition.name);
  const data = {
    name: definition.name,
    icon: definition.icon,
    description: definition.description,
    app_access: definition.appAccess,
    admin_access: false,
  };
  if (existing) {
    return request(`/policies/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
  return request('/policies', { method: 'POST', body: JSON.stringify(data) });
}

async function ensureRole(definition) {
  const existing = await findSystemOne('roles', 'name', definition.name);
  const data = {
    name: definition.name,
    icon: definition.icon,
    description: definition.description,
  };
  if (existing) {
    return request(`/roles/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
  return request('/roles', { method: 'POST', body: JSON.stringify(data) });
}

async function reconcileRolePolicies(roleId, desiredPolicyIds) {
  const query = new URLSearchParams({
    limit: '-1',
    fields: 'id,policy',
    'filter[role][_eq]': roleId,
  });
  const existing = await request(`/access?${query}`);
  const desired = new Set(desiredPolicyIds);
  const existingByPolicy = new Map(existing.map(item => [item.policy, item]));

  for (const item of existing) {
    if (!desired.has(item.policy)) {
      await request(`/access/${item.id}`, { method: 'DELETE' });
    }
  }
  for (const policyId of desiredPolicyIds) {
    if (existingByPolicy.has(policyId)) continue;
    await request('/access', {
      method: 'POST',
      body: JSON.stringify({ role: roleId, policy: policyId }),
    });
  }
}

async function ensurePermission(policyId, grant) {
  const query = new URLSearchParams({
    limit: '1',
    'filter[policy][_eq]': policyId,
    'filter[collection][_eq]': grant.collection,
    'filter[action][_eq]': grant.action,
  });
  const existing = await request(`/permissions?${query}`);
  const data = {
    policy: policyId,
    collection: grant.collection,
    action: grant.action,
    permissions: grant.permissions,
    validation: grant.validation,
    presets: grant.presets,
    fields: grant.fields,
  };
  if (existing[0]) {
    return request(`/permissions/${existing[0].id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  return request('/permissions', { method: 'POST', body: JSON.stringify(data) });
}

function permissionKey(permission) {
  return `${permission.collection}:${permission.action}`;
}

async function reconcileManagedPermissions(policyId, desiredGrants, managedCollections) {
  const query = new URLSearchParams({
    limit: '-1',
    fields: 'id,collection,action',
    'filter[policy][_eq]': policyId,
  });
  const existing = await request(`/permissions?${query}`);
  const desiredKeys = new Set(desiredGrants.map(permissionKey));
  for (const permission of existing) {
    if (!managedCollections.has(permission.collection)) continue;
    if (desiredKeys.has(permissionKey(permission))) continue;
    await request(`/permissions/${permission.id}`, { method: 'DELETE' });
  }
}

async function configureAccess() {
  const policies = await request('/policies?limit=-1&fields=id,name,admin_access,app_access');
  const publicPolicy = policies.find(policy => policy.name === '$t:public_label');
  if (!publicPolicy) throw new Error('Public policy was not found');

  const policyIds = { public: publicPolicy.id };
  for (const [key, definition] of Object.entries(ACCESS_POLICY_DEFINITIONS)) {
    const policy = await ensurePolicy(definition);
    policyIds[key] = policy.id;
  }

  const collectionNames = collections.map(item => item.collection);
  const grants = buildAccessGrants({ collectionNames });
  const grantsByPolicy = new Map();
  for (const grant of grants) {
    if (!grantsByPolicy.has(grant.policyKey)) grantsByPolicy.set(grant.policyKey, []);
    grantsByPolicy.get(grant.policyKey).push(grant);
    await ensurePermission(policyIds[grant.policyKey], grant);
  }

  const managedCollections = managedPermissionCollections(collectionNames);
  for (const [policyKey, policyId] of Object.entries(policyIds)) {
    await reconcileManagedPermissions(
      policyId,
      grantsByPolicy.get(policyKey) || [],
      managedCollections,
    );
  }

  const roles = [];
  for (const definition of ACCESS_ROLE_DEFINITIONS) {
    const policyIdsForRole = definition.policyKeys.map(key => policyIds[key]);
    const role = await ensureRole(definition);
    await reconcileRolePolicies(role.id, policyIdsForRole);
    roles.push(role);
  }

  return {
    policies: Object.values(ACCESS_POLICY_DEFINITIONS).map(item => item.name),
    roles: roles.map(item => item.name),
  };
}

await backupSchema();
const existingCollectionList = await request('/collections?limit=-1');
const existingCollectionByName = new Map(
  existingCollectionList.map(item => [item.collection, item]),
);
for (const definition of collectionGroups) {
  await ensureCollectionGroup(definition, existingCollectionByName);
}
const existingCollections = new Set(existingCollectionByName.keys());
for (const definition of collections) {
  await ensureCollection(definition, existingCollections);
}
await retireLegacyFields();
await configureCheckoutFieldMetadata();
const orderDeliveryBackfill = await backfillOrderDeliveryMethods();
await configureProductMediaFieldMetadata();
await ensureRelations();
const previewConfigured = await configurePagePreview();
await seedItems();
const notificationSettings = await ensureNotificationSettings();
const telegramBotSettings = await ensureTelegramBotSettings();
await retireLegacyTelegramSettings();
const access = await configureAccess();
const legacyOrderNotificationFlow = await disableLegacyOrderNotificationFlow();

const snapshot = await request('/schema/snapshot');
const pagesSnapshot = snapshot.collections?.find(item => item.collection === 'carzo_pages');
if (pagesSnapshot?.meta?.preview_url) {
  pagesSnapshot.meta.preview_url = pagesSnapshot.meta.preview_url.replace(
    /secret=[^&]+/,
    'secret=DIRECTUS_PREVIEW_SECRET',
  );
}
await writeFile(resolve(root, 'directus/schema.json'), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  directus: baseUrl,
  collectionGroups: collectionGroups.map(item => item.collection),
  collections: collections.map(item => item.collection),
  seeded: {
    designs: seed.designs.length,
    sizes: seed.sizes.length,
    variants: seed.variants.length,
    richSections: seed.richSections.length,
    benefitModals: seed.benefitModals.length,
    discountTiers: seed.discountTiers.length,
    pages: pageSeed.pages.length,
    pageBlocks: pageSeed.pages.reduce((total, page) => total + page.blocks.length, 0),
  },
  access,
  notificationSettings,
  telegramBotSettings,
  orderDeliveryBackfill,
  legacyOrderNotificationFlow,
  previewConfigured,
}, null, 2));
