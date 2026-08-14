'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Info, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { DesignInfo } from '@/lib/content/types';

interface DesignSelectorModalProps {
  onClose: () => void;
  currentDesign?: string;
  designs: DesignInfo[];
  designInfoText: string;
}

export default function DesignSelectorModal({
  onClose,
  currentDesign = '2-0',
  designs,
  designInfoText,
}: DesignSelectorModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const mobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const panelVariants = {
    hidden: mobile
      ? { y: '100%', opacity: 0 }
      : { y: 24, opacity: 0, scale: 0.97 },
    visible: mobile
      ? { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 340, damping: 34 } }
      : { y: 0, opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 340, damping: 34 } },
    exit: mobile
      ? { y: '100%', opacity: 0, transition: { duration: 0.22, ease: 'easeIn' as const } }
      : { y: 16, opacity: 0, scale: 0.97, transition: { duration: 0.18, ease: 'easeIn' as const } },
  };

  // Build href preserving current size + brand from the current URL
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const segments = currentPath.replace(/^\/case\/design\//, '').split('/').filter(Boolean);
  const currentSize = segments[0] || 'm';
  const currentBrand = segments.length >= 3 ? segments[2] : null;

  const buildHref = (designSlug: string) => {
    let href = `/case/design/${currentSize}/${designSlug}`;
    if (currentBrand) {
      href += `/${currentBrand}`;
    }
    return href;
  };

  const handleNavigate = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    onClose();
    router.push(href, { scroll: false });
  };

  const currentDesignInfo = designs.find(design => design.slug === currentDesign);
  const currentVersion = currentDesignInfo?.version ?? '2.0';

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        ref={backdropRef}
        className="fixed inset-0 z-[10000] flex items-end md:items-center md:justify-center"
        style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.45)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      >
        <motion.div
          key="panel"
          className="
            relative bg-white w-full flex flex-col
            rounded-t-3xl
            md:rounded-2xl md:max-w-[680px] md:mx-6 md:shadow-2xl
          "
          style={{
            maxHeight: 'calc(100dvh - 56px)',
            height: 'calc(100dvh - 56px)',
            boxShadow: '0 -4px 40px rgba(0,0,0,0.12)',
          }}
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle — mobile only */}
          <div className="flex justify-center pt-3 pb-0 md:hidden flex-shrink-0">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex-shrink-0 px-5 pt-4 pb-4 md:pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900 leading-tight">Усі дизайни</h2>
                <p className="text-sm text-gray-400 mt-0.5 leading-snug">Оберіть дизайн кейса</p>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600 mt-0.5"
                aria-label="Закрити"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="flex-shrink-0 h-px bg-gray-100 mx-5" />

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-5 flex flex-col gap-6 pb-8">

              {/* Info banner */}
              <div
                className="flex items-start gap-3 p-4 rounded-[18px]"
                style={{ background: '#f2f8f7', border: '1px solid #bfece4' }}
              >
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: '#28c5a6' }}
                >
                  <Info size={15} color="white" strokeWidth={2.5} />
                </div>
                <p className="text-sm text-gray-700 leading-relaxed pt-1">
                  {designInfoText}
                </p>
              </div>

              {/* Design cards */}
              {designs.map(design => {
                const isCurrent = design.slug === currentDesign;
                const href = buildHref(design.slug);
                return (
                  <div key={design.slug} className="flex flex-col gap-3">
                    {/* Title row */}
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[17px] font-semibold text-gray-900 leading-tight">
                        {design.label}
                      </h3>
                      {isCurrent && (
                        <span
                          className="flex-shrink-0 text-xs font-medium px-3 py-1 rounded-full"
                          style={{ background: '#f0f0f0', color: '#28c5a6' }}
                        >
                          Обраний варіант
                        </span>
                      )}
                    </div>

                    {/* Product image */}
                    <div
                      className="w-full rounded-2xl overflow-hidden flex items-center justify-center"
                      style={{ background: '#efefef', aspectRatio: '16/9' }}
                    >
                      <Image
                        src={design.selectorImage}
                        alt={design.label}
                        width={800}
                        height={450}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Open link row */}
                    <a
                      href={href}
                      onClick={e => handleNavigate(e, href)}
                      className="flex items-center justify-between w-full transition-colors"
                      style={{
                        height: 48,
                        borderRadius: 10,
                        paddingLeft: 16,
                        paddingRight: 16,
                        background: 'transparent',
                        border: '1.5px solid #111111',
                        boxShadow: 'none',
                        marginTop: 8,
                        lineHeight: 1,
                        textDecoration: 'none',
                        transition: 'background-color 160ms',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F5F5F5'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#111111', lineHeight: 1 }}>Переглянути дизайн</span>
                      <ArrowUpRight size={20} strokeWidth={2} style={{ color: '#111111', flexShrink: 0 }} />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
