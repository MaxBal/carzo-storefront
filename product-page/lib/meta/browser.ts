'use client';

import type { CartQuote } from '@/lib/cart/types';
import type { MetaBrowserEvent, MetaCustomData, MetaDestination, MetaEventName, MetaPublicConfig } from './types';
import { allocateDiscount } from './allocation';
import { isMetaTrackingEnabled } from './preference';

type Fbq = ((...args: unknown[]) => void) & { queue: unknown[][]; loaded: boolean; version: string; push?: Fbq; callMethod?: (...args: unknown[]) => void };
declare global { interface Window { fbq?: Fbq; _fbq?: Fbq } }
let config: MetaPublicConfig | null = null;
const initialized = new Set<string>();
const sent = new Set<string>();
export const CONSENT_COOKIE = 'carzo_marketing_v1';
export const CONSENT_ID_COOKIE = 'carzo_marketing_id';

export function browserCookie(name: string): string | undefined {
  const raw = document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
  try { return raw ? decodeURIComponent(raw) : undefined; } catch { return undefined; }
}

export function marketingHostAllowed(value: MetaPublicConfig): boolean {
  return location.protocol === 'https:' && value.allowedHosts.includes(location.hostname);
}

export function privacySignal(): boolean {
  return navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

export function configureMetaBrowser(value: MetaPublicConfig | null) { config = value; }

function allowed(): boolean {
  return Boolean(config && marketingHostAllowed(config) && !privacySignal() && isMetaTrackingEnabled(browserCookie(CONSENT_COOKIE)));
}

export function writeMarketingCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=15552000; SameSite=Lax; Secure`;
}

export function clearMarketingIdentifiers(clearConsentId = true) {
  for (const name of [...(clearConsentId ? [CONSENT_ID_COOKIE] : []), '_fbp', '_fbc']) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
    const parts = location.hostname.split('.');
    for (let index = 0; index < parts.length - 1; index++) {
      document.cookie = `${name}=; Domain=.${parts.slice(index).join('.')}; Path=/; Max-Age=0; SameSite=Lax; Secure`;
    }
  }
  try { window.fbq?.('consent', 'revoke'); } catch { /* A vendor error cannot prevent local revocation. */ }
}

export async function revokeQueuedMetaEvents() {
  clearMarketingIdentifiers(false);
  const consentId = browserCookie(CONSENT_ID_COOKIE);
  if (!consentId) return;
  try {
    const response = await fetch('/api/meta/consent', { method: 'DELETE', keepalive: true });
    // A slow revocation response must not clear a newer consent session.
    if (response.ok && browserCookie(CONSENT_ID_COOKIE) === consentId) {
      document.cookie = `${CONSENT_ID_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
    }
    // Keep only the anonymous revocation id on a network error, to retry on reload.
  } catch { /* Tracking is already denied; pending events also have a bounded TTL. */ }
}

export function captureMetaClick() {
  if (!allowed()) return;
  const clickId = new URL(location.href).searchParams.get('fbclid');
  if (clickId && /^[A-Za-z0-9._-]{1,1500}$/.test(clickId)) {
    const current = browserCookie('_fbc');
    if (!current?.endsWith(`.${clickId}`)) writeMarketingCookie('_fbc', `fb.1.${Date.now()}.${clickId}`);
  }
}

function initialize(pixelId: string) {
  if (!allowed()) return;
  if (!window.fbq) {
    const queue: Fbq = Object.assign((...args: unknown[]) => {
      if (queue.callMethod) queue.callMethod(...args); else queue.queue.push(args);
    }, { queue: [] as unknown[][], loaded: true, version: '2.0' });
    queue.push = queue;
    window.fbq = queue; window._fbq = queue;
    const script = document.createElement('script');
    script.id = 'carzo-meta-pixel'; script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }
  if (!initialized.has(pixelId)) {
    window.fbq('set', 'autoConfig', false, pixelId);
    window.fbq('init', pixelId);
    initialized.add(pixelId);
  }
  window.fbq('consent', 'grant');
}

