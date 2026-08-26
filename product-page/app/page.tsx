import type { Metadata } from 'next';
import Header from '@/components/Header';
import { siteOrigin } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: 'CARZO — автомобільні органайзери',
  description: 'Преміальні автомобільні органайзери з магнітною системою та німецькою еко-шкірою.',
  openGraph: {
    title: 'CARZO — преміальні органайзери для автомобіля',
    description: 'Автокейси CARZO допомагають підтримувати порядок у багажнику та доповнюють інтер\'єр автомобіля.',
    url: '/',
    siteName: 'CARZO',
    locale: 'uk_UA',
    type: 'website',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'CARZO — автомобільні органайзери',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CARZO — преміальні органайзери для автомобіля',
    description: 'Автокейси CARZO допомагають підтримувати порядок у багажнику та доповнюють інтер\'єр автомобіля.',
    images: ['/og-image.svg'],
  },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main />
    </div>
  );
}
