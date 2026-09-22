function getDirectusUrl() {
  return process.env.DIRECTUS_URL?.replace(/\/$/, '') || null;
}

function getDirectusToken() {
  return process.env.DIRECTUS_READ_TOKEN?.trim() || null;
}

/** Validates and normalizes an external media URL. Only absolute https URLs are accepted. */
export function normalizeExternalUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

/** Builds a Directus asset URL from a file id (uuid string or `{ id }` relation object). */
export function directusAssetUrl(file: unknown): string {
  const directusUrl = getDirectusUrl();
  if (!directusUrl || !file) return '';
  const id = typeof file === 'string' ? file : (file as { id?: string | null })?.id;
  if (typeof id !== 'string' || !id) return '';
  return getDirectusToken()
    ? `/api/directus-assets/${encodeURIComponent(id)}`
    : `${directusUrl}/assets/${id}`;
}

/**
 * Universal media URL resolver with migration-friendly priority:
 *   1. externalUrl — e.g. a Cloudflare R2 URL (`https://media.carzo.com.ua/...`)
 *   2. directusFile — legacy Directus file reference (uuid string or `{ id }`)
 *   3. fallback — local path or static default
 *
 * External URLs always win so that a gradual R2 migration does not require
 * deleting the Directus file field first.
 */
export function resolveMediaUrl(
  externalUrl?: unknown,
  directusFile?: unknown,
  fallback = '',
): string {
  const external = normalizeExternalUrl(externalUrl);
  if (external) return external;

  const fromDirectus = directusAssetUrl(directusFile);
  if (fromDirectus) return fromDirectus;

  return fallback;
}

/**
 * Resolves media from a JSON array item that may carry either a plain URL/path
 * string in `image` or a separate `imageUrl` key plus a Directus file id in `image`.
 */
export function resolveJsonMediaUrl(
  item: { image?: unknown; imageUrl?: unknown } | null | undefined,
  fallback = '',
): string {
  if (!item) return fallback;

  const external = normalizeExternalUrl(item.imageUrl) || normalizeExternalUrl(item.image);
  if (external) return external;

  // `image` may hold a local path (starts with `/` or is a relative asset) or a Directus uuid.
  const imageValue = typeof item.image === 'string' ? item.image.trim() : '';
  if (imageValue.startsWith('/') || imageValue.startsWith('./')) return imageValue || fallback;

  const fromDirectus = directusAssetUrl(item.image);
  return fromDirectus || fallback;
}
