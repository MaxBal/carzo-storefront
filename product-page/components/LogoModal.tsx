'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Info } from 'lucide-react';
import Image from 'next/image';
import type { LogoModalData } from '@/lib/content/types';

type TabId = 'photo' | 'placement' | 'faq';

interface LogoModalProps {
  onClose: () => void;
  data: LogoModalData;
}

export default function LogoModal({ onClose, data }: LogoModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('photo');
  const scrollRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[10000] flex items-end md:items-center md:justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="logo-modal-title"
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div
        className="relative bg-white w-full flex flex-col rounded-t-2xl md:rounded-2xl md:w-full md:max-w-[760px] md:mx-6"
        style={{ maxHeight: 'calc(100dvh - 56px)', height: 'calc(100dvh - 56px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex-shrink-0 bg-white rounded-t-2xl">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 id="logo-modal-title" className="text-xl font-bold text-gray-900">{data.title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-600"
              aria-label="Закрити"
            >
              <X size={20} strokeWidth={2} />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-gray-200 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <TabBtn id="photo" active={activeTab === 'photo'} onSelect={setActiveTab}>
              Фото лого
            </TabBtn>
            <TabBtn id="placement" active={activeTab === 'placement'} onSelect={setActiveTab}>
              Розміщення лого
            </TabBtn>
            <TabBtn id="faq" active={activeTab === 'faq'} onSelect={setActiveTab}>
              Часті питання
            </TabBtn>
          </div>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 flex flex-col gap-5 pb-8">

            {/* Photo tab */}
            {activeTab === 'photo' && (
              <>
                <InfoBox>
                  {data.infoText}
                </InfoBox>

                {/* Logo photo */}
                <div
                  className="w-full aspect-video overflow-hidden rounded-2xl"
                  style={{ background: '#F5F5F5' }}
                >
                  <Image
                    src={data.logoImage}
                    alt={`Шильд ${data.brandName}`}
                    width={1200}
                    height={675}
                    className="h-full w-full object-contain"
                    unoptimized
                  />
                </div>

                {/* Specs */}
                <div className="flex flex-col divide-y divide-gray-100">
                  {data.specs.map((spec, i) => (
                    <div key={`${spec.label}-${spec.value}`} className="flex items-center justify-between py-3">
                      <span className="text-sm text-gray-500">{spec.label}</span>
                      <span className="text-sm font-semibold text-gray-900">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Placement tab */}
            {activeTab === 'placement' && (
              <div className="w-full aspect-video overflow-hidden rounded-2xl" style={{ background: '#F5F5F5' }}>
                <Image
                  src={data.placementImage}
                  alt={`Розміщення логотипа ${data.brandName}`}
                  width={1200}
                  height={675}
                  className="h-full w-full object-contain"
                  unoptimized
                />
              </div>
            )}

            {/* FAQ tab */}
            {activeTab === 'faq' && (
              data.faqs.map(faq => (
                <FaqCard key={faq.key} question={faq.question} answer={faq.answer} />
              ))
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  id,
  active,
  onSelect,
  children,
}: {
  id: TabId;
  active: boolean;
  onSelect: (id: TabId) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onSelect(id)}
      className="relative flex-shrink-0 flex items-center gap-1 pb-3 px-4 text-sm font-medium transition-colors whitespace-nowrap"
      style={{ color: active ? '#111' : '#9ca3af' }}
    >
      {children}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ backgroundColor: '#111' }} />
      )}
    </button>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3"
      style={{ background: '#f0fdf9', border: '1px solid #99f6e4' }}
    >
      <div
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
        style={{ background: '#2DD4BF' }}
      >
        <Info size={13} color="white" strokeWidth={2.5} />
      </div>
      <p className="text-sm text-gray-700 leading-relaxed pt-1">
        {children}
      </p>
    </div>
  );
}

function FaqCard({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-xl px-4 py-4" style={{ border: '1.5px solid #e5e7eb' }}>
      <p className="text-sm font-bold text-gray-900 leading-snug mb-2">{question}</p>
      <p className="text-sm text-gray-600 leading-relaxed">{answer}</p>
    </div>
  );
}
