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
    <span className="mb-3 flex gap-1 text-[#080808]" aria-label={`Оцінка: ${rating} з 5`}>
      <span aria-hidden="true">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
    </span>
  );
}

function withoutLeadingEmoji(title: string): string {
  return title.replace(/^[^\p{L}\p{N}]+/u, '');
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
      <section className="bg-[#f0f0ee] px-4 py-[90px] sm:px-[2.5vw] lg:px-[3vw] lg:py-[140px]" aria-label="Відгуки клієнтів">
        <div className="mx-auto max-w-[1450px]">
          <div className="mx-auto mb-12 max-w-[620px] text-center lg:mb-16">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#777777]">Досвід клієнтів</p>
            <h2 className="mb-4 text-[36px] font-semibold leading-[1] tracking-[-0.06em] text-[#111111] lg:text-[48px]">
              {withoutLeadingEmoji(data.settings.title)}
            </h2>
            <p className="text-[16px] font-normal leading-[1.5] text-[#555555] sm:text-[18px]">
              {data.settings.descriptionLine1}{' '}
              <br className="hidden sm:block" />
              {data.settings.descriptionLine2}{' '}
              <span className="font-semibold">{data.settings.instagramHandle}</span>
            </p>
          </div>

          <div className="mb-10 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3 md:gap-6">
            {displayItems.map(item => (
              <article
                key={item.key}
                className="rounded-[16px] border border-[#d2d2d0] bg-white p-6 shadow-none"
              >
                <Stars rating={item.rating} />
                <p className="mb-4 text-[15px] font-normal leading-[1.55] text-[#333333] sm:text-[16px]">{item.reviewText}</p>
                <div className="flex items-center gap-3 border-t border-[#d2d2d0] pt-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0f0ee]">
                    <User size={16} className="text-[#777777]" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#111111]">{item.customerName}</p>
                    <p className="text-[12px] font-normal text-[#777777]">{formatDate(item.reviewDate)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {hasScreenshots && (
            <div className="text-center">
              <button
                ref={triggerRef}
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex h-[40px] items-center justify-center rounded-[800px] bg-[#5ce4ab] px-[24px] text-[14px] font-semibold tracking-[-0.01em] text-[#080808] transition-colors hover:bg-[#4cd99d] active:bg-[#3cc48e]"
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
