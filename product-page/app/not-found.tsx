import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import { getSiteFlag } from '@/lib/content/site-flag';

export const metadata: Metadata = {
  title: 'Сторінку не знайдено',
  description: 'Запитаної сторінки не існує або вона більше недоступна.',
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  const siteFlag = await getSiteFlag();
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header siteFlag={siteFlag} />
      <main className="relative flex flex-1 items-center overflow-hidden bg-[#f5f7f6] px-4 py-20 sm:px-6 lg:px-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[13rem] font-black leading-none tracking-[-0.08em] text-black/[0.035] sm:text-[22rem]">
          404
        </div>
        <div className="relative mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#159e85]">Помилка 404</p>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-black sm:text-6xl">
            Сторінку не знайдено
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-gray-600 sm:text-lg">
            Можливо, адресу введено з помилкою, сторінку переміщено або вона ще не опублікована.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-full bg-black px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-gray-800">
              На головну
            </Link>
            <Link href="/case/design/m/2-0" className="inline-flex min-h-12 items-center justify-center rounded-full border border-black px-7 py-3 text-sm font-bold text-black transition-colors hover:bg-black hover:text-white">
              Обрати автокейс
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
