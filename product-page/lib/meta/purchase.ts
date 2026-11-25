import 'server-only';
import { createHash } from 'node:crypto';
import type { OrderSnapshot } from '@/lib/data/orders/types';
import type { MetaDestination, MetaEventDraft, MetaTrackingContext } from './types';
import { allocateDiscount } from './allocation';
export { allocateDiscount } from './allocation';

export function buildMetaPurchaseDrafts(order: OrderSnapshot, context: MetaTrackingContext, destinations: MetaDestination[]): MetaEventDraft[] {
  const lines = order.items;
  if (lines.reduce((sum, line) => sum + line.lineTotal, 0) !== order.subtotal) throw new Error('Invalid Meta order subtotal');
  const quantityDiscount = allocateDiscount(order.quantityDiscount, lines.map(line => line.quantityDiscountEligible ? line.lineTotal : 0));
  const afterQuantity = lines.map((line, index) => line.lineTotal - quantityDiscount[index]);
  const loyaltyDiscount = allocateDiscount(order.loyalty.discountAmount, afterQuantity);
  const net = afterQuantity.map((amount, index) => amount - loyaltyDiscount[index]);
  if (net.reduce((sum, amount) => sum + amount, 0) !== order.total) throw new Error('Invalid Meta order total');
  const phone = order.customerPhone.replace(/\D/g, '');
  const userData: MetaEventDraft['user_data'] = {
    client_user_agent: context.userAgent,
    ...(/^380\d{9}$/.test(phone) ? { ph: [createHash('sha256').update(phone).digest('hex')] } : {}),
    ...(context.ip ? { client_ip_address: context.ip } : {}),
    ...(context.fbp ? { fbp: context.fbp } : {}), ...(context.fbc ? { fbc: context.fbc } : {}),
  };
  return destinations.flatMap(destination => {
    const indices = lines.flatMap((line, index) => destination.productTypes.includes(line.catalogItem?.productType ?? 'case') ? [index] : []);
    if (!indices.length) return [];
    const contents = indices.map(index => {
      const line = lines[index];
      return { id: line.catalogItem?.sku ?? `case:${line.designSlug}:${line.sizeCode?.toLowerCase()}`, quantity: line.quantity, item_price: line.unitPrice };
    });
    return [{
      destination: destination.key, pixel_id: destination.pixelId, event_source_url: context.sourceUrl, user_data: userData,
      custom_data: { currency: 'UAH', value: indices.reduce((sum, index) => sum + net[index], 0), content_type: 'product',
        content_ids: contents.map(item => item.id), contents, num_items: contents.reduce((sum, item) => sum + item.quantity, 0) },
    }];
  });
}
