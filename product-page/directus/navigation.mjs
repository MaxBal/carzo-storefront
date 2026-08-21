const STUDIO_LANGUAGES = ['en-US', 'uk-UA', 'ru-RU'];

export function studioTranslations(label) {
  return STUDIO_LANGUAGES.map(language => ({ language, translation: label }));
}

export const DIRECTUS_COLLECTION_GROUPS = Object.freeze([
  {
    collection: 'carzo_group_site_pages',
    label: 'Сторінки сайту',
    icon: 'web',
    note: 'Звичайні CMS-сторінки та їх упорядковувані блоки.',
    sort: 1,
  },
  {
    collection: 'carzo_group_product_page',
    label: 'Товарна сторінка',
    icon: 'storefront',
    note: 'Єдина точка входу для керування каталогом, контентом, цінами та налаштуваннями товарної сторінки.',
    sort: 2,
    collapse: 'locked',
  },
  {
    collection: 'carzo_group_product_catalog',
    label: 'Каталог товарів',
    icon: 'inventory_2',
    note: 'Довідники дизайнів, розмірів, автомобільних марок і кріплень.',
    group: 'carzo_group_product_page',
    sort: 1,
  },
  {
    collection: 'carzo_group_product_content',
    label: 'Контент картки товару',
    icon: 'dashboard_customize',
    note: 'Зображення, тексти, модальні вікна та нижній контент картки товару.',
    group: 'carzo_group_product_page',
    sort: 2,
  },
  {
    collection: 'carzo_group_commerce',
    label: 'Ціни та доставка',
    icon: 'payments',
    note: 'Ціни, доплати, знижки та параметри доставки.',
    group: 'carzo_group_product_page',
    sort: 3,
  },
  {
    collection: 'carzo_group_orders',
    label: 'Замовлення',
    icon: 'shopping_bag',
    note: 'Замовлення покупців та їх товарні позиції.',
    sort: 3,
  },
  {
    collection: 'carzo_group_notifications',
    label: 'Сповіщення',
    icon: 'notifications_active',
    note: 'Канали сповіщень і захищені налаштування Telegram-бота.',
    sort: 4,
  },
]);

export const DIRECTUS_COLLECTION_NAVIGATION = Object.freeze({
  carzo_pages: { group: 'carzo_group_site_pages', label: 'Сторінки', sort: 1 },
  carzo_page_blocks: { group: 'carzo_group_site_pages', label: 'Блоки сторінок', sort: 2 },
  carzo_site_settings: { group: 'carzo_group_product_page', label: 'Налаштування товарної сторінки', sort: 4 },

  carzo_designs: { group: 'carzo_group_product_catalog', label: 'Дизайни', sort: 1 },
  carzo_sizes: { group: 'carzo_group_product_catalog', label: 'Розміри', sort: 2 },
  carzo_brands: { group: 'carzo_group_product_catalog', label: 'Марки автомобілів', sort: 3 },
  carzo_fixations: { group: 'carzo_group_product_catalog', label: 'Кріплення', sort: 4 },

  carzo_rich_sections: { group: 'carzo_group_product_content', label: 'Шаблон rich content', sort: 1 },
  carzo_rich_section_images: { group: 'carzo_group_product_content', label: 'Фото rich content за дизайнами', sort: 2 },
  carzo_gallery_images: { group: 'carzo_group_product_content', label: 'Галереї за дизайном і розміром', sort: 3 },
  carzo_media_settings: { group: 'carzo_group_product_content', label: 'Плейсхолдер медіа', sort: 4 },
  carzo_content_sets: { group: 'carzo_group_product_content', label: 'Набори контенту', sort: 5 },
  carzo_content_sections: { group: 'carzo_group_product_content', label: 'Секції контенту', sort: 6 },
  carzo_faq_items: { group: 'carzo_group_product_content', label: 'Питання та відповіді', sort: 7 },
  carzo_benefit_modals: { group: 'carzo_group_product_content', label: 'Модальні вікна переваг', sort: 8 },
  carzo_logo_settings: { group: 'carzo_group_product_content', label: 'Налаштування логотипа', sort: 9 },
  carzo_logo_placements: { group: 'carzo_group_product_content', label: 'Розміщення логотипа', sort: 10 },
  carzo_review_settings: { group: 'carzo_group_product_content', label: 'Налаштування відгуків', sort: 11 },
  carzo_review_items: { group: 'carzo_group_product_content', label: 'Відгуки клієнтів', sort: 12 },
  carzo_review_screenshots: { group: 'carzo_group_product_content', label: 'Скріншоти відгуків', sort: 13 },

  carzo_variants: { group: 'carzo_group_commerce', label: 'Варіанти товару', sort: 1 },
  carzo_brand_pricing: { group: 'carzo_group_commerce', label: 'Доплати за марку', sort: 2 },
  carzo_discount_tiers: { group: 'carzo_group_commerce', label: 'Знижки «Разом дешевше»', sort: 3 },
  carzo_size_shipping: { group: 'carzo_group_commerce', label: 'Доставка за розміром', sort: 4 },

  carzo_orders: { group: 'carzo_group_orders', label: 'Замовлення', sort: 1 },
  carzo_order_items: { group: 'carzo_group_orders', label: 'Товари замовлень', sort: 2 },

  carzo_notification_settings: { group: 'carzo_group_notifications', label: 'Налаштування сповіщень', sort: 1 },
  carzo_telegram_bot_settings: { group: 'carzo_group_notifications', label: 'Налаштування Telegram-бота', sort: 2 },
});

export const DIRECTUS_COLLECTION_GROUP_NAMES = new Set(
  DIRECTUS_COLLECTION_GROUPS.map(group => group.collection),
);
