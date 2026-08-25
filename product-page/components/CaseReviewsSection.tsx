'use client';

import { useEffect, useRef, useState } from 'react';
import { User, X } from 'lucide-react';
import type { ReviewsData } from '@/lib/content/types';
import { format, parseISO } from 'date-fns';
import { uk } from 'date-fns/locale';

interface CaseReviewsSectionProps {
  data: ReviewsData;
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'd MMMM, yyyy', { locale: uk });
  } catch {
    return dateStr;
  }
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="mb-3 flex gap-1" aria-label={`Оцінка: ${rating} з 5`}>
      <span aria-hidden="true">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
    </span>
  );
}

function ReviewsModal({ data, onClose }: { data: ReviewsData; onClose: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/50 md:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reviews-modal-title"
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="modal-shell">
        <div className="modal-header flex items-start justify-between">
          <div>
            <h2 id="reviews-modal-title" className="modal-title">{data.settings.modalTitle}</h2>
            <p className="modal-subtitle">{data.settings.modalDescription}</p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Закрити"
          >
            <X size={18} />
          </button>
        </div>
        <div ref={scrollRef} className="modal-scroll">
          <div className="modal-content">
            {data.screenshots.length > 0 ? (
              data.screenshots.map(screenshot => (
                <img
                  key={screenshot.key}
                  src={screenshot.image}
                  alt={screenshot.altText}
                  loading="lazy"
                  className="w-full rounded-[12px] border border-gray-200"
                  style={{ height: 'auto', objectFit: 'contain' }}
                />
              ))
            ) : (
              <p className="modal-body-text">Скріншоти ще не додано.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CaseReviewsSection({ data }: CaseReviewsSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (!data.settings.enabled || data.items.length === 0) return null;

  const displayItems = data.items.slice(0, 3);
  const hasScreenshots = data.screenshots.length > 0;

  return (
    <>
      <section className="bg-white" aria-label="Відгуки клієнтів">
        <div className="mx-auto max-w-7xl px-4 py-[88px] sm:px-6 sm:py-[100px] lg:px-8 lg:py-[112px]">
          <h2 className="mb-3 text-center text-[28px] font-bold leading-tight text-black sm:text-[32px] lg:text-[36px] lg:leading-[1.15]">
            {data.settings.title}
          </h2>
          <div className="mx-auto mb-10 max-w-[780px] text-center">
            <p className="text-[14px] leading-relaxed text-gray-600 sm:text-[16px] lg:text-[16px]">
              {data.settings.descriptionLine1}
            </p>
            <p className="mt-1 text-[14px] leading-relaxed text-gray-600 sm:text-[16px] lg:text-[16px]">
              {data.settings.descriptionLine2}{' '}
              <span className="font-semibold">{data.settings.instagramHandle}</span>
            </p>
          </div>

          <div className="mb-10 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3 md:gap-6">
            {displayItems.map(item => (
              <div
                key={item.key}
                className="rounded-[16px] border border-gray-200 bg-[#fafafa] p-5"
              >
                <Stars rating={item.rating} />
                <p className="mb-4 text-[16px] leading-relaxed text-gray-700">{item.reviewText}</p>
                <div className="flex items-center gap-3 border-t border-gray-200 pt-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                    <User size={16} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-gray-900">{item.customerName}</p>
                    <p className="text-[12px] text-gray-500">{formatDate(item.reviewDate)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasScreenshots && (
            <div className="text-center">
              <button
                ref={triggerRef}
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex h-[40px] w-[224px] items-center justify-center rounded-[800px] border border-[#5ce4ab] bg-[#5ce4ab] px-[23px] text-[14px] font-medium leading-[20px] text-[#181818] transition-colors hover:bg-[#4cd99d] active:bg-[#3cc48e]"
              >
                {data.settings.ctaLabel}
              </button>
            </div>
          )}
        </div>
      </section>

      {modalOpen && (
        <ReviewsModal data={data} onClose={() => {
          setModalOpen(false);
          triggerRef.current?.focus();
        }} />
      )}
    </>
  );
}
