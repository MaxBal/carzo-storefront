'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';

type ManagedProductImageProps = Omit<ImageProps, 'src' | 'onError' | 'placeholder'> & {
  src: string;
  fallbackSrc: string;
  isPlaceholder?: boolean;
};

export default function ManagedProductImage({
  src,
  fallbackSrc,
  isPlaceholder = false,
  className,
  ...props
}: ManagedProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showingPlaceholder = isPlaceholder || !src || failedSrc === src;
  const currentSrc = showingPlaceholder ? fallbackSrc : src;

  return (
    <Image
      {...props}
      src={currentSrc}
      className={`${className ?? ''} ${showingPlaceholder ? 'object-contain p-6' : 'object-cover'}`}
      unoptimized
      onError={() => {
        if (!showingPlaceholder) setFailedSrc(src);
      }}
    />
  );
}
