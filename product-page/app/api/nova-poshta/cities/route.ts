import { findNovaPoshtaCities } from '@/lib/nova-poshta';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q') || '';
  try {
    const cities = await findNovaPoshtaCities(query);
    return Response.json(cities, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (error) {
    console.error('Nova Poshta city lookup failed', error);
    return Response.json({ error: 'Не вдалося завантажити міста Нової пошти.' }, { status: 503 });
  }
}
