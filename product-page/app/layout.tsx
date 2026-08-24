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
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const benefitModals = await getBenefitModals();

  return (
    <html lang="uk">
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