export function metaPathAllowed(destination: MetaDestination, path: string): boolean {
  return destination.pagePaths.includes(path) || destination.pathPrefixes.some(prefix => path.startsWith(prefix));
}

function emit(event: MetaBrowserEvent) {
  try {
    if (!allowed() || !config?.destinations.some(destination => destination.pixelId === event.pixelId)) return;
    // Independent owners use server-only Purchase on a shared/modal checkout.
    if (event.name === 'Purchase' && config.destinations.length > 1) return;
    const key = `${event.pixelId}:${event.name}:${event.eventId}`;
    if (sent.has(key)) return;
    if (event.name === 'Purchase') {
      try { if (JSON.parse(sessionStorage.getItem('carzo:meta:receipts') ?? '[]').includes(key)) return; } catch { /* Memory guard remains. */ }
    }
    initialize(event.pixelId);
    window.fbq?.('trackSingle', event.pixelId, event.name, event.data, { eventID: event.eventId });
    sent.add(key);
    if (event.name === 'Purchase') {
      try {
        const receipts = JSON.parse(sessionStorage.getItem('carzo:meta:receipts') ?? '[]');
        sessionStorage.setItem('carzo:meta:receipts', JSON.stringify([...receipts, key].slice(-200)));
      } catch { /* Storage denial must never interfere with checkout. */ }
    }
  } catch { /* Advertising must never break the storefront. Durable CAPI is independent. */ }
}

export function sendMetaPurchases(events: MetaBrowserEvent[] = []) {
  for (const event of events) if (event.name === 'Purchase') emit(event);
}

export function trackMetaPage(path: string) {
  if (!allowed() || !config) return;
  captureMetaClick();
  for (const destination of config.destinations) if (metaPathAllowed(destination, path)) {
    emit({ pixelId: destination.pixelId, name: 'PageView', eventId: crypto.randomUUID(), data: {} });
  }
}

export function trackMetaProduct(name: Extract<MetaEventName, 'ViewContent' | 'AddToCart' | 'Lead'>, productType: string,
  data: MetaCustomData = {}, eventId?: string) {
  if (!allowed() || !config || !globalThis.crypto?.randomUUID) return;
  for (const destination of config.destinations) if (destination.productTypes.includes(productType) && metaPathAllowed(destination, location.pathname)) {
    emit({ pixelId: destination.pixelId, name, eventId: eventId ?? crypto.randomUUID(), data });
  }
}

export function trackMetaCheckout(quote: CartQuote, eventId: string) {
  if (!allowed() || !config) return;
  const discounts = allocateDiscount(quote.quantityDiscount, quote.lines.map(line => line.quantityDiscountEligible ? line.lineTotal : 0));
  const net = quote.lines.map((line, index) => line.lineTotal - discounts[index]);
  for (const destination of config.destinations) {
    if (!metaPathAllowed(destination, location.pathname)) continue;
    const lines = quote.lines.filter(line => destination.productTypes.includes(line.catalogItem?.productType ?? 'case'));
    if (!lines.length) continue;
    const contents = lines.map(line => ({ id: line.catalogItem?.sku ?? ('designSlug' in line.item ? `case:${line.item.designSlug}:${line.item.size.toLowerCase()}` : ''),
      quantity: line.quantity, item_price: line.unitPrice }));
    // The quote precedes loyalty lookup; split its quantity discount consistently with Purchase.
    const value = quote.lines.reduce((sum, line, index) => sum + (lines.includes(line) ? net[index] : 0), 0);
    emit({ pixelId: destination.pixelId, name: 'InitiateCheckout', eventId,
      data: { currency: 'UAH', value, contents, content_type: 'product', content_ids: contents.map(item => item.id), num_items: contents.reduce((sum, item) => sum + item.quantity, 0) } });
  }
}
