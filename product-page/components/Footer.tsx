'use client';

import { useState } from 'react';
import { ChevronDown, Phone, Mail } from 'lucide-react';
import Link from 'next/link';
import SimpleModal, { B2BModalContent, BlogModalContent } from './SimpleModal';
import type { BenefitModalData, BenefitModalType } from '@/lib/content/types';
import BenefitModal from './BenefitModal';

interface FooterProps {
  benefitModals?: BenefitModalData[];
}

const catalogLinks = [
  { label: 'Автокейси', href: '/case/design/m/2-0' },
  { label: 'Автокилимки', href: '#' },
];

const customerLinks = [
  { label: 'Про нас', href: '/about', modalType: undefined },
  { label: 'Доставка', href: undefined, modalType: 'delivery' as BenefitModalType },
  { label: 'Оплата', href: undefined, modalType: 'payment' as BenefitModalType },
  { label: 'Обмін та повернення', href: undefined, modalType: 'returns' as BenefitModalType },
];

const b2bLinks = [
  { label: 'Корпоративні замовлення', modal: 'b2b' },
  { label: 'Гурт для партнерів', modal: 'b2b' },
];

const bonusLinks = [
  { label: 'Клієнтська програма', modalType: 'loyalty' as BenefitModalType },
  { label: 'Разом дешевше', modalType: 'bundle' as BenefitModalType },
];

const legalLinks = [
  { label: 'Політика конфіденційності', href: '/privacy-policy' },
  { label: 'Публічна оферта', href: '/public-offer' },
];

