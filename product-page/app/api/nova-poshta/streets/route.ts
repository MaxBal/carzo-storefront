import {
  extractClientIp,
  findNovaPoshtaStreets,
  isNovaPoshtaRateLimited,
  isNovaPoshtaUuidRef,
} from '@/lib/nova-poshta';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (isNovaPoshtaRateLimited(extractClientIp(request))) {
    return Response.json(
      { error: 'Забагато запитів. Спробуйте за хвилину.' },
      { status: 429 },
    );
  }
  const params = new URL(request.url).searchParams;
  const cityRef = params.get('city') || '';
  const query = params.get('q') || '';
  if (!isNovaPoshtaUuidRef(cityRef)) {
    return Response.json({ error: 'Спочатку оберіть місто.' }, { status: 400 });
  }
  try {
    const streets = await findNovaPoshtaStreets(cityRef, query);
    return Response.json(streets, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (error) {
    console.error('Nova Poshta street lookup failed', error);
    return Response.json({ error: 'Не вдалося завантажити вулиці Нової пошти.' }, { status: 503 });
  }
}
