import { getContentSource } from '@/lib/content/directus';
import { getPublishedPageSummaries } from '@/lib/pages/directus';
import { pagePath } from '@/lib/pages/metadata';
import { absoluteSiteUrl, getPrimaryProductLinks } from '@/lib/seo';

export const revalidate = 60;

function inlineMarkdown(value: string) {
  return value.replace(/[\r\n]+/g, ' ').replaceAll('[', '\\[').replaceAll(']', '\\]').trim();
}

export async function GET() {
  const [pages, source] = await Promise.all([
    getPublishedPageSummaries(),
    getContentSource(),
  ]);
  const publishedPages = pages.filter(page => !page.noIndex);
  const products = getPrimaryProductLinks(source);
  const lines = [
    '# CARZO',
    '',
    '> Український бренд преміальних автомобільних органайзерів для порядку, комфорту та довгої експлуатації.',
    '',
    'CARZO виготовляє автокейси з автомобільної еко-шкіри. На сайті можна обрати дизайн, розмір, фіксацію та логотип марки автомобіля, розрахувати актуальну вартість і оформити замовлення.',
    '',
    '## Основні сторінки',
    '',
    `- [Головна](${absoluteSiteUrl('/')}): Огляд бренду CARZO та перехід до вибору автокейсу.`,
    ...publishedPages
      .filter(page => page.slug !== 'home')
      .map(page => `- [${inlineMarkdown(page.title)}](${absoluteSiteUrl(pagePath(page.slug))}): ${inlineMarkdown(page.seoDescription || `Інформаційна сторінка ${page.title}.`)}`),
    '',
    '## Автокейси',
    '',
    ...products.map(product => `- [${inlineMarkdown(product.title)}](${absoluteSiteUrl(product.path)}): ${inlineMarkdown(product.description)}`),
    '',
    '## Додаткові ресурси',
    '',
    `- [Карта сайту](${absoluteSiteUrl('/sitemap.xml')}): Канонічні публічні сторінки CARZO.`,
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
