import { timingSafeEqual } from 'node:crypto';
import { getMetaPublicConfig, metaHostAllowed } from '@/lib/meta/config';
import { deliverMetaEvents } from '@/lib/meta/delivery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
  const secret = process.env.META_DELIVERY_SECRET ?? '';
  const auth = request.headers.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(auth);
  if (secret.length < 32 || received.length !== expected.length || !timingSafeEqual(received, expected)) return new Response(null, { status: 401 });
  const config = getMetaPublicConfig();
  if (!config || !metaHostAllowed(request.url, config)) return new Response(null, { status: 503 });
  try { return Response.json(await deliverMetaEvents(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: 'Delivery unavailable' }, { status: 503 }); }
}
