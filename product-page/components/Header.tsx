'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Phone, ShoppingCart, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/components/cart/cart-context';
import SimpleModal, { BlogModalContent, B2BModalContent } from './SimpleModal';

interface NavItem {
  label: string;
  href: string;
  children?: Array<{ label: string; href: string; isModal?: boolean }>;
  isModal?: boolean;
}

const navigation: NavItem[] = [
  { label: 'Головна', href: '/' },
  {
    label: 'Каталог',
    href: '/case/design/m/2-0',
    children: [
      { label: 'Автокейси', href: '/case/design/m/2-0' },
      { label: 'Автокилимки', href: '#' },
    ],
  },
  {
    label: 'B2B',
    href: '/#b2b',
    children: [
      { label: 'Корпоративні замовлення', href: '/#b2b', isModal: true },
      { label: 'Гурт для партнерів', href: '/#b2b', isModal: true },
    ],
  },
  { label: 'Про нас', href: '/about' },
  { label: 'Blog', href: '/blog', isModal: true },
];

function TwoLineMenuIcon() {
  return (
    <svg width="20" height="9" viewBox="0 0 20 9" fill="none" aria-hidden="true">
      <rect width="20" height="2" rx="2" fill="currentColor" />
      <rect y="7" width="20" height="2" rx="2" fill="currentColor" />
    </svg>
  );
}

