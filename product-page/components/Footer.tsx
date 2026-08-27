'use client';

import { useState } from 'react';
import { ChevronDown, Phone } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useModalContext } from './ModalProvider';
import { CARZO_LINKS } from '@/lib/links';

const catalogLinks = [
  { label: 'Автокейси', href: '/case/design/m/2-0' },
  { label: 'Автокилимки', href: '/catalog-carmat' },
];

const customerLinks = [
  { label: 'Про нас', href: '/about', action: 'link' as const },
  { label: 'Доставка', href: '/delivery', action: 'delivery' as const },
  { label: 'Оплата', href: '/payment', action: 'payment' as const },
  { label: 'Обмін та повернення', href: '/returns', action: 'returns' as const },
];

const b2bLinks = [
  { label: 'Корпоративні замовлення', href: '/corporate-orders', action: 'b2b' as const },
  { label: 'Гурт для партнерів', href: '/wholesale', action: 'b2b' as const },
];

const bonusLinks = [
  { label: 'Клієнтська програма', href: '/loyalty-program', action: 'loyalty' as const },
  { label: 'Разом дешевше', href: '/bundle-deals', action: 'bundle' as const },
];

const legalLinks = [
  { label: 'Політика конфіденційності', href: '/privacy-policy' },
  { label: 'Публічна оферта', href: '/public-offer' },
];

interface FooterProps {
  siteFlag?: string;
}

