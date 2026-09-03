'use client';

import { Play } from 'lucide-react';
import { useState } from 'react';
import ManagedProductImage from '@/components/ManagedProductImage';

interface MagneticSystemVideoProps {
  videoSrc: string;
  posterSrc: string;
  fallbackPosterSrc: string;
  isPosterPlaceholder: boolean;
  alt: string;
}

export default function MagneticSystemVideo({
  videoSrc,
  posterSrc,
  fallbackPosterSrc,
  isPosterPlaceholder,
  alt,
}: MagneticSystemVideoProps) {
  const [isActivated, setIsActivated] = useState(false);
  const [hasVideoError, setHasVideoError] = useState(false);
  const canPlayVideo = Boolean(videoSrc) && !hasVideoError;

  if (isActivated && canPlayVideo) {
    return (
      <video
        autoPlay
        controls
        playsInline
        preload="metadata"
        poster={posterSrc}
        className="h-full w-full bg-black object-cover"
        aria-label={`Відео: ${alt}`}
        onError={() => setHasVideoError(true)}
      >
        <source src={videoSrc} />
      </video>
    );
  }

  return (
    <div
      className="relative h-full w-full bg-[#080808]"
      data-magnetic-system-media
      data-video-configured={canPlayVideo ? 'true' : 'false'}
    >
      <ManagedProductImage
        src={posterSrc}
        fallbackSrc={fallbackPosterSrc}
        isPlaceholder={isPosterPlaceholder}
        alt={alt}
        width={1200}
        height={900}
        sizes="(max-width: 1023px) 100vw, 50vw"
        className="h-full w-full"
      />

      {canPlayVideo ? (
        <button
          type="button"
          onClick={() => setIsActivated(true)}
          className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/50 bg-black/65 text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ce4ab] focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transition-none sm:h-16 sm:w-16"
          aria-label={`Відтворити відео: ${alt}`}
        >
          <Play className="ml-1 h-6 w-6 fill-current sm:h-7 sm:w-7" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
