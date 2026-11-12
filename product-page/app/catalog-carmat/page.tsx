import type { Metadata } from 'next';
import Header from '@/components/Header';
import CarmatPageContent from './CarmatPageContent';
import { getCarMatDesigns, getCarMatPromoMedia } from '@/lib/content/car-mat-designs';
import { getSiteFlag } from '@/lib/content/site-flag';
import { absoluteSiteUrl } from '@/lib/seo';

const PAGE_TITLE = 'Автокилимки CARZO — преміальні автокилимки на замовлення';
const PAGE_DESCRIPTION = 'Автокилимки CARZO з німецької еко-шкіри. Індивідуальне виготовлення під модель вашого автомобіля. Якісні матеріали, точність лекал та увага до деталей.';
const PAGE_URL = absoluteSiteUrl('/catalog-carmat');
const OG_IMAGE_URL = absoluteSiteUrl('/og-carmat.jpg');

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: '/catalog-carmat',
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    siteName: 'CARZO',
    locale: 'uk_UA',
    type: 'website',
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: PAGE_TITLE,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
};

export default async function CarmatPage() {
  const [designs, siteFlag, promoMedia] = await Promise.all([
    getCarMatDesigns(),
    getSiteFlag(),
    getCarMatPromoMedia(),
  ]);

  return (
    <>
      <Header siteFlag={siteFlag} />
      <CarmatPageContent
        designs={designs}
        promoVideoUrl={promoMedia.videoUrl}
        promoCoverUrl={promoMedia.coverUrl}
      />
    </>
  );
}
