import assert from 'node:assert/strict';
import { it } from 'node:test';
import { configureMetaBrowser, sendMetaPurchases, trackMetaCheckout, trackMetaProduct } from '../lib/meta/browser';
import { metaDestinations } from './fixtures/meta';
import type { CartQuote } from '../lib/cart/types';

it('browser routing is consented, deduplicates receipts and allocates a mixed quote without exposing another owner', () => {
  const names = ['window', 'document', 'location', 'navigator', 'sessionStorage'] as const;
  const previous = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  const calls: unknown[][] = [];
  const storage = new Map<string, string>();
  const globals = {
    window: { fbq: (...args: unknown[]) => calls.push(args) },
    document: { cookie: 'carzo_marketing_v1=granted' },
    location: { protocol: 'https:', hostname: 'carzo.test', pathname: '/case/design/l/4-0' },
    navigator: { doNotTrack: '0' },
    sessionStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
  };
  for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, value: globals[name] });
  try {
    configureMetaBrowser({ allowedHosts: ['carzo.test'], destinations: [metaDestinations[0]] });
    const receipt = { pixelId: metaDestinations[0].pixelId, name: 'Purchase' as const, eventId: 'purchase:synthetic:carzo', data: { value: 2880, currency: 'UAH' as const } };
    sendMetaPurchases([receipt]); sendMetaPurchases([receipt]);
    assert.equal(calls.filter(call => call[2] === 'Purchase').length, 1);
    assert.equal(calls[0][1], 'autoConfig');
    globals.document.cookie = 'carzo_marketing_v1=denied';
    trackMetaProduct('AddToCart', 'case', { value: 100 });
    assert.equal(calls.filter(call => call[2] === 'AddToCart').length, 0);
    globals.document.cookie = 'carzo_marketing_v1=granted';
    configureMetaBrowser({ allowedHosts: ['carzo.test'], destinations: [metaDestinations[0], { ...metaDestinations[1], pagePaths: ['/case/design/l/4-0'] }] });
    sendMetaPurchases([{ ...receipt, eventId: 'purchase:another:carzo' }]);
    assert.equal(calls.filter(call => call[2] === 'Purchase').length, 1, 'shared checkout uses server-only Purchase with independent owners');
    const quote = { lines: [
      { item: { designSlug: '4-0', size: 'L' }, quantity: 1, unitPrice: 3000, lineTotal: 3000, quantityDiscountEligible: true },
      { catalogItem: { sku: 'SYNTHETIC-PILLOW', productType: 'headrest-pillow' }, quantity: 1, unitPrice: 2000, lineTotal: 2000, quantityDiscountEligible: true },
    ], subtotal: 5000, quantityDiscount: 200, total: 4800 } as CartQuote;
    trackMetaCheckout(quote, 'synthetic-checkout');
    const checkouts = calls.filter(call => call[2] === 'InitiateCheckout');
    assert.deepEqual(checkouts.map(call => (call[3] as { value: number }).value), [2880, 1920]);
    assert.equal(JSON.stringify(checkouts[0]).includes('PILLOW'), false);
    assert.equal(JSON.stringify(checkouts[1]).includes('case:4-0'), false);
    globals.location.hostname = 'technical.vercel.app';
    trackMetaProduct('AddToCart', 'case');
    assert.equal(calls.filter(call => call[2] === 'AddToCart').length, 0);
  } finally {
    configureMetaBrowser(null);
    names.forEach((name, index) => { const descriptor = previous[index]; if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); });
  }
});
