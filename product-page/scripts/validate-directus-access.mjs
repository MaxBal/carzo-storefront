import assert from 'node:assert/strict';
import {
  ACCESS_POLICY_DEFINITIONS,
  ACCESS_ROLE_DEFINITIONS,
  COMMERCIAL_COLLECTIONS,
  EDITORIAL_DELETE_COLLECTIONS,
  EDITORIAL_COLLECTIONS,
  INTEGRATION_COLLECTIONS,
  NOTIFICATION_COLLECTIONS,
  ORDER_COLLECTIONS,
  buildAccessGrants,
} from '../directus/access-control.mjs';
import {
  DIRECTUS_COLLECTION_GROUPS,
  DIRECTUS_COLLECTION_GROUP_NAMES,
  DIRECTUS_COLLECTION_NAVIGATION,
} from '../directus/navigation.mjs';

const collectionNames = [
  'carzo_pages',
  'carzo_page_blocks',
  'carzo_designs',
  'carzo_sizes',
  'carzo_brands',
  'carzo_brand_pricing',
  'carzo_size_shipping',
  'carzo_fixations',
  'carzo_variants',
  'carzo_gallery_images',
  'carzo_content_sets',
  'carzo_content_sections',
  'carzo_faq_items',
  'carzo_logo_settings',
  'carzo_logo_placements',
  'carzo_rich_sections',
  'carzo_benefit_modals',
  'carzo_discount_tiers',
  'carzo_site_settings',
  'carzo_orders',
  'carzo_order_items',
  'carzo_notification_settings',
  'carzo_telegram_bot_settings',
];
const grants = buildAccessGrants({ collectionNames });

assert.deepEqual(
  Object.keys(DIRECTUS_COLLECTION_NAVIGATION).sort(),
  [...collectionNames].sort(),
  'Every data collection must have exactly one Directus navigation entry',
);
for (const [collection, navigation] of Object.entries(DIRECTUS_COLLECTION_NAVIGATION)) {
  assert(DIRECTUS_COLLECTION_GROUP_NAMES.has(navigation.group), `${collection} references an unknown Directus group`);
  assert.equal(typeof navigation.label, 'string', `${collection} must have a translated Studio label`);
  assert(navigation.label.length > 0, `${collection} must have a non-empty Studio label`);
  assert(Number.isInteger(navigation.sort), `${collection} must have an integer Studio sort order`);
}
for (const group of DIRECTUS_COLLECTION_GROUPS) {
  if (group.group) {
    assert(DIRECTUS_COLLECTION_GROUP_NAMES.has(group.group), `${group.collection} references an unknown parent group`);
    assert.notEqual(group.group, group.collection, `${group.collection} cannot contain itself`);
  }
  assert(
    ['open', 'closed', 'locked'].includes(group.collapse || 'closed'),
    `${group.collection} has an invalid collapse behavior`,
  );
}

const keys = grants.map(grant => `${grant.policyKey}:${grant.collection}:${grant.action}`);
assert.equal(new Set(keys).size, keys.length, 'Every policy/collection/action grant must be unique');

for (const collection of collectionNames) {
  if (
    ORDER_COLLECTIONS.includes(collection)
    || NOTIFICATION_COLLECTIONS.includes(collection)
    || INTEGRATION_COLLECTIONS.includes(collection)
  ) continue;
  assert(keys.includes(`api:${collection}:read`), `Storefront API read is missing for ${collection}`);
  assert(keys.includes(`base:${collection}:read`), `Base internal read is missing for ${collection}`);
}

for (const collection of ORDER_COLLECTIONS) {
  assert(keys.includes(`api:${collection}:create`), `Storefront order create is missing for ${collection}`);
  assert(keys.includes(`commerce:${collection}:read`), `Commerce order read is missing for ${collection}`);
  assert(!keys.includes(`api:${collection}:read`), `Storefront API must not read customer data from ${collection}`);
  assert(!keys.includes(`base:${collection}:read`), `Base roles must not read customer data from ${collection}`);
}
assert(keys.includes('commerce:carzo_orders:update'), 'Commerce order status update is missing');
assert(!keys.includes('commerce:carzo_order_items:update'), 'Order item snapshots must remain immutable');

for (const collection of NOTIFICATION_COLLECTIONS) {
  assert(keys.includes(`api:${collection}:read`), `Notification settings API read is missing for ${collection}`);
  assert(keys.includes(`commerce:${collection}:read`), `Commerce notification settings read is missing for ${collection}`);
  assert(keys.includes(`commerce:${collection}:update`), `Commerce notification settings update is missing for ${collection}`);
  assert(!keys.includes(`base:${collection}:read`), `Base roles must not read notification settings from ${collection}`);
  assert(!keys.includes(`content:${collection}:update`), `Content policy must not edit ${collection}`);
}
assert(keys.includes('api:directus_notifications:create'), 'Storefront must create Directus notifications');

for (const collection of INTEGRATION_COLLECTIONS) {
  assert(keys.includes(`api:${collection}:read`), `Storefront API read is missing for ${collection}`);
  assert(!keys.some(key => key.startsWith(`base:${collection}:`)));
  assert(!keys.some(key => key.startsWith(`content:${collection}:`)));
  assert(!keys.some(key => key.startsWith(`commerce:${collection}:`)));
}

