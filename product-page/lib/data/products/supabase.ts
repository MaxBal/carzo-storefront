import 'server-only';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import type { CommerceProduct, CommerceVariant, ProductOptionGroup } from '@/lib/commerce/types';

type Row = Record<string, unknown>;
const text = (value: unknown) => typeof value === 'string' ? value : '';
const numeric = (value: unknown) => typeof value === 'number' ? value : NaN;

export class ProductsUnavailableError extends Error {}

/** Commerce reads never use stale/default prices. Only published parents and children are returned. */
export async function loadCommerceProducts(productIds: string[]): Promise<CommerceProduct[]> {
  const ids = Array.from(new Set(productIds));
  if (ids.length === 0) return [];
  const client = getSupabaseAdminClient();
  const [products, variants, groups] = await Promise.all([
    client.from('products').select('id,slug,name,product_type,layout_key,quantity_discount_eligible').in('id', ids).eq('status', 'published'),
    client.from('product_variants').select('id,product_id,label,sku,price,in_stock,attributes,design_id,media_url,shipping_length_cm,shipping_width_cm,shipping_height_cm,shipping_weight_kg').in('product_id', ids).eq('status', 'published'),
    client.from('product_option_groups').select('id,product_id,key,label,input_type,required,max_length,price_extra,sort').in('product_id', ids).eq('status', 'published').order('sort'),
  ]);
  if (products.error || variants.error || groups.error) throw new ProductsUnavailableError('Product catalog unavailable');
  const groupRows = (groups.data ?? []) as Row[];
  const groupIds = groupRows.map(row => text(row.id));
  const choices = groupIds.length ? await client.from('product_option_choices')
    .select('group_id,key,label,price_extra,crm_sku,brand_id,sort').in('group_id', groupIds).eq('status', 'published').order('sort') : { data: [], error: null };
  if (choices.error) throw new ProductsUnavailableError('Product options unavailable');
  return ((products.data ?? []) as Row[]).map(product => ({
    id: text(product.id), slug: text(product.slug), name: text(product.name),
    productType: text(product.product_type), layoutKey: text(product.layout_key),
    quantityDiscountEligible: product.quantity_discount_eligible === true,
    variants: ((variants.data ?? []) as Row[]).filter(row => row.product_id === product.id).map((row): CommerceVariant => ({
      id: text(row.id), label: text(row.label), sku: text(row.sku), price: numeric(row.price), inStock: row.in_stock === true,
      attributes: row.attributes && typeof row.attributes === 'object' && !Array.isArray(row.attributes) ? row.attributes as Record<string, string> : {},
      designId: text(row.design_id) || null, mediaUrl: text(row.media_url) || null,
      shippingProfile: { lengthCm: numeric(row.shipping_length_cm), widthCm: numeric(row.shipping_width_cm), heightCm: numeric(row.shipping_height_cm), weightKg: numeric(row.shipping_weight_kg) },
    })),
    optionGroups: groupRows.filter(row => row.product_id === product.id).map((row): ProductOptionGroup => ({
      key: text(row.key), label: text(row.label), inputType: row.input_type === 'text' ? 'text' : 'choice',
      required: row.required === true, maxLength: numeric(row.max_length), priceExtra: numeric(row.price_extra),
      choices: ((choices.data ?? []) as Row[]).filter(choice => choice.group_id === row.id).map(choice => ({
        key: text(choice.key), label: text(choice.label), priceExtra: numeric(choice.price_extra), crmSku: text(choice.crm_sku) || null, brandId: text(choice.brand_id) || null,
      })),
    })),
  }));
}
