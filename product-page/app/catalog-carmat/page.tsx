"use client";

import { useState } from "react";
import VideoModal from "@/components/VideoModal";
import '@/app/carmat.css';

/* ── Inline SVG helpers ── */
const PlayIcon = () => (
  <svg viewBox="0 0 24 24">
    <polygon points="8,5 20,12 8,19" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="cm-feat-svg" viewBox="0 0 24 24">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="cm-feat-svg" viewBox="0 0 24 24">
    <path d="M9 12l2 2 4-4" />
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const ClockIcon = () => (
  <svg className="cm-feat-svg" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const InfoIcon = () => (
  <svg viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);

export default function CarmatPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      {/* ── Hero ── */}
      <section className="cm-hero">
        {/* Cover */}
        <div className="cm-cover">
          <img
            className="cm-cover-img cm-cover-img--mobile"
            src="/carmat-mobile.png"
            alt="Автокилимки Carzo — мобільна обкладинка"
            draggable={false}
          />
          <img
            className="cm-cover-img cm-cover-img--desktop"
            src="/carmat-desktop.jpeg"
            alt="Автокилимки Carzo — десктоп обкладинка"
            draggable={false}
          />
          <span className="cm-cover-gradient" />
          <button
            className="cm-play"
            aria-label="Відтворити відео"
            onClick={() => setModalOpen(true)}
          >
            <PlayIcon />
          </button>
        </div>

        {/* Content */}
        <div className="cm-content">
          {/* Badges */}
          <div className="cm-badges">
            <span className="cm-badge">
              <span className="cm-badge-dot" />
              ПРЕМІУМ ЯКІСТЬ
            </span>
            <span className="cm-badge">
              <span className="cm-badge-dot" />
              MAX ЗНОСОСТІЙКІСТЬ
            </span>
          </div>

          {/* H1 */}
          <h1 className="cm-h1">Автокилимки&nbsp;Carzo</h1>

          {/* Features */}
          <ul className="cm-features">
            <li>
              <span className="cm-feat-icon" aria-hidden="true">
                <img src="/flag-de.svg" alt="" width="16" height="12" className="inline-block" />
              </span>
              Німецька автомобільна еко-шкіра
            </li>
            <li>
              <ShieldIcon />
              Розраховані для щоденної експлуатації роками
            </li>
            <li>
              <CheckIcon />
              Якість пошиття та точність лекал
            </li>
            <li>
              <ClockIcon />
              Виготовлення 7–10 робочих днів
            </li>
          </ul>

          {/* Design block */}
          <div className="cm-design-block">
            <div className="cm-design-row">
              <span className="cm-design-label">Дизайни</span>
              <span className="cm-design-link">див.&nbsp;фото</span>
            </div>
            <div className="cm-design-info">
              <InfoIcon />
              <span>виготовляємо тільки в чорному кольорі</span>
            </div>
          </div>

          {/* CTA */}
          <button className="cm-cta" type="button">
            Розрахувати вартість
          </button>
        </div>
      </section>

      {/* ── Video Modal ── */}
      <VideoModal
        src="/carmat-video.mov"
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