export default function Footer({ siteFlag = '/flag-ua.svg' }: FooterProps) {
  const pathname = usePathname();
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const modalCtx = useModalContext();

  if (pathname === '/catalog-carmat') return null;

  const toggleAccordion = (label: string) => {
    setOpenAccordion(prev => prev === label ? null : label);
  };

  const handleAction = (action: string) => {
    if (!modalCtx) return;
    switch (action) {
      case 'delivery': modalCtx.openBenefitModal('delivery'); break;
      case 'payment': modalCtx.openBenefitModal('payment'); break;
      case 'returns': modalCtx.openBenefitModal('returns'); break;
      case 'loyalty': modalCtx.openBenefitModal('loyalty'); break;
      case 'bundle': modalCtx.openBenefitModal('bundle'); break;
      case 'b2b': modalCtx.openB2BModal(); break;
    }
  };

  return (
    <footer className="bg-black text-white">
      {/* Desktop Footer */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-[1280px] px-4 py-12 lg:px-8">
          <div className="grid grid-cols-5 gap-8">
            {/* Column 1: Каталог */}
            <div>
              <h3 className="mb-4 text-[16px] font-medium text-white">Каталог</h3>
              <ul className="space-y-3">
                {catalogLinks.map(link => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-[16px] font-normal text-[#A2A2A2] transition-colors hover:text-[#5ce4ab]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 2: Покупцеві */}
            <div>
              <h3 className="mb-4 text-[16px] font-medium text-white">Покупцеві</h3>
              <ul className="space-y-3">
                {customerLinks.map(link => (
                  <li key={link.label}>
                    {link.action === 'link' ? (
                      <Link href={link.href!} className="text-[16px] font-normal text-[#A2A2A2] transition-colors hover:text-[#5ce4ab]">
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        onClick={(e) => { e.preventDefault(); handleAction(link.action); }}
                        className="text-[16px] font-normal text-[#A2A2A2] transition-colors hover:text-[#5ce4ab]"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: B2B */}
            <div>
              <h3 className="mb-4 text-[16px] font-medium text-white">B2B</h3>
              <ul className="space-y-3">
                {b2bLinks.map(link => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={(e) => { e.preventDefault(); handleAction(link.action); }}
                      className="text-[16px] font-normal text-[#A2A2A2] transition-colors hover:text-[#5ce4ab]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4: Carzo bonus */}
            <div>
              <h3 className="mb-4 text-[16px] font-medium text-white">Carzo Bonus</h3>
              <ul className="space-y-3">
                {bonusLinks.map(link => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={(e) => { e.preventDefault(); handleAction(link.action); }}
                      className="text-[16px] font-normal text-[#A2A2A2] transition-colors hover:text-[#5ce4ab]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 5: Контакти */}
            <div>
              <h3 className="mb-4 text-[16px] font-medium text-white">Зателефонувати</h3>
              <a href={CARZO_LINKS.phone} className="text-[16px] font-medium text-white transition-colors hover:text-[#5ce4ab]">
                +380 66 103 10 94
              </a>
              <p className="mt-1 text-[16px] text-[#A2A2A2]">з 10:00 до 20:00</p>
              
              <h3 className="mb-3 mt-6 text-[16px] font-medium text-white">Приєднатися</h3>
              <div className="flex gap-3">
                <a href={CARZO_LINKS.social.instagram} target="_blank" rel="noopener noreferrer" className="text-white transition-colors hover:text-[#5ce4ab]" aria-label="Instagram">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
                <a href={CARZO_LINKS.social.facebook} target="_blank" rel="noopener noreferrer" className="text-white transition-colors hover:text-[#5ce4ab]" aria-label="Facebook">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href={CARZO_LINKS.social.tiktok} target="_blank" rel="noopener noreferrer" className="text-white transition-colors hover:text-[#5ce4ab]" aria-label="TikTok">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                </a>
                <a href={CARZO_LINKS.social.youtube} target="_blank" rel="noopener noreferrer" className="text-white transition-colors hover:text-[#5ce4ab]" aria-label="YouTube">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
              </div>

              <ul className="mt-6 space-y-3">
                {legalLinks.map(link => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-[16px] font-medium text-[#A2A2A2] transition-colors hover:text-[#5ce4ab]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Footer */}
      <div className="md:hidden">
        <div className="px-4 py-8">
          <p className="text-center text-[14px] text-white">
            <img src={siteFlag} alt="" width="16" height="12" className="inline-block align-middle mr-1" aria-hidden="true" />
            Сконструйовано та виготовлено в Україні
          </p>
          <a
            href={CARZO_LINKS.phone}
            className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-[14px] border border-white/75 bg-transparent px-4 text-[16px] font-semibold leading-6 text-white transition-colors hover:border-white hover:text-[#5ce4ab]"
            style={{ minHeight: 56 }}
          >
            <Phone size={18} strokeWidth={1.8} />
            Зателефонувати з 10:00 до 20:00
          </a>

          {/* Accordion sections */}
          <div className="mt-8 space-y-0">
            {[
              { label: 'Каталог', links: catalogLinks.map(l => ({ label: l.label, type: 'link' as const, href: l.href, action: '' })) },
              { label: 'Покупцеві', links: customerLinks.map(l => ({ label: l.label, type: l.action === 'link' ? 'link' as const : 'action' as const, href: l.href, action: l.action })) },
              { label: 'B2B', links: b2bLinks.map(l => ({ label: l.label, type: 'action' as const, href: l.href, action: l.action })) },
              { label: 'Carzo bonus', links: bonusLinks.map(l => ({ label: l.label, type: 'action' as const, href: l.href, action: l.action })) },
            ].map(section => (
              <div key={section.label} className="border-t border-white/10">
                <button
                  type="button"
                  onClick={() => toggleAccordion(section.label)}
                  className="flex w-full items-center justify-between py-4 text-[18px] font-normal text-white"
                >
                  {section.label}
                  <ChevronDown size={18} className={`transition-transform ${openAccordion === section.label ? 'rotate-180' : ''}`} />
                </button>
                {openAccordion === section.label && (
                  <ul className="space-y-3 pb-4 pl-4">
                    {section.links.map(link => (
                      <li key={link.label}>
                        {link.type === 'link' && link.href ? (
                <Link href={link.href} className="text-[16px] font-normal text-[#A2A2A2] transition-colors hover:text-[#5ce4ab]">
                            {link.label}
                          </Link>
                        ) : (
                          <a
                            href={link.href || '#'}
                            onClick={(e) => { e.preventDefault(); handleAction(link.action); }}
                            className="text-[16px] font-normal text-[#A2A2A2] transition-colors hover:text-[#5ce4ab]"
                          >
                            {link.label}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {/* Legal links */}
          <div className="mt-6 space-y-3">
            {legalLinks.map(link => (
              <Link key={link.label} href={link.href} className="block text-[14px] font-normal text-[#A2A2A2] transition-colors hover:text-[#5ce4ab]">
                {link.label}
              </Link>
            ))}
          </div>

          {/* Social */}
          <div className="mt-6 flex justify-center gap-4">
            <a href={CARZO_LINKS.social.instagram} target="_blank" rel="noopener noreferrer" className="text-white transition-colors hover:text-[#5ce4ab]" aria-label="Instagram">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </a>
            <a href={CARZO_LINKS.social.facebook} target="_blank" rel="noopener noreferrer" className="text-white transition-colors hover:text-[#5ce4ab]" aria-label="Facebook">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a href={CARZO_LINKS.social.tiktok} target="_blank" rel="noopener noreferrer" className="text-white transition-colors hover:text-[#5ce4ab]" aria-label="TikTok">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
            </a>
            <a href={CARZO_LINKS.social.youtube} target="_blank" rel="noopener noreferrer" className="text-white transition-colors hover:text-[#5ce4ab]" aria-label="YouTube">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </a>
          </div>

          {/* Copyright */}
          <p className="mt-6 text-center text-[12px] text-[#A2A2A2]">
            © 2026 Carzo всі права захищені
          </p>
        </div>
      </div>

      {/* Desktop copyright */}
      <div className="hidden md:block border-t border-white/10">
        <div className="mx-auto max-w-[1280px] px-4 py-5 text-center text-[14px] text-[#A2A2A2] lg:px-8">
          © 2026 Carzo всі права захищені
        </div>
      </div>
    </footer>
  );
}
