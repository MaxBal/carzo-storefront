import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import CartProvider from '@/components/cart/CartProvider';
import ModalProvider from '@/components/ModalProvider';
import Footer from '@/components/Footer';
import { siteOrigin } from '@/lib/seo';
import { getBenefitModals } from '@/lib/content/global-modals';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: 'CARZO — автомобільні органайзери',
    template: '%s | CARZO',
  },
  description: 'Преміальні автомобільні органайзери з магнітною системою та німецькою еко-шкірою.',
  openGraph: {
    title: 'CARZO — преміальні органайзери для автомобіля',
    description: 'Автокейси CARZO допомагають підтримувати порядок у багажнику та доповнюють інтер\'єр автомобіля.',
    url: 'https://carzo-eight.vercel.app',
    siteName: 'CARZO',
    locale: 'uk_UA',
    type: 'website',
    images: [
      {
        url: '/case.jpg',
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
    images: ['/case.jpg'],
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'CARZO',
  url: 'https://carzo-eight.vercel.app',
  logo: 'https://carzo-eight.vercel.app/carzo-logo-tight.svg',
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+380661031094',
    contactType: 'customer service',
    availableLanguage: 'Ukrainian',
    hoursAvailable: 'Mo-Su 10:00-20:00',
  },
  sameAs: [
    'https://www.instagram.com/carzo.ua',
    'https://t.me/carzo_ua',
    'https://www.facebook.com/share/1F9iCULp4s/',
    'https://www.tiktok.com/@carzo_ua',
    'https://www.youtube.com/@carzoua9083',
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const benefitModals = await getBenefitModals();

  return (
    <html lang="uk">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className={inter.className}>
        <CartProvider>
          <ModalProvider benefitModals={benefitModals}>
            {children}
            <Footer />
          </ModalProvider>
        </CartProvider>
      </body>
    </html>
  );
}
