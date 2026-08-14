import { findNovaPoshtaPoints } from '@/lib/nova-poshta';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const cityRef = params.get('city') || '';
  const query = params.get('q') || '';
  const allowPostomat = params.get('postomat') === '1';
  if (!/^[0-9a-f-]{36}$/i.test(cityRef)) {
    return Response.json({ error: 'Спочатку оберіть місто.' }, { status: 400 });
  }
  try {
    const points = await findNovaPoshtaPoints(cityRef, query);
    return Response.json(
      allowPostomat ? points : points.filter(point => point.type !== 'postomat'),
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    );
  } catch (error) {
    console.error('Nova Poshta point lookup failed', error);
    return Response.json({ error: 'Не вдалося завантажити відділення Нової пошти.' }, { status: 503 });
  }
}
