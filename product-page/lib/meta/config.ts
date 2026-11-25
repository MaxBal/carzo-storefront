import 'server-only';
import type { MetaDestination, MetaPublicConfig } from './types';

type Environment = Record<string, string | undefined>;
const keyPattern = /^[a-z][a-z0-9_]{0,39}$/;
const strings = (value: unknown): string[] => Array.isArray(value) && value.every(item => typeof item === 'string') ? value : [];

export function metaTokenName(key: string): string {
  if (!keyPattern.test(key)) throw new Error('Invalid Meta destination');
  return `META_${key.toUpperCase()}_ACCESS_TOKEN`;
}

/** No credentials or environment objects are ever returned to the client. */
export function getMetaPublicConfig(env: Environment = process.env): MetaPublicConfig | null {
  if (env.META_ENABLED !== 'true' || env.VERCEL_ENV !== 'production') return null;
  const allowedHosts = (env.META_ALLOWED_HOSTS ?? '').split(',').map(host => host.trim().toLowerCase()).filter(Boolean);
  if (!allowedHosts.length || allowedHosts.some(host => !/^[a-z0-9.-]+$/.test(host)
    || host.endsWith('.vercel.app') || host === 'localhost' || /^[\d.]+$/.test(host))) return null;
  try {
    const rows: unknown = JSON.parse(env.META_DESTINATIONS ?? '[]');
    if (!Array.isArray(rows) || rows.length > 10) return null;
    const destinations: MetaDestination[] = [];
    const keys = new Set<string>(), pixels = new Set<string>(), types = new Set<string>();
    for (const item of rows) {
      if (!item || typeof item !== 'object' || item.enabled === false) continue;
      const { key, pixelId } = item;
      const productTypes = strings(item.productTypes);
      const pagePaths = strings(item.pagePaths);
      const pathPrefixes = strings(item.pathPrefixes);
      if (typeof key !== 'string' || !keyPattern.test(key) || typeof pixelId !== 'string' || !/^\d{5,20}$/.test(pixelId)
        || keys.has(key) || pixels.has(pixelId) || !productTypes.length
        || productTypes.some(type => !/^[a-z][a-z0-9_-]{0,63}$/.test(type) || types.has(type))
        || [...pagePaths, ...pathPrefixes].some(path => !path.startsWith('/') || path.includes('?') || path.startsWith('//'))
        || pathPrefixes.some(path => path === '/' || !path.endsWith('/'))
        || !env[metaTokenName(key)]?.trim()) return null;
      keys.add(key); pixels.add(pixelId); productTypes.forEach(type => types.add(type));
      destinations.push({ key, pixelId, productTypes, pagePaths, pathPrefixes });
    }
    return destinations.length ? { allowedHosts, destinations } : null;
  } catch { return null; }
}

export function getMetaToken(key: string): string | null {
  return process.env[metaTokenName(key)]?.trim() || null;
}

export function metaHostAllowed(url: string, config: MetaPublicConfig): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && config.allowedHosts.includes(parsed.hostname.toLowerCase());
  } catch { return false; }
}
