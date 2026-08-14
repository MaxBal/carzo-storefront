'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Info } from 'lucide-react';
import Image from 'next/image';
import type { InfoModalData } from '@/lib/content/types';

export type { InfoModalData } from '@/lib/content/types';

interface InfoModalProps {
  data: InfoModalData;
  onClose: () => void;
}

/* ─── Modal ───────────────────────────────────────────────────── */

export default function InfoModal({ data, onClose }: InfoModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Reset scroll when tab changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);

  const tab = data.tabs[activeTab];

  return (
    /* Backdrop */
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[10000] flex items-end md:items-center md:justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
    >
      {/* Panel */}
      <div
        className="modal-shell"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Sticky header ── */}
        <div className="modal-header">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <h2 id="info-modal-title" className="modal-title">{data.title}</h2>
            <button
              onClick={onClose}
              className="modal-close"
              aria-label="Закрити"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* Tab bar */}
          <div className="modal-tab-bar mt-3">
            {data.tabs.map((t, i) => (
              <button
                key={t.label}
                onClick={() => setActiveTab(i)}
                className={`modal-tab ${activeTab === i ? 'modal-tab-active' : ''}`}
              >
                {t.label}
                {activeTab === i ? <span className="modal-tab-indicator" /> : null}
              </button>
            ))}
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div ref={scrollRef} className="modal-scroll">
          <div className="modal-content">

            {/* Info box */}
            {tab.infoBox && (
              <div className="modal-info-box">
                <div className="modal-info-icon">
                  <Info size={14} strokeWidth={2} />
                </div>
                <p className="modal-body-text pt-1">{tab.infoBox}</p>
              </div>
            )}

            {/* FAQ cards */}
            {tab.faqs?.map(faq => (
              <div key={faq.key} className="modal-faq">
                <p className="modal-faq-question">{faq.question}</p>
                <p className="modal-faq-answer">{faq.answer}</p>
              </div>
            ))}

            {/* Content sections */}
            {tab.sections?.map(section => (
              <div key={section.key} className="flex flex-col gap-3">
                {/* Image or safe placeholder */}
                <div
                  className="modal-image-container flex items-center justify-center"
                  style={{
                    aspectRatio: '16/9',
                    minHeight: 180,
                  }}
                >
                  {section.image ? (
                    <Image
                      src={section.image}
                      alt={section.title}
                      width={1200}
                      height={675}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="modal-secondary-text">{section.imagePlaceholder || ''}</span>
                  )}
                </div>

                {/* Text */}
                <h3 className="modal-card-title">{section.title}</h3>
                <p className="modal-body-text -mt-1">{section.text}</p>
              </div>
            ))}

          </div>
        </div>
      </div>
    </div>
  );
}