function DesktopDropdown({ item, onModalClick }: { item: NavItem; onModalClick?: (label: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-[15px] font-normal leading-5 tracking-[-0.01em] text-[#f2f2f2] transition-colors hover:text-[#5ce4ab] focus-visible:text-[#5ce4ab]"
        aria-expanded={open}
      >
        {item.label}
        <ChevronDown size={15} strokeWidth={1.8} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && item.children && (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[180px] rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg">
          {item.children.map(child => (
            child.isModal ? (
              <button
                key={child.label}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onModalClick?.(child.label);
                }}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-[#5ce4ab]"
              >
                {child.label}
              </button>
            ) : (
              <Link
                key={child.label}
                href={child.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-[#5ce4ab]"
              >
                {child.label}
              </Link>
            )
          ))}
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileAccordion, setMobileAccordion] = useState<Record<string, boolean>>({ Каталог: true });
  const [openBlogModal, setOpenBlogModal] = useState(false);
  const [openB2BModal, setOpenB2BModal] = useState(false);
  const { itemsQuantity, openCart } = useCart();

  useEffect(() => {
    if (!mobileOpen) return;

    setMobileAccordion({ Каталог: true });
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

  const toggleAccordion = (label: string) => {
    setMobileAccordion(prev => ({ ...prev, [label]: !prev[label] }));
  };

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

          <nav className="hidden items-center gap-[36px] md:flex" aria-label="Основна навігація">
            {navigation.map(item =>
              item.children ? (
                <DesktopDropdown
                  key={item.label}
                  item={item}
                  onModalClick={item.label === 'B2B' ? () => setOpenB2BModal(true) : undefined}
                />
              ) : item.isModal ? (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setOpenBlogModal(true)}
                  className="text-[15px] font-normal leading-5 tracking-[-0.01em] text-[#f2f2f2] transition-colors hover:text-[#5ce4ab] focus-visible:text-[#5ce4ab]"
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-[15px] font-normal leading-5 tracking-[-0.01em] text-[#f2f2f2] transition-colors hover:text-[#5ce4ab] focus-visible:text-[#5ce4ab]"
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <button
            type="button"
            onClick={openCart}
            className="relative flex h-11 w-11 items-center justify-center text-white transition-colors hover:text-[#5ce4ab] focus-visible:text-[#5ce4ab]"
            aria-label={`Кошик, товарів: ${itemsQuantity}`}
          >
            <ShoppingCart size={23} strokeWidth={1.6} />
            {itemsQuantity > 0 ? (
              <span className="absolute right-0.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#5ce4ab] px-1 text-[10px] font-semibold leading-none text-white">
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
          <div className="flex h-14 shrink-0 items-center justify-between px-5">
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

          <nav className="flex flex-1 flex-col overflow-y-auto px-5 pt-6" aria-label="Мобільна навігація">
            {navigation.map((item, index) => {
              const isAccordionOpen = Boolean(mobileAccordion[item.label]);
              if (item.children) {
                return (
                  <div key={item.label} className={index === 0 ? '' : 'mt-[21px]'}>
                    <button
                      type="button"
                      onClick={() => toggleAccordion(item.label)}
                      className={`flex w-full items-center justify-between text-lg leading-6 transition-colors ${isAccordionOpen ? 'text-[#5ce4ab]' : 'text-white hover:text-[#5ce4ab]'}`}
                      aria-expanded={isAccordionOpen}
                    >
                      {item.label}
                      {isAccordionOpen
                        ? <ChevronUp size={18} strokeWidth={1.8} className="text-[#5ce4ab]" />
                        : <ChevronDown size={18} strokeWidth={1.8} />}
                    </button>
                    <div
                      className="overflow-hidden transition-[max-height] duration-200 ease-in-out"
                      style={{ maxHeight: isAccordionOpen ? '200px' : '0' }}
                    >
                      {item.children.map(child => (
                        child.isModal ? (
                          <button
                            key={child.label}
                            type="button"
                            onClick={() => {
                              setMobileOpen(false);
                              setOpenB2BModal(true);
                            }}
                            className="mt-3 block w-full pl-6 text-left text-base font-normal leading-5 text-gray-400 transition-colors hover:text-[#5ce4ab]"
                          >
                            {child.label}
                          </button>
                        ) : (
                          <Link
                            key={child.label}
                            href={child.href}
                            onClick={() => setMobileOpen(false)}
                            className="mt-3 block pl-6 text-base font-normal leading-5 text-gray-400 transition-colors hover:text-[#5ce4ab]"
                          >
                            {child.label}
                          </Link>
                        )
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                item.isModal ? (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      setOpenBlogModal(true);
                    }}
                    className={`text-lg font-normal leading-6 text-white transition-colors hover:text-[#5ce4ab] ${index === 0 ? '' : 'mt-[21px]'}`}
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`text-lg font-normal leading-6 text-white transition-colors hover:text-[#5ce4ab] ${index === 0 ? '' : 'mt-[21px]'}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                )
              );
            })}
          </nav>

          <div className="shrink-0 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
            <a
              href="tel:+380661031094"
              className="flex w-full items-center justify-center gap-2.5 rounded-[14px] border border-white/75 bg-transparent px-4 text-base font-semibold leading-6 text-white transition-colors hover:border-white hover:text-[#5ce4ab]"
              style={{ minHeight: 56 }}
            >
              <Phone size={18} strokeWidth={1.8} />
              Зателефонувати з 10:00 до 20:00
            </a>
            <p className="mt-5 text-center text-[13px] leading-[18px] text-white">
              🇺🇦 Сконструйовано та виготовлено в Україні
            </p>
          </div>
        </div>
      ) : null}

      {openBlogModal && (
        <SimpleModal title="Розділ сайту в розробці" onClose={() => setOpenBlogModal(false)}>
          <BlogModalContent />
          <button
            type="button"
            onClick={() => setOpenBlogModal(false)}
            className="flex h-[48px] w-full items-center justify-center rounded-[12px] bg-black text-[15px] font-semibold text-white transition-colors hover:bg-gray-800"
          >
            Зрозуміло
          </button>
        </SimpleModal>
      )}

      {openB2BModal && (
        <SimpleModal title="Зазначений розділ у розробці" onClose={() => setOpenB2BModal(false)}>
          <B2BModalContent onClose={() => setOpenB2BModal(false)} />
        </SimpleModal>
      )}
    </>
  );
}
