import type { CartQuoteLine } from '@/lib/cart/types';
import { cartItemKey } from '@/lib/cart/item-identity';
import type { CatalogCartItem, CatalogItemSnapshot, CommerceProduct } from './types';

export class ProductConfigurationError extends Error {}

function amount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) throw new ProductConfigurationError('Invalid catalog amount');
  return value;
}

export function quoteCatalogItem(item: CatalogCartItem, product: CommerceProduct): CartQuoteLine {
  if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 30) throw new ProductConfigurationError('Invalid quantity');
  if (product.id !== item.productId) throw new ProductConfigurationError('Unknown product');
  const variant = product.variants.find(candidate => candidate.id === item.variantId);
  if (!variant || !variant.inStock || !variant.sku.trim()) throw new ProductConfigurationError('Variant unavailable');
  const profile = variant.shippingProfile;
  if (Object.values(profile).some(value => !Number.isFinite(value) || value <= 0)
    || Object.keys(profile).length !== 4) throw new ProductConfigurationError('Shipping profile unavailable');
  const groups = new Map(product.optionGroups.map(group => [group.key, group]));
  for (const [values, inputType] of [[item.options, 'choice'], [item.personalization, 'text']] as const) {
    for (const key of Object.keys(values)) {
      if (groups.get(key)?.inputType !== inputType) throw new ProductConfigurationError('Unknown option');
    }
  }
  const selectedOptions: CatalogItemSnapshot['selectedOptions'] = [];
  let unitPrice = amount(variant.price);
  for (const group of product.optionGroups) {
    const value = (group.inputType === 'choice' ? item.options[group.key] : item.personalization[group.key])?.trim();
    if (!value) {
      if (group.required) throw new ProductConfigurationError('Required option missing');
      continue;
    }
    if (group.inputType === 'choice') {
      const choice = group.choices.find(candidate => candidate.key === value);
      if (!choice) throw new ProductConfigurationError('Unknown option choice');
      const extra = amount(group.priceExtra) + amount(choice.priceExtra);
      selectedOptions.push({ key: group.key, label: group.label, value: choice.label, priceExtra: extra, crmSku: choice.crmSku });
      unitPrice += extra;
    } else {
      if (value.length > group.maxLength || /[\u0000-\u001f\u007f]/.test(value)) throw new ProductConfigurationError('Invalid personalization');
      const extra = amount(group.priceExtra);
      selectedOptions.push({ key: group.key, label: group.label, value, priceExtra: extra, crmSku: null });
      unitPrice += extra;
    }
  }
  amount(unitPrice);
  const catalogItem: CatalogItemSnapshot = {
    productId: product.id, variantId: variant.id, productType: product.productType,
    variantLabel: variant.label, attributes: { ...variant.attributes }, sku: variant.sku, selectedOptions, shippingProfile: { ...profile },
  };
  return {
    itemKey: cartItemKey(item), item, title: product.name, productUrl: `/products/${product.slug}`,
    // Compatibility-only fields for existing case consumers; no synthetic case size or fixation.
    designLabel: '', sizeLabel: '', brandName: '', fixationLabel: '',
    unitPrice, basePrice: variant.price, logoExtra: 0, fixationExtra: 0,
    quantity: item.quantity, lineTotal: amount(unitPrice * item.quantity), inStock: true,
    quantityDiscountEligible: product.quantityDiscountEligible, catalogItem,
  };
}
