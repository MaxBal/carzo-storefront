'use client';

import { useEffect, useState, useRef } from 'react';
import type { GalleryImage } from '@/lib/content/types';
import ManagedProductImage from '@/components/ManagedProductImage';

interface ProductGalleryProps {
  images: GalleryImage[];
}

export default function ProductGallery({ images }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const firstImageKey = images[0]?.key;

  useEffect(() => {
    setActive(0);
  }, [firstImageKey]);

  if (images.length === 0) return null;
  const activeImage = images[Math.min(active, images.length - 1)];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 30) return;
    if (delta < 0) {
      setActive(prev => Math.min(prev + 1, images.length - 1));
    } else {
      setActive(prev => Math.max(prev - 1, 0));
    }
  };

  return (
    <>
      {/* Desktop gallery */}
      <div className="hidden md:flex gap-3 flex-1" style={{ minWidth: 0 }}>
        {/* Thumbnails column */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          {images.map((image, i) => (
            <button
              key={image.key}
              onClick={() => setActive(i)}
              className="relative overflow-hidden rounded-[8px]"
              style={{
                width: 80,
                height: 80,
                border: i === active ? '2px solid #2DD4BF' : '2px solid #e5e7eb',
                flexShrink: 0,
              }}
            >
              <ManagedProductImage
                src={image.src}
                fallbackSrc={image.fallbackSrc}
                isPlaceholder={image.isPlaceholder}
                alt={image.alt}
                fill
              />
            </button>
          ))}
        </div>

        {/* Main image — square */}
        <div className="relative flex-1 rounded-[12px] overflow-hidden bg-gray-100 aspect-square">
          <ManagedProductImage
            src={activeImage.src}
            fallbackSrc={activeImage.fallbackSrc}
            isPlaceholder={activeImage.isPlaceholder}
            alt={activeImage.alt}
            fill
            priority
          />
        </div>
      </div>

      {/* Mobile gallery — full width, touch swipe */}
      <div
        className="md:hidden relative w-full overflow-hidden bg-gray-100 aspect-square"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Slide strip */}
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ width: `${images.length * 100}%`, transform: `translateX(-${active * (100 / images.length)}%)` }}
        >
          {images.map((image, i) => (
            <div key={image.key} className="relative h-full flex-shrink-0" style={{ width: `${100 / images.length}%` }}>
              <ManagedProductImage
                src={image.src}
                fallbackSrc={image.fallbackSrc}
                isPlaceholder={image.isPlaceholder}
                alt={image.alt}
                fill
                priority={i === 0}
              />
            </div>
          ))}
        </div>

        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-white rounded-full px-2.5 py-1.5 flex items-center gap-1.5 shadow-sm">
            {images.map((image, i) => (
              <button
                key={image.key}
                onClick={() => setActive(i)}
                aria-label={`Показати фото ${i + 1}`}
                aria-current={i === active ? 'true' : undefined}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === active ? 20 : 8,
                  height: 8,
                  backgroundColor: i === active ? '#2DD4BF' : '#d1d5db',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
