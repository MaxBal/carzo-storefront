import { findNovaPoshtaPoints } from '@/lib/nova-poshta';
import type { DeliveryMethod } from '@/lib/cart/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const cityRef = params.get('city') || '';
  const query = params.get('q') || '';
  const method = params.get('method');
  if (!/^[0-9a-f-]{36}$/i.test(cityRef)) {
    return Response.json({ error: 'Спочатку оберіть місто.' }, { status: 400 });
  }
  if (method !== 'BRANCH' && method !== 'POSTOMAT') {
    return Response.json({ error: 'Оберіть спосіб доставки.' }, { status: 400 });
  }
  try {
    const points = await findNovaPoshtaPoints(cityRef, method as Exclude<DeliveryMethod, 'COURIER'>, query);
    return Response.json(points, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (error) {
    console.error('Nova Poshta point lookup failed', error);
    const label = method === 'POSTOMAT' ? 'поштомати' : 'відділення';
    return Response.json({ error: `Не вдалося завантажити ${label} Нової пошти.` }, { status: 503 });
  }
}
