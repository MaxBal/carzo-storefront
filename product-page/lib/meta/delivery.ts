import 'server-only';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { getMetaPublicConfig, getMetaToken } from './config';
import type { MetaOutboxRow } from './types';

export async function sendMetaEvent(row: MetaOutboxRow, token: string, fetcher: typeof fetch = fetch): Promise<{ status: 'delivered' | 'retry' | 'failed'; code: string }> {
  if (!/^\d{5,20}$/.test(row.pixel_id)) return { status: 'failed', code: 'invalid_pixel' };
  try {
    const response = await fetcher(`https://graph.facebook.com/v27.0/${row.pixel_id}/events`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [row.payload] }), signal: AbortSignal.timeout(8000), cache: 'no-store', redirect: 'error',
    });
    const result = await response.json().catch(() => ({})) as { events_received?: number; error?: { code?: number; is_transient?: boolean } };
    if (response.ok && !result.error && result.events_received === 1) return { status: 'delivered', code: 'accepted' };
    const retry = response.status === 429 || response.status >= 500 || result.error?.is_transient === true
      || [1, 2, 4, 17, 32, 613].includes(result.error?.code ?? 0);
    return { status: retry ? 'retry' : 'failed', code: `http_${response.status}_meta_${result.error?.code ?? 'unknown'}` };
  } catch { return { status: 'retry', code: 'transport' }; }
}

export async function deliverMetaEvents(): Promise<{ processed: number }> {
  const config = getMetaPublicConfig();
  if (!config) return { processed: 0 };
  const client = getSupabaseAdminClient();
  const { data, error } = await client.rpc('claim_meta_events', { p_destinations: config.destinations.map(item => item.key), p_limit: 10 });
  if (error) throw new Error('Meta queue claim failed');
  const rows = (data ?? []) as MetaOutboxRow[];
  for (const row of rows) {
    const destination = config.destinations.find(item => item.key === row.destination && item.pixelId === row.pixel_id);
    const token = destination ? getMetaToken(destination.key) : null;
    const outcome = token ? await sendMetaEvent(row, token) : { status: 'failed' as const, code: 'destination_changed' };
    const { error: finishError } = await client.rpc('finish_meta_event', {
      p_id: row.id, p_lease_id: row.lease_id, p_outcome: outcome.status, p_code: outcome.code,
    });
    if (finishError) console.error('Meta queue acknowledgement failed');
  }
  return { processed: rows.length };
}
