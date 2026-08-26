import type { Metadata } from 'next';
import Header from '@/components/Header';
import HomePageContent from '@/components/HomePageContent';
import { siteOrigin } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: 'CARZO — преміальні автоаксесуари',
  description: 'Преміальні автомобільні органайзери та килимки з магнітною системою та німецькою еко-шкірою.',
  openGraph: {
    title: 'CARZO — преміальні автоаксесуари',
    description: 'Преміальні автомобільні органайзери та килимки з магнітною системою та німецькою еко-шкірою.',
    url: '/',
    siteName: 'CARZO',
    locale: 'uk_UA',
    type: 'website',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'CARZO — преміальні автоаксесуари',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CARZO — преміальні автоаксесуари',
    description: 'Преміальні автомобільні органайзери та килимки з магнітною системою та німецькою еко-шкірою.',
    images: ['/og-image.svg'],
  },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <HomePageContent />
    </div>
  );
}
