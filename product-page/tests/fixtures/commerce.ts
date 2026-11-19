import type { CommerceProduct, CatalogCartItem } from '../../lib/commerce/types';

// Synthetic examples only: not commercial prices, final product specifications or publishable seed.
export const cape: CommerceProduct = {
  id: '10000000-0000-4000-8000-000000000001', slug: 'synthetic-cape', name: 'Тестова накидка',
  productType: 'seat-back-cover', layoutKey: 'cover', quantityDiscountEligible: true,
  variants: [{ id: '20000000-0000-4000-8000-000000000001', label: 'Дизайн 4.0', sku: 'SYNTHETIC-CAPE-4', price: 1000, inStock: true,
    attributes: { design: '4-0' }, designId: null, mediaUrl: null, shippingProfile: { lengthCm: 40, widthCm: 25, heightCm: 3, weightKg: 0.7 } }],
  optionGroups: [{ key: 'logo', label: 'Логотип', inputType: 'choice', required: false, maxLength: 80, priceExtra: 0,
    choices: [{ key: 'audi', label: 'Audi', priceExtra: 290, crmSku: 'AUDI-ST', brandId: null }] }],
};
export const pillow: CommerceProduct = {
  id: '10000000-0000-4000-8000-000000000002', slug: 'synthetic-pillow', name: 'Тестова подушка',
  productType: 'headrest-pillow', layoutKey: 'pillow', quantityDiscountEligible: true,
  variants: [{ id: '20000000-0000-4000-8000-000000000002', label: 'Чорний', sku: 'SYNTHETIC-PILLOW-BLACK', price: 500, inStock: true,
    attributes: { color: 'black' }, designId: null, mediaUrl: null, shippingProfile: { lengthCm: 30, widthCm: 20, heightCm: 10, weightKg: 0.3 } }],
  optionGroups: [{ key: 'embroidery', label: 'Вишивка', inputType: 'text', required: true, maxLength: 24, priceExtra: 100, choices: [] }],
};
export function capeItem(): CatalogCartItem {
  return { productId: cape.id, variantId: cape.variants[0].id, options: { logo: 'audi' }, personalization: {}, quantity: 1 };
}
export function pillowItem(): CatalogCartItem {
  return { productId: pillow.id, variantId: pillow.variants[0].id, options: {}, personalization: { embroidery: 'CARZO' }, quantity: 1 };
}
export const tiers = [{ key: 'two', minQuantity: 2, amount: 200, sort: 1 }, { key: 'three', minQuantity: 3, amount: 500, sort: 2 }];
