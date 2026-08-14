import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import CartProvider from '@/components/cart/CartProvider';
import { siteOrigin } from '@/lib/seo';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: 'CARZO — автомобільні органайзери',
    template: '%s | CARZO',
  },
  description: 'Преміальні автомобільні органайзери з магнітною системою та німецькою еко-шкірою.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body className={inter.className}><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
