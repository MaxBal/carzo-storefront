'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Info } from 'lucide-react';
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="design-selector-title"
        onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      >
        <motion.div
          key="panel"
          className="modal-shell"
          style={{ boxShadow: '0 -4px 40px rgba(0,0,0,0.12)' }}
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
          <div className="modal-header">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="design-selector-title" className="modal-title">Усі дизайни</h2>
                <p className="modal-subtitle">Оберіть дизайн кейса</p>
              </div>
              <button
                onClick={onClose}
                className="modal-close"
                aria-label="Закрити"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="modal-divider" />

          {/* Scrollable body */}
          <div className="modal-scroll">
            <div className="modal-content">

              {/* Info banner */}
              <div className="modal-info-box">
                <div className="modal-info-icon">
                  <Info size={14} strokeWidth={2} />
                </div>
                <p className="modal-body-text pt-1">
                  {designInfoText}
                </p>
              </div>

              {/* Design cards */}
              {designs.map(design => {
                const isCurrent = design.slug === currentDesign;
                const href = buildHref(design.slug);
                const ctaLabel = isCurrent ? 'Обраний варіант' : `Переглянути ${design.label}`;
                return (
                  <div key={design.slug} className="flex flex-col gap-3">
                    {/* Product image */}
                    <div
                      className="modal-image-container flex items-center justify-center"
                      style={{ aspectRatio: '16/9' }}
                    >
                      <Image
                        src={design.selectorImage}
                        alt={design.label}
                        width={800}
                        height={450}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {isCurrent ? (
                      <button
                        type="button"
                        disabled
                        className="mt-2 flex h-12 w-full cursor-default items-center justify-center rounded-full bg-[#181818] px-4 text-[15px] font-semibold leading-none text-white opacity-50"
                      >
                        {ctaLabel}
                      </button>
                    ) : (
                      <a
                        href={href}
                        onClick={e => handleNavigate(e, href)}
                        className="mt-2 flex h-12 w-full items-center justify-center rounded-full bg-[#181818] px-4 text-[15px] font-semibold leading-none text-white no-underline transition-colors hover:bg-black"
                      >
                        {ctaLabel}
                      </a>
                    )}
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
