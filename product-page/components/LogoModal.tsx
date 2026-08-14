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
        className="modal-shell"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="modal-header">
          <div className="flex items-center justify-between">
            <h2 id="logo-modal-title" className="modal-title">{data.title}</h2>
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
        <div ref={scrollRef} className="modal-scroll">
          <div className="modal-content">

            {/* Photo tab */}
            {activeTab === 'photo' && (
              <>
                <InfoBox>
                  {data.infoText}
                </InfoBox>

                {/* Logo photo */}
                <div className="modal-image-container aspect-video">
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
                <div className="flex flex-col divide-y divide-[#f0f0f0]">
                  {data.specs.map(spec => (
                    <div key={`${spec.label}-${spec.value}`} className="flex items-center justify-between py-3">
                      <span className="modal-secondary-text">{spec.label}</span>
                      <span className="text-base font-semibold text-gray-900">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Placement tab */}
            {activeTab === 'placement' && (
              <div className="modal-image-container aspect-video">
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
      className={`modal-tab flex flex-shrink-0 items-center gap-1 ${active ? 'modal-tab-active' : ''}`}
    >
      {children}
      {active ? <span className="modal-tab-indicator" /> : null}
    </button>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="modal-info-box">
      <div className="modal-info-icon">
        <Info size={14} strokeWidth={2} />
      </div>
      <p className="modal-body-text pt-1">
        {children}
      </p>
    </div>
  );
}

function FaqCard({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="modal-faq">
      <p className="modal-faq-question">{question}</p>
      <p className="modal-faq-answer">{answer}</p>
    </div>
  );
}
