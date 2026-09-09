'use client';

import { Play } from 'lucide-react';
import { useRef, useState } from 'react';

interface InlineVideoPlayerProps {
  src: string;
  poster?: string;
  alt: string;
}

export default function InlineVideoPlayer({ src, poster, alt }: InlineVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const handlePlay = () => {
    setStarted(true);
    setTimeout(() => videoRef.current?.play().catch(() => {}), 0);
  };

  if (!src) return null;

  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-[12px] bg-[#080808]"
      style={{ aspectRatio: '16/9', minHeight: 180 }}
    >
      {started ? (
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          preload="metadata"
          className="h-full w-full object-contain"
          aria-label={alt}
        />
      ) : (
        <>
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt={alt}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : null}
          <button
            type="button"
            onClick={handlePlay}
            className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/50 bg-black/65 text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ce4ab] focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transition-none sm:h-16 sm:w-16"
            aria-label={`Відтворити відео: ${alt}`}
          >
            <Play className="ml-1 h-6 w-6 fill-current sm:h-7 sm:w-7" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