export default function Footer({ benefitModals = [] }: FooterProps) {
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [openBenefitModal, setOpenBenefitModal] = useState<BenefitModalType | null>(null);
  const [openB2BModal, setOpenB2BModal] = useState(false);
  const [openBlogModal, setOpenBlogModal] = useState(false);

  const selectedBenefit = benefitModals.find(m => m.type === openBenefitModal);

  const toggleAccordion = (label: string) => {
    setOpenAccordion(prev => prev === label ? null : label);
  };

  const handleBenefitClick = (type: BenefitModalType) => {
    setOpenBenefitModal(type);
  };

  return (
    <>
      <footer className="bg-black text-white">
        {/* Desktop Footer */}
        <div className="hidden md:block">
          <div className="mx-auto max-w-[1280px] px-4 py-12 lg:px-8">
            <div className="grid grid-cols-5 gap-8">
              {/* Column 1: Каталог */}
              <div>
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-gray-400">Каталог</h3>
                <ul className="space-y-3">
                  {catalogLinks.map(link => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-[14px] text-gray-300 transition-colors hover:text-white">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Column 2: Покупцеві */}
              <div>
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-gray-400">Покупцеві</h3>
                <ul className="space-y-3">
                  {customerLinks.map(link => (
                    <li key={link.label}>
                      {link.href ? (
                        <Link href={link.href} className="text-[14px] text-gray-300 transition-colors hover:text-white">
                          {link.label}
                        </Link>
                      ) : link.modalType ? (
                        <button
                          type="button"
                          onClick={() => handleBenefitClick(link.modalType!)}
                          className="text-[14px] text-gray-300 transition-colors hover:text-white"
                        >
                          {link.label}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Column 3: B2B */}
              <div>
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-gray-400">B2B</h3>
                <ul className="space-y-3">
                  {b2bLinks.map(link => (
                    <li key={link.label}>
                      <button
                        type="button"
                        onClick={() => setOpenB2BModal(true)}
                        className="text-[14px] text-gray-300 transition-colors hover:text-white"
                      >
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Column 4: Carzo bonus */}
              <div>
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-gray-400">Carzo bonus</h3>
                <ul className="space-y-3">
                  {bonusLinks.map(link => (
                    <li key={link.label}>
                      <button
                        type="button"
                        onClick={() => handleBenefitClick(link.modalType)}
                        className="text-[14px] text-gray-300 transition-colors hover:text-white"
                      >
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Column 5: Контакти */}
              <div>
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-gray-400">Зателефонувати</h3>
                <a href="tel:+380661031094" className="text-[15px] font-medium text-white transition-colors hover:text-[#5ce4ab]">
                  +380 66 103 10 94
                </a>
                <p className="mt-1 text-[13px] text-gray-400">з 10:00 до 20:00</p>
                
                <h3 className="mb-3 mt-6 text-[13px] font-semibold uppercase tracking-wider text-gray-400">Приєднатися</h3>
                <div className="flex gap-3">
                  <a href="https://instagram.com/carzo.ua" target="_blank" rel="noopener noreferrer" className="text-gray-400 transition-colors hover:text-white" aria-label="Instagram">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  </a>
                  <a href="https://t.me/carzo_ua" target="_blank" rel="noopener noreferrer" className="text-gray-400 transition-colors hover:text-white" aria-label="Telegram">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
                  </a>
                </div>

                <ul className="mt-6 space-y-3">
                  {legalLinks.map(link => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-[13px] text-gray-400 transition-colors hover:text-white">
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
            <p className="text-center text-[14px] text-gray-300">
              🇺🇦 Сконструйовано та виготовлено в Україні
            </p>
            <a
              href="tel:+380661031094"
              className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-[14px] border border-white/75 bg-transparent px-4 text-base font-semibold leading-6 text-white transition-colors hover:border-white hover:text-[#5ce4ab]"
              style={{ minHeight: 56 }}
            >
              <Phone size={18} strokeWidth={1.8} />
              Зателефонувати з 10:00 до 20:00
            </a>

            {/* Accordion sections */}
            <div className="mt-8 space-y-0">
              {[
                { label: 'Каталог', links: catalogLinks.map(l => ({ ...l, type: 'link' as const, href: l.href, modalType: undefined })) },
                { label: 'Покупцеві', links: customerLinks.map(l => ({ ...l, type: l.href ? 'link' as const : 'benefit' as const, href: l.href, modalType: l.modalType })) },
                { label: 'B2B', links: b2bLinks.map(l => ({ ...l, type: 'b2b' as const, href: undefined, modalType: undefined })) },
                { label: 'Carzo bonus', links: bonusLinks.map(l => ({ ...l, type: 'benefit' as const, href: undefined, modalType: l.modalType })) },
              ].map(section => (
                <div key={section.label} className="border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => toggleAccordion(section.label)}
                    className="flex w-full items-center justify-between py-4 text-[15px] font-medium text-white"
                  >
                    {section.label}
                    <ChevronDown size={18} className={`transition-transform ${openAccordion === section.label ? 'rotate-180' : ''}`} />
                  </button>
                  {openAccordion === section.label && (
                    <ul className="space-y-3 pb-4 pl-4">
                      {section.links.map(link => (
                        <li key={link.label}>
                          {link.type === 'link' && link.href ? (
                            <Link href={link.href} className="text-[14px] text-gray-300 transition-colors hover:text-white">
                              {link.label}
                            </Link>
                          ) : link.type === 'benefit' && link.modalType ? (
                            <button
                              type="button"
                              onClick={() => handleBenefitClick(link.modalType!)}
                              className="text-[14px] text-gray-300 transition-colors hover:text-white"
                            >
                              {link.label}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setOpenB2BModal(true)}
                              className="text-[14px] text-gray-300 transition-colors hover:text-white"
                            >
                              {link.label}
                            </button>
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
                <Link key={link.label} href={link.href} className="block text-[13px] text-gray-400 transition-colors hover:text-white">
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Social */}
            <div className="mt-6 flex justify-center gap-4">
              <a href="https://instagram.com/carzo.ua" target="_blank" rel="noopener noreferrer" className="text-gray-400 transition-colors hover:text-white" aria-label="Instagram">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
              <a href="https://t.me/carzo_ua" target="_blank" rel="noopener noreferrer" className="text-gray-400 transition-colors hover:text-white" aria-label="Telegram">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
              </a>
            </div>

            {/* Copyright */}
            <p className="mt-6 text-center text-[12px] text-gray-500">
              © 2026 Carzo всі права захищені
            </p>
          </div>
        </div>

        {/* Desktop copyright */}
        <div className="hidden md:block border-t border-white/10">
          <div className="mx-auto max-w-[1280px] px-4 py-5 text-center text-xs text-gray-500 lg:px-8">
            © 2026 Carzo всі права захищені
          </div>
        </div>
      </footer>

      {/* Modals */}
      {selectedBenefit && (
        <BenefitModal data={selectedBenefit} onClose={() => setOpenBenefitModal(null)} />
      )}
      {openB2BModal && (
        <SimpleModal title="Зазначений розділ у розробці" onClose={() => setOpenB2BModal(false)}>
          <B2BModalContent />
        </SimpleModal>
      )}
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
    </>
  );
}
