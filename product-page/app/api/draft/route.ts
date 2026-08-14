import 'server-only';

import { draftMode } from 'next/headers';
import { getPreviewPage } from '@/lib/pages/directus';
import { pagePath } from '@/lib/pages/metadata';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const id = searchParams.get('id');
  const expectedSecret = process.env.DIRECTUS_PREVIEW_SECRET?.trim();

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
