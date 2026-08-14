export const ACCESS_POLICY_DEFINITIONS = {
  api: {
    name: 'Carzo API Reader',
    icon: 'api',
    description: 'Server-side storefront access: published catalog reads and order creation. This policy does not grant access to Directus Studio.',
    appAccess: false,
  },
  base: {
    name: 'Carzo Base Access',
    icon: 'visibility',
    description: 'Вхід у Directus і перегляд усіх даних Carzo без права редагування.',
    appAccess: true,
  },
  content: {
    name: 'Carzo Content Editor',
    icon: 'edit_note',
    description: 'Створення та редагування текстів, медіа й візуального контенту Carzo без доступу до цін.',
    appAccess: false,
  },
  commerce: {
    name: 'Carzo Commercial Manager',
    icon: 'payments',
    description: 'Керування цінами, доплатами, наявністю, доставочними параметрами та правилами знижок Carzo.',
    appAccess: false,
  },
};

export const ACCESS_ROLE_DEFINITIONS = [
  {
    name: 'Carzo API Reader',
    icon: 'api',
    description: 'Technical role for the storefront service user. Do not assign this role to staff.',
    policyKeys: ['api'],
  },
  {
    name: 'Carzo Viewer',
    icon: 'visibility',
    description: 'Перегляд контенту й комерційних даних Carzo без редагування.',
    policyKeys: ['base'],
  },
  {
    name: 'Carzo Content Editor',
    icon: 'edit_note',
    description: 'Редактор текстів, зображень і візуального контенту Carzo.',
    policyKeys: ['base', 'content'],
  },
  {
    name: 'Carzo Commercial Manager',
    icon: 'payments',
    description: 'Менеджер цін, доплат, наявності та програми «Разом дешевше».',
    policyKeys: ['base', 'commerce'],
  },
  {
    name: 'Carzo Store Manager',
    icon: 'storefront',
    description: 'Повне керування контентом і комерційними даними Carzo без системного Admin Access.',
    policyKeys: ['base', 'content', 'commerce'],
  },
];

export const EDITORIAL_COLLECTIONS = [
  'carzo_pages',
  'carzo_page_blocks',
  'carzo_designs',
  'carzo_sizes',
  'carzo_brands',
  'carzo_gallery_images',
  'carzo_media_settings',
  'carzo_content_sets',
  'carzo_content_sections',
  'carzo_faq_items',
  'carzo_logo_settings',
  'carzo_logo_placements',
  'carzo_rich_sections',
  'carzo_rich_section_images',
  'carzo_benefit_modals',
  'carzo_site_settings',
];

export const EDITORIAL_DELETE_COLLECTIONS = [
  'carzo_page_blocks',
  'carzo_gallery_images',
  'carzo_rich_sections',
  'carzo_rich_section_images',
];

export const COMMERCIAL_COLLECTIONS = [
  'carzo_variants',
  'carzo_fixations',
  'carzo_discount_tiers',
  'carzo_brand_pricing',
  'carzo_size_shipping',
];

export const ORDER_COLLECTIONS = [
  'carzo_orders',
  'carzo_order_items',
];

export const NOTIFICATION_COLLECTIONS = [
  'carzo_notification_settings',
];

export const INTEGRATION_COLLECTIONS = [
  'carzo_telegram_bot_settings',
];

function permission(policyKey, collection, action, options = {}) {
  return {
    policyKey,
    collection,
    action,
    permissions: options.permissions ?? null,
    validation: options.validation ?? null,
    presets: options.presets ?? null,
    fields: options.fields ?? ['*'],
  };
}

export function buildAccessGrants({ collectionNames }) {
  const grants = [];

  for (const collection of collectionNames) {
    if (
      ORDER_COLLECTIONS.includes(collection)
      || NOTIFICATION_COLLECTIONS.includes(collection)
      || INTEGRATION_COLLECTIONS.includes(collection)
    ) continue;
    grants.push(permission('api', collection, 'read'));
    grants.push(permission('base', collection, 'read'));
  }

  for (const collection of ORDER_COLLECTIONS) {
    if (!collectionNames.includes(collection)) continue;
    grants.push(permission('api', collection, 'create'));
    grants.push(permission('commerce', collection, 'read'));
  }
  if (collectionNames.includes('carzo_orders')) {
    grants.push(permission('commerce', 'carzo_orders', 'update'));
  }

  for (const collection of NOTIFICATION_COLLECTIONS) {
    if (!collectionNames.includes(collection)) continue;
    grants.push(permission('api', collection, 'read'));
    grants.push(permission('commerce', collection, 'read'));
    grants.push(permission('commerce', collection, 'update'));
  }

  for (const collection of INTEGRATION_COLLECTIONS) {
    if (!collectionNames.includes(collection)) continue;
    grants.push(permission('api', collection, 'read'));
  }

  grants.push(permission('api', 'directus_notifications', 'create'));

  grants.push(permission('api', 'directus_files', 'read'));
  grants.push(permission('base', 'directus_files', 'read'));
  grants.push(permission('base', 'directus_folders', 'read'));

  for (const collection of EDITORIAL_COLLECTIONS) {
    grants.push(permission('content', collection, 'create'));
    grants.push(permission('content', collection, 'update'));
  }

  for (const collection of EDITORIAL_DELETE_COLLECTIONS) {
    grants.push(permission('content', collection, 'delete'));
  }

  grants.push(permission('content', 'directus_files', 'create'));
  grants.push(permission('content', 'directus_files', 'update'));
  grants.push(permission('content', 'directus_files', 'delete'));

  for (const collection of COMMERCIAL_COLLECTIONS) {
    grants.push(permission('commerce', collection, 'create'));
    grants.push(permission('commerce', collection, 'update'));
  }

  return grants;
}

export function managedPermissionCollections(collectionNames) {
  return new Set([
    ...collectionNames,
    'directus_files',
    'directus_folders',
    'directus_notifications',
  ]);
}
