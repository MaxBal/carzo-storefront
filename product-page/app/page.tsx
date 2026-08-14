import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import PageRenderer from '@/components/cms/PageRenderer';
import { getPreviewPage, getPublishedPage } from '@/lib/pages/directus';
import { buildCmsMetadata } from '@/lib/pages/metadata';

interface HomeProps {
  searchParams: { preview?: string };
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage('home');
  return buildCmsMetadata(page, 'CARZO');
}

export default async function Home({ searchParams }: HomeProps) {
  const previewEnabled = draftMode().isEnabled && Boolean(searchParams.preview);
  const page = previewEnabled && searchParams.preview
    ? await getPreviewPage(searchParams.preview)
    : await getPublishedPage('home');

  if (!page || (previewEnabled && page.slug !== 'home')) {
    redirect('/case/design/m/2-0');
  }

  return <PageRenderer page={page} preview={previewEnabled} />;
}
