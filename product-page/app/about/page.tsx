import type { Metadata } from 'next';
import Header from '@/components/Header';
import AboutPageContent from '@/components/AboutPageContent';
import { getAboutData } from '@/lib/content/about';

export const metadata: Metadata = {
  title: 'Про нас — Carzo',
  description: 'Carzo — український бренд автомобільних аксесуарів. Розробляємо, виготовляємо та тестуємо продукцію самостійно.',
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: 'Про нас — Carzo',
    description: 'Carzo — український бренд автомобільних аксесуарів. Розробляємо, виготовляємо та тестуємо продукцію самостійно.',
    url: '/about',
    siteName: 'CARZO',
    locale: 'uk_UA',
    type: 'website',
    images: [
      {
        url: '/case.jpg',
        width: 1200,
        height: 630,
        alt: 'Про нас — Carzo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Про нас — Carzo',
    description: 'Carzo — український бренд автомобільних аксесуарів. Розробляємо, виготовляємо та тестуємо продукцію самостійно.',
    images: ['/case.jpg'],
  },
};

export default async function AboutPage() {
  const data = await getAboutData();
  return (
    <div className="min-h-screen">
      <Header />
      <AboutPageContent data={data} />
    </div>
  );
}
