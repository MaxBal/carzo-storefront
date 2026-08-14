'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ShoppingCart, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/components/cart/cart-context';

const navigation = [
  { label: 'Головна', href: '/' },
  { label: 'Каталог', href: '/case/design/m/2-0', catalog: true },
  { label: 'B2B', href: '/#b2b' },
  { label: 'Контакти', href: '/#contacts' },
];

function TwoLineMenuIcon() {
  return (
    <svg width="20" height="9" viewBox="0 0 20 9" fill="none" aria-hidden="true">
      <rect width="20" height="2" rx="2" fill="currentColor" />
      <rect y="7" width="20" height="2" rx="2" fill="currentColor" />
    </svg>
  );
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { itemsQuantity, openCart } = useCart();

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [mobileOpen]);

  return (
    <>
      <header className="relative z-50 h-14 bg-black">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-4">
          <div className="flex items-center gap-[7px] md:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="-ml-2.5 flex h-11 w-11 items-center justify-center text-white"
              aria-label="Відкрити меню"
              aria-expanded={mobileOpen}
            >
              <TwoLineMenuIcon />
            </button>
            <Link href="/" className="flex items-center" aria-label="CARZO — головна">
              <Image src="/carzo-logo-tight.svg" alt="CARZO" width={88} height={16} priority />
            </Link>
          </div>

          <Link href="/" className="hidden items-center md:flex" aria-label="CARZO — головна">
            <Image src="/carzo-logo-tight.svg" alt="CARZO" width={88} height={16} priority />
          </Link>

          <nav className="hidden items-center gap-[46px] md:flex" aria-label="Основна навігація">
            {navigation.map(item => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-2 text-[15px] font-normal leading-5 tracking-[-0.01em] text-[#f2f2f2] transition-colors hover:text-[#28c5a6] focus-visible:text-[#28c5a6]"
              >
                {item.label}
                {item.catalog ? <ChevronDown size={15} strokeWidth={1.8} /> : null}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            onClick={openCart}
            className="relative flex h-11 w-11 items-center justify-center text-white transition-colors hover:text-[#28c5a6] focus-visible:text-[#28c5a6]"
            aria-label={`Кошик, товарів: ${itemsQuantity}`}
          >
            <ShoppingCart size={23} strokeWidth={1.6} />
            {itemsQuantity > 0 ? (
              <span className="absolute right-0.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#28c5a6] px-1 text-[10px] font-semibold leading-none text-white">
                {itemsQuantity > 99 ? '99+' : itemsQuantity}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Мобільне меню"
        >
          <div className="flex h-14 items-center justify-between px-5">
            <Link href="/" className="flex items-center" onClick={() => setMobileOpen(false)} aria-label="CARZO — головна">
              <Image src="/carzo-logo-tight.svg" alt="CARZO" width={88} height={16} />
            </Link>
            <button
              type="button"
              className="-mr-2.5 flex h-11 w-11 items-center justify-center text-white"
              onClick={() => setMobileOpen(false)}
              aria-label="Закрити меню"
            >
              <X size={26} strokeWidth={1.8} />
            </button>
          </div>

          <nav className="flex flex-1 flex-col px-5 pt-9" aria-label="Мобільна навігація">
            {navigation.map((item, index) => (
              <Link
                key={item.label}
                href={item.href}
                className={`text-lg font-normal leading-6 text-white transition-colors hover:text-[#28c5a6] ${index === 0 ? '' : 'mt-[21px]'}`}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <p className="px-5 pb-[max(12px,env(safe-area-inset-bottom))] text-center text-[13px] leading-[18px] text-white">
            🇺🇦 Сконструйовано та виготовлено в Україні
          </p>
        </div>
      ) : null}
    </>
  );
}
