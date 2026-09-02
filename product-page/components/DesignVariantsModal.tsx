'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import Image from 'next/image';

/* ─── Types ─────────────────────────────────────────────────────── */

export interface DesignVariant {
  code: string;
  title: string;
  modalImage: string;
  altText: string;
}

export interface DesignVariantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  variants: DesignVariant[];
}

type ImageStatus = 'loading' | 'loaded' | 'error';

/* ─── Component ─────────────────────────────────────────────────── */

export default function DesignVariantsModal({
  isOpen,
  onClose,
  variants,
}: DesignVariantsModalProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageStatus, setImageStatus] = useState<ImageStatus>(() => (
    variants[0]?.modalImage?.trim() ? 'loading' : 'error'
  ));
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  /* ── Lock body scroll (no jump) ── */
  useEffect(() => {
    if (!isOpen) return;

    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingR = document.body.style.paddingRight;

    document.body.style.overflow = 'hidden';
    if (scrollbarW > 0) {
      document.body.style.paddingRight = `${scrollbarW}px`;
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingR;
    };
  }, [isOpen]);

  /* ── Remember trigger element, restore focus on close ── */
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      const id = requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    } else {
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  /* ── Escape key ── */
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, handleKey]);

  /* ── Focus trap ── */
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;

    const panel = panelRef.current;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleTab);
    return () => window.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  /* ── Reset state when variants change ── */
  useEffect(() => {
    setActiveIndex(0);
    setImageStatus(variants[0]?.modalImage?.trim() ? 'loading' : 'error');
  }, [variants]);

  if (!isOpen || variants.length === 0) return null;

  const active = variants[activeIndex] ?? variants[0];
  const hasActiveImage = Boolean(active.modalImage?.trim());

  const handleVariantChange = (index: number) => {
    if (index === activeIndex) return;
    setImageStatus(variants[index]?.modalImage?.trim() ? 'loading' : 'error');
    setActiveIndex(index);
  };

  return (
    <>
      {/* Scoped styles via style jsx */}
      <style jsx global>{`
        /* ── Overlay ── */
        .dvm-overlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          background: rgba(0, 0, 0, 0.72);
          -webkit-tap-highlight-color: transparent;
        }

        @media (min-width: 900px) {
          .dvm-overlay {
            align-items: center;
          }
        }

        /* ── Panel ── */
        .dvm-panel {
          position: relative;
          display: flex;
          flex-direction: column;
          width: 100%;
          height: auto;
          max-height: 100dvh;
          overflow: hidden;
          background: #fff;
          border-radius: 20px 20px 0 0;
        }

        @media (min-width: 900px) {
          .dvm-panel {
            flex-direction: row;
            width: min(1100px, calc(100vw - 64px), calc(200dvh - 128px));
            aspect-ratio: 2 / 1;
            max-height: calc(100dvh - 64px);
            border-radius: 16px;
          }
        }

        /* ── Image area ── */
        .dvm-image-wrap {
          position: relative;
          flex-shrink: 0;
          width: 100%;
          aspect-ratio: 1 / 1;
          overflow: hidden;
          background: #e8e8e8;
        }

        @media (min-width: 900px) {
          .dvm-image-wrap {
            flex: 0 0 50%;
            width: 50%;
            height: 100%;
          }
        }

        .dvm-image-wrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* ── Image fallback (error state) ── */
        .dvm-img-fallback {
          position: absolute;
          inset: 0;
          background: #e8e8e8;
        }

        /* ── Close button (overlaid on image mobile / white panel desktop) ── */
        .dvm-close {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 2;
          display: flex;
          width: 46px;
          height: 46px;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.88);
          color: #111;
          cursor: pointer;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          transition: background-color 150ms ease;
        }

        .dvm-close:hover {
          background: rgba(255, 255, 255, 1);
        }

        .dvm-close:focus-visible {
          outline: 2px solid #111;
          outline-offset: 2px;
        }

        /* ── Content area ── */
        .dvm-content {
          display: flex;
          flex-direction: column;
          justify-content: center;
          flex: 1;
          min-height: 0;
          padding: 18px 18px 20px;
          overflow: hidden;
        }

        @media (min-width: 900px) {
          .dvm-content {
            flex: 0 0 50%;
            width: 50%;
            height: 100%;
            padding: 44px;
          }
        }

        /* ── Selector group ── */
        .dvm-selectors {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* ── Selector button ── */
        .dvm-selector-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 48px;
          border-radius: 8px;
          background: #fff;
          cursor: pointer;
          transition:
            border-color 150ms ease,
            color 150ms ease,
            font-weight 150ms ease;
          font-family: inherit;
          font-size: 15px;
          line-height: 1;
        }

        .dvm-selector-btn--inactive {
          border: 1px solid #b8b8b8;
          color: #707070;
          font-weight: 400;
        }

        .dvm-selector-btn--inactive:hover {
          border-color: #999;
        }

        .dvm-selector-btn--active {
          border: 1.5px solid #111;
          color: #111;
          font-weight: 500;
        }

        .dvm-selector-btn:focus-visible {
          outline: 2px solid #111;
          outline-offset: 2px;
        }

        @media (min-width: 900px) {
          .dvm-selector-btn {
            height: 50px;
          }
        }

        /* ── Crossfade image transition ── */
        .dvm-img-transition {
          opacity: 0;
          transition: opacity 150ms ease;
        }

        .dvm-img-transition--loaded {
          opacity: 1;
        }

        @media (prefers-reduced-motion: reduce) {
          .dvm-img-transition {
            transition: none;
          }
        }
      `}</style>

      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="dvm-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Варіанти дизайну"
        onClick={(e) => {
          if (e.target === backdropRef.current) onClose();
        }}
      >
        {/* Panel */}
        <div ref={panelRef} className="dvm-panel" onClick={(e) => e.stopPropagation()}>
          {/* Image */}
          <div className="dvm-image-wrap" aria-busy={imageStatus === 'loading'}>
            <div className="dvm-img-fallback" aria-hidden="true" />
            {hasActiveImage ? (
              <Image
                key={active.code}
                src={active.modalImage}
                alt={active.altText}
                fill
                sizes="(max-width: 899px) 100vw, 550px"
                className={`dvm-img-transition ${imageStatus === 'loaded' ? 'dvm-img-transition--loaded' : ''}`}
                unoptimized
                onLoad={() => setImageStatus('loaded')}
                onError={() => setImageStatus('error')}
              />
            ) : null}
          </div>

          {/* Content */}
          <div className="dvm-content">
            {/* Selector buttons */}
            <div className="dvm-selectors" role="group" aria-label="Вибір дизайну">
              {variants.map((v, i) => {
                const isActive = i === activeIndex;
                return (
                  <button
                    key={v.code}
                    type="button"
                    className={`dvm-selector-btn ${isActive ? 'dvm-selector-btn--active' : 'dvm-selector-btn--inactive'}`}
                    aria-pressed={isActive}
                    onClick={() => handleVariantChange(i)}
                  >
                    {v.title}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Close button */}
          <button
            ref={closeButtonRef}
            type="button"
            className="dvm-close"
            onClick={onClose}
            aria-label="Закрити"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
