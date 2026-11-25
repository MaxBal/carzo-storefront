import 'server-only';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import type { MetaBrowserEvent } from './types';

export async function loadMetaBrowserPurchases(orderId: string): Promise<MetaBrowserEvent[]> {
  try {
    const { data, error } = await getSupabaseAdminClient().from('meta_event_outbox')
      .select('pixel_id,event_id,custom_data').eq('order_id', orderId).neq('status', 'cancelled');
    if (error) { console.error('Meta purchase receipt unavailable'); return []; }
    return (data ?? []).map(row => ({ pixelId: row.pixel_id, eventId: row.event_id, name: 'Purchase', data: row.custom_data }));
  } catch { console.error('Meta purchase receipt unavailable'); return []; }
}
