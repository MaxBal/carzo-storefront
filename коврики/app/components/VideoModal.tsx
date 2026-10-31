"use client";

import { useEffect, useCallback, useRef } from "react";

interface VideoModalProps {
  src: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoModal({ src, isOpen, onClose }: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  /* lock body scroll while open */
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  /* close on Escape */
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, handleKey]);

  /* pause video on close */
  useEffect(() => {
    if (!isOpen && videoRef.current) {
      videoRef.current.pause();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="vm-overlay" onClick={onClose}>
      <button
        className="vm-close"
        onClick={onClose}
        aria-label="Закрити відео"
      >
        <svg viewBox="0 0 24 24" width="28" height="28">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="vm-wrapper" onClick={(e) => e.stopPropagation()}>
        <video
          ref={videoRef}
          className="vm-video"
          src={src}
          controls
          playsInline
          preload="metadata"
        />
      </div>
    </div>
  );
}
