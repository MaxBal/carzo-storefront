import { cookieValue, META_CONSENT_ID_COOKIE, UUID } from '@/lib/meta/context';
import { getMetaPublicConfig, metaHostAllowed } from '@/lib/meta/config';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

export async function DELETE(request: Request) {
  const config = getMetaPublicConfig();
  const origin = request.headers.get('origin');
  if (!config || !origin || !metaHostAllowed(request.url, config) || !metaHostAllowed(origin, config)
    || new URL(origin).origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const consentId = cookieValue(request.headers, META_CONSENT_ID_COOKIE);
  if (consentId && UUID.test(consentId)) {
    const { error } = await getSupabaseAdminClient().rpc('cancel_meta_events', { p_consent_id: consentId });
    if (error) return new Response(null, { status: 503 });
  }
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
