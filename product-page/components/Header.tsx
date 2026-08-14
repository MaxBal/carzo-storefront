'use client';

import { useState } from 'react';
import { ChevronDown, Menu, ShoppingBag, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/components/cart/cart-context';

const navigation = [
  { label: 'Головна', href: '/' },
  { label: 'Каталог', href: '/case/design/m/2-0', catalog: true },
  { label: 'B2B', href: '/#b2b' },
  { label: 'Контакти', href: '/#contacts' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { itemsQuantity, openCart } = useCart();

  return (
    <>
      <header className="relative z-50 h-14 bg-black">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-4">
          <Link href="/" className="flex items-center" aria-label="CARZO — головна">
            <Image src="/carzo-logo-tight.svg" alt="CARZO" width={88} height={16} priority />
          </Link>

          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-7 md:flex" aria-label="Основна навігація">
              {navigation.map(item => (
                <Link key={item.label} href={item.href} className="flex items-center gap-1 text-sm font-medium text-white transition-colors hover:text-gray-300">
                  {item.label}
                  {item.catalog && <ChevronDown size={14} />}
                </Link>
              ))}
            </nav>
            <button type="button" onClick={openCart} className="relative rounded-full p-2 text-white hover:bg-white/10" aria-label={`Кошик, товарів: ${itemsQuantity}`}>
              <ShoppingBag size={21} strokeWidth={1.8} />
              {itemsQuantity > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#28c5a6] px-1 text-[10px] font-bold text-black">{itemsQuantity > 99 ? '99+' : itemsQuantity}</span>}
            </button>
            <button className="p-1 text-white md:hidden" onClick={() => setMobileOpen(true)} aria-label="Відкрити меню">
              <Menu size={26} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href="/" className="flex items-center" onClick={() => setMobileOpen(false)}>
              <Image src="/carzo-logo-tight.svg" alt="CARZO" width={88} height={16} />
            </Link>
            <button className="p-1 text-white" onClick={() => setMobileOpen(false)} aria-label="Закрити меню">
              <X size={26} strokeWidth={1.8} />
            </button>
          </div>

          <nav className="flex flex-1 flex-col px-4 pt-4" aria-label="Мобільна навігація">
            {navigation.map(item => (
              <Link
                key={item.label}
                href={item.href}
                className="block border-b border-gray-800 py-4 text-xl font-medium text-white"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="px-4 pb-8 text-sm text-gray-500">Designed and manufactured in Ukraine</div>
        </div>
      )}
    </>
  );
}