assert.equal(
  grants.some(item => item.policyKey === 'public'),
  false,
  'Carzo data must not be available through unauthenticated public permissions',
);
for (const grant of grants.filter(item => item.policyKey === 'api')) {
  const allowed = grant.action === 'read'
    || (grant.action === 'create' && (
      ORDER_COLLECTIONS.includes(grant.collection)
      || grant.collection === 'directus_notifications'
    ));
  assert.equal(allowed, true, 'Storefront API may only read server data, create orders, or create notifications');
}
for (const grant of grants.filter(item => item.policyKey === 'base')) {
  assert.equal(grant.action, 'read', 'Base policy must remain read-only');
}

for (const grant of grants) {
  assert.equal(grant.permissions, null, `${grant.collection}:${grant.action} must not rely on a custom item filter`);
  assert.equal(grant.validation, null, `${grant.collection}:${grant.action} must not rely on custom validation`);
  assert.equal(grant.presets, null, `${grant.collection}:${grant.action} must not rely on permission presets`);
  assert.deepEqual(grant.fields, ['*'], `${grant.collection}:${grant.action} must use a Core-compatible full field grant`);
}

const dataDeletes = grants.filter(grant => (
  grant.action === 'delete' && grant.collection.startsWith('carzo_')
));
assert.deepEqual(
  dataDeletes.map(grant => grant.collection).sort(),
  [...EDITORIAL_DELETE_COLLECTIONS].sort(),
  'Only disposable page blocks may be permanently deleted by non-admin roles',
);

const contentWriteCollections = new Set(
  grants
    .filter(grant => grant.policyKey === 'content' && ['create', 'update'].includes(grant.action))
    .map(grant => grant.collection),
);
for (const collection of EDITORIAL_COLLECTIONS) {
  assert(contentWriteCollections.has(collection), `Content write permission is missing for ${collection}`);
}
for (const collection of COMMERCIAL_COLLECTIONS) {
  assert(!contentWriteCollections.has(collection), `Content policy must not write ${collection}`);
}

const commerceWriteCollections = new Set(
  grants
    .filter(grant => grant.policyKey === 'commerce' && ['create', 'update'].includes(grant.action))
    .map(grant => grant.collection),
);
for (const collection of COMMERCIAL_COLLECTIONS) {
  assert(commerceWriteCollections.has(collection), `Commerce write permission is missing for ${collection}`);
}
for (const collection of EDITORIAL_COLLECTIONS) {
  assert(!commerceWriteCollections.has(collection), `Commerce policy must not write ${collection}`);
}

const roleByName = new Map(ACCESS_ROLE_DEFINITIONS.map(role => [role.name, role]));
assert.deepEqual(roleByName.get('Carzo API Reader')?.policyKeys, ['api']);
assert.deepEqual(roleByName.get('Carzo Viewer')?.policyKeys, ['base']);
assert.deepEqual(roleByName.get('Carzo Content Editor')?.policyKeys, ['base', 'content']);
assert.deepEqual(roleByName.get('Carzo Commercial Manager')?.policyKeys, ['base', 'commerce']);
assert.deepEqual(roleByName.get('Carzo Store Manager')?.policyKeys, ['base', 'content', 'commerce']);
assert.equal(ACCESS_POLICY_DEFINITIONS.api.appAccess, false, 'API policy must not grant Data Studio access');
assert.equal(ACCESS_POLICY_DEFINITIONS.base.appAccess, true, 'Base policy must grant Data Studio access');
assert.equal(ACCESS_POLICY_DEFINITIONS.content.appAccess, false, 'Content policy must remain composable');
assert.equal(ACCESS_POLICY_DEFINITIONS.commerce.appAccess, false, 'Commerce policy must remain composable');

for (const collection of EDITORIAL_COLLECTIONS) {
  assert(!COMMERCIAL_COLLECTIONS.includes(collection), `${collection} cannot be both editorial and commercial`);
}
for (const collection of ORDER_COLLECTIONS) {
  assert(!EDITORIAL_COLLECTIONS.includes(collection), `${collection} cannot be editorial`);
  assert(!COMMERCIAL_COLLECTIONS.includes(collection), `${collection} uses dedicated order permissions`);
}
for (const collection of NOTIFICATION_COLLECTIONS) {
  assert(!EDITORIAL_COLLECTIONS.includes(collection), `${collection} cannot be editorial`);
  assert(!COMMERCIAL_COLLECTIONS.includes(collection), `${collection} uses dedicated notification permissions`);
}
for (const collection of INTEGRATION_COLLECTIONS) {
  assert(!EDITORIAL_COLLECTIONS.includes(collection), `${collection} cannot be editorial`);
  assert(!COMMERCIAL_COLLECTIONS.includes(collection), `${collection} cannot be commercial`);
  assert(!ORDER_COLLECTIONS.includes(collection), `${collection} cannot contain orders`);
}

console.log(JSON.stringify({
  ok: true,
  policies: Object.values(ACCESS_POLICY_DEFINITIONS).map(item => item.name),
  roles: ACCESS_ROLE_DEFINITIONS.map(item => item.name),
  grants: grants.length,
}, null, 2));
