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
        className="
          relative bg-white w-full flex flex-col
          rounded-t-2xl
          md:rounded-2xl md:w-full md:max-w-[760px] md:mx-6
        "
        style={{
          maxHeight: 'calc(100dvh - 56px)',
          height: 'calc(100dvh - 56px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Sticky header ── */}
        <div className="flex-shrink-0 bg-white rounded-t-2xl md:rounded-t-2xl">
          {/* Title row */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 id="info-modal-title" className="text-xl font-bold text-gray-900">{data.title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-600"
              aria-label="Закрити"
            >
              <X size={20} strokeWidth={2} />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-gray-200 px-5 gap-6">
            {data.tabs.map((t, i) => (
              <button
                key={t.label}
                onClick={() => setActiveTab(i)}
                className="relative pb-3 text-sm font-medium transition-colors whitespace-nowrap"
                style={{ color: activeTab === i ? '#111' : '#9ca3af' }}
              >
                {t.label}
                {activeTab === i && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                    style={{ backgroundColor: '#111' }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 flex flex-col gap-6">

            {/* Info box */}
            {tab.infoBox && (
              <div
                className="flex items-start gap-3 rounded-xl px-4 py-3.5"
                style={{ background: '#f0fdf9', border: '1px solid #99f6e4' }}
              >
                <div
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                  style={{ background: '#2DD4BF' }}
                >
                  <Info size={13} color="white" strokeWidth={2.5} />
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{tab.infoBox}</p>
              </div>
            )}

            {/* FAQ cards */}
            {tab.faqs?.map((faq, i) => (
              <div
                key={faq.key}
                className="rounded-xl px-4 py-4"
                style={{ border: '1.5px solid #e5e7eb' }}
              >
                <p className="text-sm font-bold text-gray-900 leading-snug mb-2">{faq.question}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
              </div>
            ))}

            {/* Content sections */}
            {tab.sections?.map((section, i) => (
              <div key={section.key} className="flex flex-col gap-3">
                {/* Image or safe placeholder */}
                <div
                  className="w-full rounded-2xl flex items-center justify-center overflow-hidden"
                  style={{
                    background: '#f3f4f6',
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
                    <span className="text-sm text-gray-400">{section.imagePlaceholder || ''}</span>
                  )}
                </div>

                {/* Text */}
                <h3 className="text-base font-bold text-gray-900">{section.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed -mt-1">{section.text}</p>
              </div>
            ))}

          </div>
        </div>
      </div>
    </div>
  );
}
