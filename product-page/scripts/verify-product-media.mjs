import assert from 'node:assert/strict';

const baseUrl = process.env.DIRECTUS_URL?.replace(/\/$/, '');
const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
if (!baseUrl || !adminToken) throw new Error('DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN are required');

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${payload?.errors?.[0]?.message || response.statusText}`);
  return payload.data;
}

const [gallery, templates, richMedia, mediaSettings, galleryAlt, galleryDesign, gallerySize] = await Promise.all([
  request('/items/carzo_gallery_images?limit=-1&fields=key,status,sort,alt,design.slug,size.code,image,external_url'),
  request('/items/carzo_rich_sections?limit=-1&fields=key,status,sort,title'),
  request('/items/carzo_rich_section_images?limit=-1&fields=key,status,design.slug,section.key,image,external_url'),
  request('/items/carzo_media_settings?fields=status,image,external_url'),
  request('/fields/carzo_gallery_images/alt'),
  request('/fields/carzo_gallery_images/design'),
  request('/fields/carzo_gallery_images/size'),
]);

const legacyFallbacks = gallery.filter(item => item.key.startsWith('gallery-fallback-'));
assert.equal(legacyFallbacks.length, 4, 'Expected the four legacy gallery records to remain auditable');
assert(legacyFallbacks.every(item => item.status === 'archived'), 'Legacy global gallery records must be archived');
assert(!gallery.some(item => item.status === 'published' && (!item.design || !item.size)), 'Published galleries must always target an exact design and size');

const carzo4LGallery = gallery
  .filter(item => item.status === 'published' && item.design?.slug === '4-0' && item.size?.code === 'L')
  .sort((a, b) => a.sort - b.sort);
assert.equal(carzo4LGallery.length, 5, 'Carzo 4.0 L must contain exactly five gallery images');
assert.deepEqual(carzo4LGallery.map(item => item.sort), [1, 2, 3, 4, 5]);
assert(carzo4LGallery.every(item => item.image && !item.external_url), 'Imported gallery must use Directus uploads');

const publishedTemplates = templates.filter(item => item.status === 'published');
assert.equal(publishedTemplates.length, 4, 'The shared rich-content template must contain four blocks');
for (const designSlug of ['2-0', '3-0', '4-0']) {
  const designMedia = richMedia.filter(item => item.status === 'published' && item.design?.slug === designSlug);
  assert.equal(designMedia.length, publishedTemplates.length, `${designSlug} must have one rich image per template block`);
  assert.deepEqual(
    new Set(designMedia.map(item => item.section?.key)),
    new Set(publishedTemplates.map(item => item.key)),
    `${designSlug} rich images must match the global template`,
  );
}
assert(mediaSettings?.image || mediaSettings?.external_url, 'A global media placeholder must be configured');
assert.equal(mediaSettings.status, 'published');
assert.equal(galleryAlt.schema.is_nullable, true, 'Gallery alt override must be optional');
assert.equal(galleryAlt.meta.required, false, 'Gallery alt override must be optional in Studio');
assert.equal(galleryDesign.meta.required, true, 'Gallery design must be required in Studio');
assert.equal(gallerySize.meta.required, true, 'Gallery size must be required in Studio');

console.log(JSON.stringify({
  ok: true,
  archivedLegacyGalleries: legacyFallbacks.length,
  carzo4LGallery: carzo4LGallery.length,
  richTemplates: publishedTemplates.length,
  richMediaByDesign: Object.fromEntries(['2-0', '3-0', '4-0'].map(designSlug => [
    designSlug,
    richMedia.filter(item => item.status === 'published' && item.design?.slug === designSlug).length,
  ])),
  placeholderConfigured: true,
}, null, 2));
