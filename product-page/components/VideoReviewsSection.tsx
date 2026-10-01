'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, X } from 'lucide-react';
import type { VideoReviewsData, VideoReviewItem } from '@/lib/content/types';

interface VideoReviewsSectionProps {
  data: VideoReviewsData;
}

function VideoOverlay({ item, onClose }: { item: VideoReviewItem; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    videoRef.current?.play().catch(() => {});
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="vr-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={item.title || 'Відеовідгук'}
      onClick={onClose}
    >
      <button type="button" className="vr-overlay-close" onClick={onClose} aria-label="Закрити">
        <X size={22} strokeWidth={2.2} />
      </button>
      <div className="vr-overlay-stage" onClick={e => e.stopPropagation()}>
        <video
          ref={videoRef}
          className="vr-overlay-video"
          src={item.videoUrl}
          poster={item.coverUrl}
          playsInline
          controls
          autoPlay
        />
      </div>
    </div>
  );
}

function VideoCard({ item, onPlay }: {
  item: VideoReviewItem;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      className="vr-card"
      onClick={onPlay}
      aria-label={item.title || 'Відеовідгук'}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="vr-card-media"
        src={item.coverUrl}
        alt={item.title || 'Відеовідгук клієнта'}
        loading="lazy"
        draggable={false}
      />
      <span className="vr-play" aria-hidden="true">
        <Play className="vr-play-icon" strokeWidth={2} />
      </span>
    </button>
  );
}

export default function VideoReviewsSection({ data }: VideoReviewsSectionProps) {
  const [activeItem, setActiveItem] = useState<VideoReviewItem | null>(null);
  const videos = data.videos;

  if (!data.enabled || videos.length === 0) return null;

  return (
    <section id="product-reviews" className="vr-root" aria-label={data.title}>
      <div className="vr-inner">
        <h2 className="vr-title">{data.title}</h2>

        <div className="vr-scroller">
          <div className="vr-track">
            {videos.map(item => (
              <VideoCard
                key={item.id}
                item={item}
                onPlay={() => setActiveItem(item)}
              />
            ))}
          </div>
        </div>

        <div className="vr-social">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="vr-badge"
            src={data.socialBadgeUrl}
            alt=""
            width={44}
            height={44}
            loading="lazy"
          />
          <div className="vr-social-copy">
            <div className="vr-social-row">
              <span className="vr-handle">{data.socialHandle}</span>
              {data.socialVerified ? (
                <svg className="vr-verified" width="22" height="22" viewBox="0 0 24 24" aria-label="Verified" fill="none">
                  <circle cx="12" cy="12" r="11" fill="#1d9bf0" />
                  <path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </div>
            <p className="vr-social-text">{data.socialText}</p>
          </div>
        </div>

        <div className="vr-stats">
          {data.stats.map((stat, index) => (
            <div key={`${stat.value}-${index}`} className="vr-stat">
              <div className="vr-stat-value">{stat.value}</div>
              <div className="vr-stat-text">{stat.text}</div>
              {index < data.stats.length - 1 ? <div className="vr-stat-divider" /> : null}
            </div>
          ))}
        </div>
      </div>

      {activeItem ? (
        <VideoOverlay item={activeItem} onClose={() => setActiveItem(null)} />
      ) : null}
    </section>
  );
}
