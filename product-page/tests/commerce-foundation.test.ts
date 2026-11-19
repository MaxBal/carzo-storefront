import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { quoteCatalogItem } from '../lib/commerce/pricing';
import { catalogConfiguration } from '../lib/commerce/types';
import { calculateCartTotals } from '../lib/cart/pricing';
import { calculateLoyaltyDiscount } from '../lib/cart/loyalty-math';
import { createHash } from 'node:crypto';
import { computeCartItemsSignature } from '../lib/cart/checkout-attempt-client';
import { calculateOrderPackage } from '../lib/cart/shipping';
import { cartItemSchema } from '../lib/cart/validation';
import { cartItemKey } from '../lib/cart/item-identity';
import { computeRequestFingerprint } from '../lib/cart/checkout-attempt';
import { formatOrderNotificationHtml } from '../lib/cart/order-notification-message';
import { buildKeyCrmOrder } from '../lib/keycrm/order-payload';
import { cape, pillow, capeItem, pillowItem, tiers } from './fixtures/commerce';

describe('mixed-product commerce foundation', () => {
  it('quotes a size-free cape and a personalized pillow using authoritative prices', () => {
    const cover = quoteCatalogItem(capeItem(), cape), cushion = quoteCatalogItem(pillowItem(), pillow);
    assert.equal(cover.unitPrice, 1290); assert.equal(cushion.unitPrice, 600);
    assert.equal('size' in cover.item, false); assert.equal(cover.sizeLabel, '');
    assert.deepEqual(catalogConfiguration(cushion.catalogItem!), ['Чорний', 'Вишивка: CARZO']);
    assert.deepEqual(cushion.catalogItem!.attributes, { color: 'black' });
  });

  it('applies one global quantity tier across case/cape/pillow and counts identical units', () => {
    const cover = quoteCatalogItem(capeItem(), cape), cushion = quoteCatalogItem(pillowItem(), pillow);
    const caseLine = { unitPrice: 2249, quantity: 1, quantityDiscountEligible: true };
    assert.equal(calculateCartTotals([caseLine, cushion], tiers).total, 2649);
    assert.equal(calculateCartTotals([caseLine, cover, cushion], tiers).total, 3639);
    assert.equal(calculateCartTotals([{ ...cushion, quantity: 2 }], tiers).quantityDiscount, 200);
    assert.equal(calculateCartTotals([{ ...cushion, quantity: 3 }], tiers).quantityDiscount, 500);
    assert.equal(calculateCartTotals([caseLine, { ...cushion, quantityDiscountEligible: false }], tiers).quantityDiscount, 0);
    assert.deepEqual(calculateLoyaltyDiscount({ subtotal: 4139, quantityDiscount: 500, discountPercent: 5 }), { baseTotal: 3639, amount: 181, discountedTotal: 3458 });
  });

  it('does not accept prices, foreign variants, unknown options or invalid personalized text', () => {
    assert.equal(cartItemSchema.safeParse({ ...capeItem(), price: 1 }).success, false);
    assert.throws(() => quoteCatalogItem({ ...capeItem(), variantId: pillow.variants[0].id }, cape));
    assert.throws(() => quoteCatalogItem({ ...capeItem(), options: { logo: 'not-a-brand' } }, cape));
    assert.throws(() => quoteCatalogItem({ ...capeItem(), options: { embroidery: 'custom' } }, cape));
    assert.throws(() => quoteCatalogItem({ ...pillowItem(), personalization: {} }, pillow));
    assert.throws(() => quoteCatalogItem({ ...pillowItem(), personalization: { embroidery: 'X'.repeat(25) } }, pillow));
    assert.throws(() => quoteCatalogItem({ ...pillowItem(), personalization: { embroidery: 'A\nB' } }, pillow));
  });

  it('fails closed for absent SKU, price, shipping profile or stock', () => {
    for (const change of [{ sku: '' }, { price: -1 }, { price: 1.5 }, { inStock: false }, { shippingProfile: { lengthCm: 0, widthCm: 1, heightCm: 1, weightKg: 1 } }]) {
      assert.throws(() => quoteCatalogItem(capeItem(), { ...cape, variants: [{ ...cape.variants[0], ...change }] }));
    }
  });

  it('binds personalized configurations without delimiter collisions or option-order drift', () => {
    const first = { ...pillowItem(), personalization: { embroidery: 'A:B|C', extra: 'D' } };
    const reordered = { ...first, personalization: { extra: 'D', embroidery: 'A:B|C' } };
    const changed = { ...first, personalization: { embroidery: 'A', extra: 'B|C:D' } };
    assert.equal(cartItemKey(first), cartItemKey(reordered));
    assert.notEqual(cartItemKey(first), cartItemKey(changed));
    const request = { customerPhone: '+380000000000', contactMethod: 'phone', items: [first] };
    assert.equal(computeRequestFingerprint(request), computeRequestFingerprint({ ...request, items: [reordered] }));
    assert.notEqual(computeRequestFingerprint(request), computeRequestFingerprint({ ...request, items: [changed] }));
  });

  it('keeps pre-existing case attempt signatures and fingerprints byte-for-byte compatible', () => {
    const items = [{ size: 'M', designSlug: '4-0', brandId: 'none', fixation: 'none', quantity: 1 }];
    assert.equal(computeCartItemsSignature(items), 'M:4-0:none:none:1');
    const request = { customerPhone: '+380000000000', contactMethod: 'phone', deliveryMethod: 'BRANCH', cityRef: 'synthetic-city', pointRef: 'synthetic-point', paymentOption: 'full', items };
    const canonical = ['+380000000000', '', 'phone', '["BRANCH","synthetic-city","synthetic-point"]', 'full', 'M|4-0|none|none|1'].join('\n');
    assert.equal(computeRequestFingerprint(request), createHash('sha256').update(canonical).digest('hex'));
  });

  it('combines actual per-variant shipping profiles with existing case packaging', () => {
    const box = calculateOrderPackage([
      { size: 'L', quantity: 1 }, { quantity: 1, shippingProfile: cape.variants[0].shippingProfile },
      { quantity: 1, shippingProfile: pillow.variants[0].shippingProfile },
    ]);
    assert.deepEqual(box, { lengthCm: 60, widthCm: 28, heightCm: 20, weightKg: 4 });
  });

  it('keeps catalog edits from rewriting saved configurations and escapes text in Telegram', () => {
    const item = { ...pillowItem(), personalization: { embroidery: '<b>CARZO</b>' } };
    const line = quoteCatalogItem(item, pillow);
    const product = structuredClone(pillow); product.variants[0].attributes.color = 'red';
    assert.equal(line.catalogItem!.attributes.color, 'black');
    const message = formatOrderNotificationHtml({ orderNumber: 'CZ-SYNTHETIC', customerName: 'Synthetic', customerPhone: '+380000000000', contactMethod: 'phone', paymentOption: '',
      items: [{ title: line.title, quantity: 1, lineTotal: line.lineTotal, fixationLabel: '', configuration: catalogConfiguration(line.catalogItem!) }],
      itemsQuantity: 1, quantityDiscount: 0, loyaltyDiscountAmount: 0, total: 600, deliveryMethod: 'BRANCH', deliveryCity: 'Synthetic', deliveryDestination: 'Synthetic' });
    assert.ok(message.includes('&lt;b&gt;CARZO&lt;/b&gt;')); assert.ok(!message.includes('Фіксація:'));
  });

  it('exports mixed products to keyCRM without losing configuration or double charging addons', () => {
    const cover = quoteCatalogItem(capeItem(), cape), cushion = quoteCatalogItem(pillowItem(), pillow);
    const payload = buildKeyCrmOrder({ orderNumber: 'CZ-SYNTHETIC', customerName: 'Synthetic', customerPhone: '+380000000000', contactMethod: 'phone', deliveryMethod: 'BRANCH', subtotal: 4139, quantityDiscount: 500, loyaltyDiscountAmount: 0, total: 3639,
      lines: [
        { sizeCode: 'M', designSlug: '4-0', brandSlug: 'none', brandName: 'Без логотипа', fixationKey: 'none', fixationLabel: 'без фіксації', quantity: 1, unitPrice: 2249, basePrice: 2249, logoExtra: 0, fixationExtra: 0 },
        ...[cover, cushion].map(line => ({ sizeCode: '', designSlug: '', brandSlug: '', brandName: '', fixationKey: '', fixationLabel: '', quantity: line.quantity, unitPrice: line.unitPrice, basePrice: line.basePrice, logoExtra: 0, fixationExtra: 0, catalogItem: line.catalogItem, title: line.title })),
      ] }, { sourceId: 1, deliveryServiceId: 1 });
    assert.equal(payload.products.reduce((sum, line) => sum + line.price * line.quantity, 0), 4139);
    assert.equal(payload.discount_amount, 500);
    assert.equal(payload.products.find(line => line.sku === 'AUDI-ST')?.price, 290);
    assert.ok(payload.products.find(line => line.sku === 'SYNTHETIC-PILLOW-BLACK')?.comment?.includes('Вишивка: CARZO'));
  });
});
