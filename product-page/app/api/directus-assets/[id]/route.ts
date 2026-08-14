import 'server-only';

const FILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const directusUrl = process.env.DIRECTUS_URL?.replace(/\/$/, '');
  const token = process.env.DIRECTUS_READ_TOKEN?.trim();

  if (!FILE_ID_PATTERN.test(params.id)) {
    return new Response('Not found', { status: 404 });
  }
  if (!directusUrl || !token) {
    return new Response('Directus asset access is not configured', { status: 503 });
  }

  const upstream = await fetch(`${directusUrl}/assets/${encodeURIComponent(params.id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response('Not found', { status: upstream.status === 404 ? 404 : 502 });
  }

  const headers = new Headers({
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  });
  for (const name of ['content-type', 'content-length', 'etag', 'last-modified']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(upstream.body, { status: 200, headers });
}
