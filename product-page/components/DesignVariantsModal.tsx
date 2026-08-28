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
  title: string;
  description: string;
}

/* ─── Component ─────────────────────────────────────────────────── */

export default function DesignVariantsModal({
  isOpen,
  onClose,
  variants,
  title,
  description,
}: DesignVariantsModalProps) {
  const [activeIndex, setActiveIndex] = useState(0);
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
      // Small delay so the DOM is painted before focusing
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

  /* ── Reset active index when variants change ── */
  useEffect(() => {
    setActiveIndex(0);
  }, [variants]);

  if (!isOpen || variants.length === 0) return null;

  const active = variants[activeIndex] ?? variants[0];

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
          max-height: calc(100dvh - 32px);
          overflow: hidden;
          background: #fff;
          border-radius: 20px 20px 0 0;
        }

        @media (min-width: 900px) {
          .dvm-panel {
            flex-direction: row;
            width: min(1120px, calc(100vw - 64px));
            max-height: calc(100dvh - 64px);
            border-radius: 16px;
          }
        }

        /* ── Image area ── */
        .dvm-image-wrap {
          position: relative;
          flex-shrink: 0;
          width: 100%;
          aspect-ratio: 4 / 5;
          overflow: hidden;
          background: #f5f5f5;
        }

        @media (min-width: 900px) {
          .dvm-image-wrap {
            width: 48%;
            aspect-ratio: auto;
            height: auto;
          }
        }

        .dvm-image-wrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* ── Close button (overlaid on image) ── */
        .dvm-close {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 2;
          display: flex;
          width: 36px;
          height: 36px;
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

        @media (min-width: 900px) {
          .dvm-close {
            top: 16px;
            right: 16px;
            width: 34px;
            height: 34px;
          }
        }

        /* ── Content area ── */
        .dvm-content {
          display: flex;
          flex-direction: column;
          flex: 1;
          padding: 24px 20px 28px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        @media (min-width: 900px) {
          .dvm-content {
            justify-content: center;
            padding: 40px 44px;
          }
        }

        /* ── Title ── */
        .dvm-title {
          margin: 0;
          color: #111;
          font-size: 20px;
          font-weight: 600;
          line-height: 1.3;
        }

        @media (min-width: 900px) {
          .dvm-title {
            font-size: 24px;
          }
        }

        /* ── Description ── */
        .dvm-description {
          margin: 8px 0 0;
          color: #707070;
          font-size: 14px;
          font-weight: 400;
          line-height: 1.55;
        }

        @media (min-width: 900px) {
          .dvm-description {
            margin-top: 10px;
            font-size: 15px;
          }
        }

        /* ── Selector group ── */
        .dvm-selectors {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 24px;
        }

        @media (min-width: 900px) {
          .dvm-selectors {
            gap: 12px;
            margin-top: 28px;
          }
        }

        /* ── Selector button ── */
        .dvm-selector-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 54px;
          border-radius: 10px;
          background: #fff;
          cursor: pointer;
          transition:
            border-color 150ms ease,
            color 150ms ease,
            font-weight 150ms ease,
            box-shadow 150ms ease;
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
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
        }

        .dvm-selector-btn:focus-visible {
          outline: 2px solid #111;
          outline-offset: 2px;
        }

        @media (min-width: 900px) {
          .dvm-selector-btn {
            height: 52px;
          }
        }

        /* ── Crossfade image transition ── */
        .dvm-img-transition {
          transition: opacity 200ms ease;
        }
      `}</style>

      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="dvm-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dvm-title"
        onClick={(e) => {
          if (e.target === backdropRef.current) onClose();
        }}
      >
        {/* Panel */}
        <div ref={panelRef} className="dvm-panel" onClick={(e) => e.stopPropagation()}>
          {/* Image */}
          <div className="dvm-image-wrap">
            <Image
              key={active.code}
              src={active.modalImage}
              alt={active.altText}
              fill
              sizes="(max-width: 899px) 100vw, 48vw"
              className="dvm-img-transition"
              unoptimized
            />

            {/* Close button */}
            <button
              ref={closeButtonRef}
              type="button"
              className="dvm-close"
              onClick={onClose}
              aria-label="Закрити"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="dvm-content">
            <h2 id="dvm-title" className="dvm-title">
              {title}
            </h2>
            <p className="dvm-description">{description}</p>

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
                    onClick={() => setActiveIndex(i)}
                  >
                    {v.title}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
