import 'server-only';
import { isIP } from 'node:net';
import { getMetaPublicConfig, metaHostAllowed } from './config';
import type { MetaTrackingContext } from './types';

export const META_CONSENT_COOKIE = 'carzo_marketing_v1';
export const META_CONSENT_ID_COOKIE = 'carzo_marketing_id';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function cookieValue(headers: Pick<Headers, 'get'>, name: string): string | undefined {
  const value = (headers.get('cookie') ?? '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!value || value.length > 2000) return undefined;
  try { return decodeURIComponent(value); } catch { return undefined; }
}

export function readMetaContext(headers: Pick<Headers, 'get'>): MetaTrackingContext | null {
  const config = getMetaPublicConfig();
  if (!config || headers.get('sec-gpc') === '1' || headers.get('dnt') === '1'
    || cookieValue(headers, META_CONSENT_COOKIE) !== 'granted') return null;
  const consentId = cookieValue(headers, META_CONSENT_ID_COOKIE);
  const referer = headers.get('referer');
  const origin = headers.get('origin');
  if (!consentId || !UUID.test(consentId) || !referer || !origin || !metaHostAllowed(referer, config) || !metaHostAllowed(origin, config)) return null;
  const page = new URL(referer);
  if (page.origin !== new URL(origin).origin) return null;
  const userAgent = headers.get('user-agent')?.slice(0, 512);
  if (!userAgent) return null;
  const address = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const fbp = cookieValue(headers, '_fbp');
  const fbc = cookieValue(headers, '_fbc');
  return {
    consentId, sourceUrl: page.origin + page.pathname, userAgent,
    ...(address && isIP(address) ? { ip: address } : {}),
    ...(fbp && /^fb\.\d\.\d{13}\.\d+$/.test(fbp) ? { fbp } : {}),
    ...(fbc && /^fb\.\d\.\d{13}\.[A-Za-z0-9._-]+$/.test(fbc) ? { fbc } : {}),
  };
}
