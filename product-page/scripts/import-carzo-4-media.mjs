import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

const baseUrl = process.env.DIRECTUS_URL?.replace(/\/$/, '');
const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
const sourceDirectory = process.argv[2] ? resolve(process.argv[2]) : null;

if (!baseUrl || !adminToken) throw new Error('DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN are required');
if (!sourceDirectory) throw new Error('Usage: npm run directus:import-carzo4 -- <extracted archive directory>');
if (!(await stat(sourceDirectory)).isDirectory()) throw new Error(`Not a directory: ${sourceDirectory}`);

const headers = { Authorization: `Bearer ${adminToken}` };
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
const windows1251Decoder = new TextDecoder('windows-1251');
const windows1251ByteByCharacter = new Map(
  Array.from({ length: 256 }, (_, byte) => [windows1251Decoder.decode(Uint8Array.of(byte)), byte]),
);

function repairZipFileName(value) {
  try {
    const bytes = Uint8Array.from([...value].map(character => {
      const byte = windows1251ByteByCharacter.get(character);
      if (byte === undefined) throw new Error('Not Windows-1251 mojibake');
      return byte;
    }));
    return utf8Decoder.decode(bytes);
  } catch {
    return value;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: options.body instanceof FormData
      ? headers
      : { ...headers, 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response.text();
  const payload = body ? JSON.parse(body) : null;
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path}: ${payload?.errors?.[0]?.message || response.statusText}`);
  }
  return payload?.data ?? payload;
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

async function findOne(collection, field, value) {
  const query = new URLSearchParams({ limit: '1', [`filter[${field}][_eq]`]: String(value) });
  const rows = await request(`/items/${collection}?${query}`);
  return rows[0] || null;
}

async function upsert(collection, key, data) {
  const existing = await findOne(collection, 'key', key);
  if (existing) {
    return request(`/items/${collection}/${existing.id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    });
  }
  return request(`/items/${collection}`, {
    method: 'POST', body: JSON.stringify({ id: randomUUID(), key, ...data }),
  });
}

function mimeType(path) {
  const extension = extname(path).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.svg') return 'image/svg+xml';
  return 'image/jpeg';
}

async function ensureFolder() {
  const folder = await request('/folders?limit=1&filter[name][_eq]=Carzo');
  if (folder[0]) return folder[0].id;
  return (await request('/folders', { method: 'POST', body: JSON.stringify({ name: 'Carzo' }) })).id;
}

async function upload(path, folderId, label) {
  const bytes = await readFile(path);
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const title = `Carzo: ${label} [${digest}]`;
  const query = new URLSearchParams({ limit: '1', 'filter[title][_eq]': title });
  const existing = await request(`/files?${query}`);
  if (existing[0]) return existing[0].id;

  const form = new FormData();
  form.append('folder', folderId);
  form.append('title', title);
  form.append('file', new Blob([bytes], { type: mimeType(path) }), basename(path));
  return (await request('/files', { method: 'POST', body: form })).id;
}

const imageFiles = (await walk(sourceDirectory)).filter(path => (
  /\.(jpe?g|png|webp)$/i.test(path)
  && !basename(path).startsWith('._')
  && !path.includes('__MACOSX')
));
const galleryFiles = imageFiles
  .filter(path => /^\d+\.(jpe?g|png|webp)$/i.test(basename(path)))
  .sort((a, b) => Number.parseInt(basename(a), 10) - Number.parseInt(basename(b), 10));

const richMatchers = new Map([
  ['rich-materials', name => name.includes('матеріал') || name.includes('материал')],
  ['rich-magnets', name => name.includes('магніт') || name.includes('магнит')],
  ['rich-edging', name => name.includes('окантов') || name.includes('оконт')],
  ['rich-handles', name => name.includes('ручк')],
]);
const richFiles = new Map();
for (const path of imageFiles) {
  const normalizedName = repairZipFileName(basename(path)).normalize('NFC').toLocaleLowerCase('uk-UA');
  for (const [sectionKey, matcher] of richMatchers) {
    if (matcher(normalizedName)) richFiles.set(sectionKey, path);
  }
}

if (galleryFiles.length !== 5) throw new Error(`Expected 5 numbered gallery images, found ${galleryFiles.length}`);
for (const sectionKey of richMatchers.keys()) {
  if (!richFiles.has(sectionKey)) {
    const available = imageFiles.map(path => repairZipFileName(basename(path))).join(', ');
    throw new Error(`Rich image is missing for ${sectionKey}. Available: ${available}`);
  }
}

const [design, size, sections, folderId] = await Promise.all([
  findOne('carzo_designs', 'slug', '4-0'),
  findOne('carzo_sizes', 'code', 'L'),
  request('/items/carzo_rich_sections?limit=-1&fields=id,key'),
  ensureFolder(),
]);
if (!design || !size) throw new Error('Carzo 4.0 design or L size is missing in Directus');
const sectionByKey = new Map(sections.map(section => [section.key, section]));

for (const [index, path] of galleryFiles.entries()) {
  const sort = index + 1;
  const image = await upload(path, folderId, `Carzo 4.0 L gallery ${sort}`);
  const key = `gallery:4-0:L:${sort}`;
  await upsert('carzo_gallery_images', key, {
    status: 'published', sort, design: design.id, size: size.id,
    image, external_url: null, alt: null,
  });
}

for (const [sectionKey, path] of richFiles) {
  const section = sectionByKey.get(sectionKey);
  if (!section) throw new Error(`Directus rich template is missing: ${sectionKey}`);
  const image = await upload(path, folderId, `Carzo 4.0 rich ${sectionKey}`);
  const key = `4-0:${sectionKey}`;
  await upsert('carzo_rich_section_images', key, {
    status: 'published', design: design.id, section: section.id,
    image, external_url: null, alt: null,
  });
}

console.log(JSON.stringify({
  ok: true,
  design: '4-0',
  size: 'L',
  galleryImages: galleryFiles.length,
  richImages: richFiles.size,
}, null, 2));
