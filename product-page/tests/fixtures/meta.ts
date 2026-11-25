import type { OrderSnapshot } from '../../lib/data/orders/types';
import type { MetaDestination, MetaTrackingContext } from '../../lib/meta/types';
import { pillow } from './commerce';

export const metaContext: MetaTrackingContext = { consentId: '90000000-0000-4000-8000-000000000001',
  sourceUrl: 'https://carzo.test/case/design/l/4-0', userAgent: 'Synthetic browser', ip: '192.0.2.1',
  fbp: 'fb.1.1764000000000.123456', fbc: 'fb.1.1764000000000.SyntheticClick' };
export const metaDestinations: MetaDestination[] = [
  { key: 'carzo', pixelId: '111111111111111', productTypes: ['case'], pagePaths: ['/'], pathPrefixes: ['/case/'] },
  { key: 'partner', pixelId: '222222222222222', productTypes: ['headrest-pillow'], pagePaths: [], pathPrefixes: ['/pillows/'] },
];
export function metaOrder(): OrderSnapshot {
  const item = { sort: 1, itemKey: 'L:4-0:none:none', title: 'Synthetic case', designSlug: '4-0', designLabel: '4.0',
    sizeCode: 'L', sizeLabel: 'L', brandSlug: 'none', brandName: '', fixationKey: 'none', fixationLabel: '',
    unitPrice: 3000, quantity: 1, lineTotal: 3000, quantityDiscountEligible: true };
  return { checkoutAttemptId: '80000000-0000-4000-8000-000000000001', requestFingerprint: 'synthetic-meta-order',
    customerName: 'SYNTHETIC ONLY', customerPhone: '+380000000000', customerComment: 'PRIVATE COMMENT', contactMethod: 'phone', paymentOption: 'prepayment_200',
    deliveryMethod: 'BRANCH', deliveryCityRef: null, deliveryCityName: 'Synthetic city', deliveryPointRef: null,
    deliveryPointNumber: null, deliveryPointName: null, deliveryPointAddress: null, deliveryPointType: null,
    deliveryStreetRef: null, deliveryStreetName: null, deliveryStreetType: null, deliveryHouse: null, deliveryApartment: null,
    itemsQuantity: 2, subtotal: 5000, quantityDiscount: 200,
    loyalty: { loyaltyPhone: '+380000000001', eligible: false, discountPercent: 0, discountAmount: 0, phoneMismatch: false },
    total: 4800, discountTierKey: 'two', managerNote: 'PRIVATE NOTE',
    items: [item, { ...item, sort: 2, itemKey: 'synthetic-pillow', title: 'Synthetic pillow', designSlug: null, sizeCode: null,
      unitPrice: 2000, lineTotal: 2000, catalogItem: { productId: pillow.id, variantId: pillow.variants[0].id,
        productType: pillow.productType, sku: 'SYNTHETIC-PILLOW', variantLabel: 'Synthetic black',
        attributes: { color: 'black' }, selectedOptions: [{ key: 'embroidery', label: 'Вишивка', value: 'PRIVATE EMBROIDERY', priceExtra: 0, crmSku: null }],
        shippingProfile: pillow.variants[0].shippingProfile } }],
  };
}

export function metaEnv(): Record<string, string> {
  return { META_ENABLED: 'true', VERCEL_ENV: 'production', META_ALLOWED_HOSTS: 'carzo.test',
    META_DESTINATIONS: JSON.stringify(metaDestinations), META_CARZO_ACCESS_TOKEN: 'synthetic-carzo-token', META_PARTNER_ACCESS_TOKEN: 'synthetic-partner-token' };
}
