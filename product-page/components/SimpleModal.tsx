'use client';

import { useEffect, useRef } from 'react';
import { X, Mail, MessageCircle } from 'lucide-react';

interface SimpleModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function SimpleModal({ title, onClose, children }: SimpleModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

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
      aria-labelledby="simple-modal-title"
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="modal-shell">
        <div className="modal-header flex items-start justify-between">
          <h2 id="simple-modal-title" className="modal-title">{title}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Закрити"
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-scroll">
          <div className="modal-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function B2BModalContent() {
  return (
    <>
      <div className="flex justify-center mb-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <MessageCircle size={28} className="text-gray-600" />
        </div>
      </div>
      <p className="modal-body-text text-center">
        Потрібна консультація? Напишіть нам на carzo.ukraine@gmail.com або в один із месенджерів.
      </p>
      <a
        href="mailto:carzo.ukraine@gmail.com"
        className="flex items-center gap-3 rounded-[12px] border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50"
      >
        <Mail size={20} className="text-gray-500" />
        <span className="text-[15px] text-gray-900">carzo.ukraine@gmail.com</span>
      </a>
      <div className="flex gap-3">
        <a
          href="https://t.me/carzo_ua"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-[12px] border border-gray-200 bg-white px-4 py-3 text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
          </svg>
          Telegram
        </a>
        <a
          href="viber://chat?number=%2B380661031094"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-[12px] border border-gray-200 bg-white px-4 py-3 text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.46 14.34c-.24.46-.76.76-1.28.76-.2 0-.4-.04-.58-.12l-2.34-.94c-.18-.07-.38-.04-.54.06l-.82.52c-.14.09-.32.08-.46-.02-.62-.46-1.56-1.14-2.36-1.94-.8-.8-1.48-1.74-1.94-2.36-.1-.14-.11-.32-.02-.46l.52-.82c.1-.16.13-.36.06-.54l-.94-2.34c-.08-.18-.12-.38-.12-.58 0-.52.3-1.04.76-1.28.18-.1.38-.14.58-.14h2.5c.38 0 .72.24.84.6.06.18.14.42.22.68.14.42.08.88-.16 1.24l-.42.62c-.1.14-.1.34 0 .48.46.68 1.06 1.28 1.74 1.74.14.1.34.1.48 0l.62-.42c.36-.24.82-.3 1.24-.16.26.08.5.16.68.22.36.12.6.46.6.84v2.5c0 .2-.04.4-.14.58z"/>
          </svg>
          Viber
        </a>
        <a
          href="https://wa.me/380661031094"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-[12px] border border-gray-200 bg-white px-4 py-3 text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 14.34c-.24.46-.76.76-1.28.76-.2 0-.4-.04-.58-.12l-2.34-.94c-.18-.07-.38-.04-.54.06l-.82.52c-.14.09-.32.08-.46-.02-.62-.46-1.56-1.14-2.36-1.94-.8-.8-1.48-1.74-1.94-2.36-.1-.14-.11-.32-.02-.46l.52-.82c.1-.16.13-.36.06-.54l-.94-2.34c-.08-.18-.12-.38-.12-.58 0-.52.3-1.04.76-1.28.18-.1.38-.14.58-.14h2.5c.38 0 .72.24.84.6.06.18.14.42.22.68.14.42.08.88-.16 1.24l-.42.62c-.1.14-.1.34 0 .48.46.68 1.06 1.28 1.74 1.74.14.1.34.1.48 0l.62-.42c.36-.24.82-.3 1.24-.16.26.08.5.16.68.22.36.12.6.46.6.84v2.5c0 .2-.04.4-.14.58z"/>
          </svg>
          WhatsApp
        </a>
      </div>
      <button
        type="button"
        onClick={() => {}}
        className="flex h-[48px] w-full items-center justify-center rounded-[12px] bg-black text-[15px] font-semibold text-white transition-colors hover:bg-gray-800"
      >
        Зрозуміло
      </button>
    </>
  );
}

export function BlogModalContent() {
  return (
    <>
      <div className="flex justify-center mb-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
      </div>
      <p className="modal-body-text text-center">
        Ми активно працюємо над цим розділом. Дякуємо за розуміння!
      </p>
    </>
  );
}
