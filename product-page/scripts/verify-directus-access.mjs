import assert from 'node:assert/strict';
import {
  ACCESS_POLICY_DEFINITIONS,
  ACCESS_ROLE_DEFINITIONS,
  buildAccessGrants,
  INTEGRATION_COLLECTIONS,
  managedPermissionCollections,
} from '../directus/access-control.mjs';
import {
  DIRECTUS_COLLECTION_GROUPS,
  DIRECTUS_COLLECTION_GROUP_NAMES,
  DIRECTUS_COLLECTION_NAVIGATION,
} from '../directus/navigation.mjs';

const baseUrl = process.env.DIRECTUS_URL?.replace(/\/$/, '');
const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;

if (!baseUrl || !adminToken) {
  throw new Error('DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN are required');
}

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${path}: ${response.status} ${payload?.errors?.[0]?.message || response.statusText}`);
  }
  return payload.data;
}

const [collections, policies, roles, access, permissions, flows] = await Promise.all([
  request('/collections?limit=-1&fields=collection,meta.*,schema.*'),
  request('/policies?limit=-1&fields=id,name,app_access,admin_access'),
  request('/roles?limit=-1&fields=id,name'),
  request('/access?limit=-1&fields=id,role,policy'),
  request('/permissions?limit=-1&fields=policy,collection,action,fields,permissions,validation,presets'),
  request('/flows?limit=-1&fields=id,name,status,trigger,options,operation'),
]);

const collectionNames = collections
  .map(item => item.collection)
  .filter(name => name.startsWith('carzo_') && !DIRECTUS_COLLECTION_GROUP_NAMES.has(name));
const grants = buildAccessGrants({ collectionNames });
const managedCollections = managedPermissionCollections(collectionNames);
const policyByKey = new Map();

for (const definition of DIRECTUS_COLLECTION_GROUPS) {
  const live = collections.find(item => item.collection === definition.collection);
  assert(live, `Live Directus group is missing: ${definition.collection}`);
  assert.equal(live.schema, null, `${definition.collection} must remain a virtual folder`);
  assert.equal(live.meta.group, definition.group || null, `${definition.collection} has an incorrect parent folder`);
  assert.equal(live.meta.sort, definition.sort, `${definition.collection} has an incorrect sort order`);
  assert.equal(live.meta.collapse, definition.collapse || 'closed', `${definition.collection} has an incorrect collapse behavior`);
  assert(
    live.meta.translations?.some(item => item.language === 'en-US' && item.translation === definition.label),
    `${definition.collection} has an incorrect Studio label`,
  );
}

for (const [collection, navigation] of Object.entries(DIRECTUS_COLLECTION_NAVIGATION)) {
  const live = collections.find(item => item.collection === collection);
  assert(live, `Live collection is missing: ${collection}`);
  assert.equal(live.meta.group, navigation.group, `${collection} is in the wrong Directus group`);
  assert.equal(live.meta.sort, navigation.sort, `${collection} has an incorrect Studio sort order`);
  assert(
    live.meta.translations?.some(item => item.language === 'en-US' && item.translation === navigation.label),
    `${collection} has an incorrect Studio label`,
  );
}

for (const [key, definition] of Object.entries(ACCESS_POLICY_DEFINITIONS)) {
  const policy = policies.find(item => item.name === definition.name);
  assert(policy, `Live policy is missing: ${definition.name}`);
  assert.equal(policy.app_access, definition.appAccess, `${definition.name} has incorrect app_access`);
  assert.equal(policy.admin_access, false, `${definition.name} must not have Admin Access`);
  policyByKey.set(key, policy);
}

const publicPolicy = policies.find(item => item.name === '$t:public_label');
assert(publicPolicy, 'Directus public policy is missing');

for (const definition of ACCESS_ROLE_DEFINITIONS) {
  const role = roles.find(item => item.name === definition.name);
  assert(role, `Live role is missing: ${definition.name}`);
  const actualPolicyIds = access
    .filter(item => item.role === role.id)
    .map(item => item.policy)
    .sort();
  const expectedPolicyIds = definition.policyKeys
    .map(key => policyByKey.get(key).id)
    .sort();
  assert.deepEqual(actualPolicyIds, expectedPolicyIds, `${definition.name} has incorrect policies`);
}

for (const grant of grants) {
  const policyId = policyByKey.get(grant.policyKey).id;
  const live = permissions.find(item => (
    item.policy === policyId
    && item.collection === grant.collection
    && item.action === grant.action
  ));
  assert(live, `Live permission is missing: ${grant.policyKey}:${grant.collection}:${grant.action}`);
  assert.deepEqual(live.fields, grant.fields, `Live permission fields are incorrect: ${grant.collection}:${grant.action}`);
  assert.equal(live.permissions, null);
  assert.equal(live.validation, null);
  assert.equal(live.presets, null);
}

const desiredKeysByPolicy = new Map();
for (const grant of grants) {
  const policyId = policyByKey.get(grant.policyKey).id;
  if (!desiredKeysByPolicy.has(policyId)) desiredKeysByPolicy.set(policyId, new Set());
  desiredKeysByPolicy.get(policyId).add(`${grant.collection}:${grant.action}`);
}
for (const permission of permissions) {
  if (!managedCollections.has(permission.collection)) continue;
  if (permission.policy === publicPolicy.id) {
    assert.fail(`Public permission still exists: ${permission.collection}:${permission.action}`);
  }
  const desired = desiredKeysByPolicy.get(permission.policy);
  if (!desired) continue;
  assert(desired.has(`${permission.collection}:${permission.action}`), `Obsolete managed permission remains: ${permission.collection}:${permission.action}`);
}

for (const [collection, fields] of Object.entries({
  carzo_brands: ['logo_extra'],
  carzo_sizes: ['shipping_length_cm', 'shipping_width_cm', 'shipping_height_cm', 'shipping_weight_kg'],
})) {
  for (const field of fields) {
    const live = await request(`/fields/${collection}/${field}`);
    assert.equal(live.meta.hidden, true, `${collection}.${field} must be hidden`);
    assert.equal(live.meta.readonly, true, `${collection}.${field} must be read-only`);
  }
}

const anonymousResponse = await fetch(`${baseUrl}/items/carzo_designs?limit=1`);
assert.equal(anonymousResponse.status, 403, 'Carzo collections must reject anonymous reads');

const notificationSettings = await request(
  '/items/carzo_notification_settings?fields=channel,directus_user_ids,subject_template,message_template',
);
assert(
  ['off', 'email', 'telegram', 'both'].includes(notificationSettings.channel),
  'Notification channel is invalid',
);
assert(Array.isArray(notificationSettings.directus_user_ids));
assert.equal(typeof notificationSettings.subject_template, 'string');
assert.equal(typeof notificationSettings.message_template, 'string');
assert(
  notificationSettings.message_template.includes('{{contact_method}}'),
  'Notification template must include the preferred contact method',
);

const contactMethodField = await request('/fields/carzo_orders/contact_method');
assert.equal(contactMethodField.schema.default_value, 'phone');
assert.equal(contactMethodField.meta.required, true);
assert.deepEqual(
  contactMethodField.meta.options?.choices?.map(item => item.value),
  ['phone', 'telegram', 'viber', 'whatsapp'],
);
assert(
  contactMethodField.meta.translations?.some(item => (
    item.language === 'en-US' && item.translation === 'Спосіб зв’язку'
  )),
  'Contact method must have a Ukrainian Studio label',
);
const legacyEmailField = await request('/fields/carzo_orders/customer_email');
assert.equal(legacyEmailField.meta.hidden, true, 'Legacy customer email must be hidden');
assert.equal(legacyEmailField.meta.readonly, true, 'Legacy customer email must be read-only');

const siteSettings = await request('/items/carzo_site_settings?fields=checkout_payment_details');
assert(
  siteSettings.checkout_payment_details === null
    || typeof siteSettings.checkout_payment_details === 'string',
  'Checkout payment details must be empty or plain text',
);
const paymentDetailsField = await request('/fields/carzo_site_settings/checkout_payment_details');
assert.equal(paymentDetailsField.meta.interface, 'input-multiline');
assert.equal(paymentDetailsField.meta.options?.placeholder, 'Тут треба вставити реквізити');
assert(
  paymentDetailsField.meta.translations?.some(item => (
    item.language === 'en-US' && item.translation === 'Реквізити для оплати'
  )),
  'Payment details must have a Ukrainian Studio label',
);

const telegramBotSettings = await request('/items/carzo_telegram_bot_settings?fields=chat_ids,bot_token');
assert(Array.isArray(telegramBotSettings.chat_ids));
assert.equal(typeof telegramBotSettings.bot_token, 'string');
const telegramTokenField = await request('/fields/carzo_telegram_bot_settings/bot_token');
assert.equal(telegramTokenField.meta.interface, 'input');
assert.equal(telegramTokenField.meta.options?.masked, true, 'Telegram token must use a masked input');
for (const collection of INTEGRATION_COLLECTIONS) {
  const nonApiAccess = permissions.filter(item => (
    item.collection === collection
    && item.policy !== policyByKey.get('api').id
    && item.policy !== publicPolicy.id
  ));
  assert.equal(nonApiAccess.length, 0, `${collection} must remain admin-only outside the server API`);
}

const legacyNotificationFlow = flows.find(item => item.name === 'Carzo — Нове замовлення');
if (legacyNotificationFlow) {
  assert.equal(legacyNotificationFlow.status, 'inactive', 'Legacy notification flow must stay inactive to prevent duplicates');
}

console.log(JSON.stringify({
  ok: true,
  collections: collectionNames.length,
  collectionGroups: DIRECTUS_COLLECTION_GROUPS.length,
  policies: Object.keys(ACCESS_POLICY_DEFINITIONS).length,
  roles: ACCESS_ROLE_DEFINITIONS.length,
  grants: grants.length,
  notificationChannel: notificationSettings.channel,
  legacyFlowDisabled: legacyNotificationFlow?.status === 'inactive',
  anonymousReadStatus: anonymousResponse.status,
}, null, 2));
