import { draftMode } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PageRenderer from '@/components/cms/PageRenderer';
import { getPreviewPage, getPublishedPage } from '@/lib/pages/directus';
import { buildCmsMetadata } from '@/lib/pages/metadata';

interface CmsPageProps {
  params: { slug: string[] };
  searchParams: { preview?: string };
}

function slugPath(segments: string[]) {
  return segments.map(segment => decodeURIComponent(segment)).join('/');
}

export async function generateMetadata({ params }: CmsPageProps): Promise<Metadata> {
  const page = await getPublishedPage(slugPath(params.slug));
  return page
    ? buildCmsMetadata(page, 'Сторінку не знайдено | CARZO')
    : { title: 'Сторінку не знайдено', robots: { index: false, follow: false } };
}

export default async function CmsRoute({ params, searchParams }: CmsPageProps) {
  const slug = slugPath(params.slug);
  const previewEnabled = draftMode().isEnabled && Boolean(searchParams.preview);
  const page = previewEnabled && searchParams.preview
    ? await getPreviewPage(searchParams.preview)
    : await getPublishedPage(slug);

  if (!page || page.slug !== slug) notFound();

  return <PageRenderer page={page} preview={previewEnabled} />;
}
