import 'server-only';

import { draftMode } from 'next/headers';
import { getPreviewPage } from '@/lib/data/pages';
import { getPreviewSecret } from '@/lib/data/config';
import { pagePath } from '@/lib/pages/metadata';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const id = searchParams.get('id');
  const expectedSecret = getPreviewSecret();

  if (!expectedSecret || secret !== expectedSecret || !id) {
    return new Response('Invalid preview request', { status: 401 });
  }

  const page = await getPreviewPage(id);
  if (!page) return new Response('Page not found', { status: 404 });

  draftMode().enable();
  const target = new URL(pagePath(page.slug), request.url);
  target.searchParams.set('preview', page.id);
  return Response.redirect(target, 307);
}
