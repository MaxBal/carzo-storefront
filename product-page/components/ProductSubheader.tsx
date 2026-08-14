'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import DesignSelectorModal from './DesignSelectorModal';
import type { DesignInfo } from '@/lib/content/types';

const DEFAULT_HEADER_HEIGHT = 56;
const IOS_IN_APP_FIXED_TOP_OFFSET = 96;

function isIOSDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isIOSInAppBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (!isIOSDevice()) return false;
  const isKnownInApp =
    /Instagram|Telegram|FBAN|FBAV|FB_IAB|Line|TikTok|MicroMessenger|Twitter|LinkedInApp/i.test(ua);
  const isIOSWebView =
    /AppleWebKit/i.test(ua) && /Mobile/i.test(ua) && !/Safari/i.test(ua);
  return isKnownInApp || isIOSWebView;
}

function getIOSInAppTopOffset() {
  if (typeof window === 'undefined') return 0;
  if (!isIOSInAppBrowser()) return 0;
  const visualViewportOffset = window.visualViewport?.offsetTop || 0;
  return Math.max(visualViewportOffset, IOS_IN_APP_FIXED_TOP_OFFSET);
}

interface ProductSubheaderProps {
  inFlow?: boolean;
  designSlug: string;
  designs: DesignInfo[];
  designInfoText: string;
}

export default function ProductSubheader({
  inFlow = false,
  designSlug,
  designs,
  designInfoText,
}: ProductSubheaderProps) {
  const subheaderRef = useRef<HTMLDivElement | null>(null);
  const [isFixed, setIsFixed] = useState(false);
  const [subheaderHeight, setSubheaderHeight] = useState(44);
  const [topOffset, setTopOffset] = useState(0);
  const [designModalOpen, setDesignModalOpen] = useState(false);

  const design = designs.find(item => item.slug === designSlug);
  const versionLabel = design?.version ?? '2.0';

  useEffect(() => {
    if (inFlow) return;

    const updateSubheaderHeight = () => {
      if (!subheaderRef.current) return;
      const height = subheaderRef.current.getBoundingClientRect().height;
      if (height > 0) setSubheaderHeight(height);
    };

    updateSubheaderHeight();
    const resizeObserver = new ResizeObserver(updateSubheaderHeight);
    if (subheaderRef.current) resizeObserver.observe(subheaderRef.current);
    return () => resizeObserver.disconnect();
  }, [inFlow]);

  useEffect(() => {
    if (inFlow) return;

    let ticking = false;

    const updateState = () => {
      const mainHeader = document.querySelector('header');
      let shouldBeFixed = false;
      if (mainHeader) {
        shouldBeFixed = mainHeader.getBoundingClientRect().bottom <= 0;
      } else {
        shouldBeFixed = window.scrollY >= DEFAULT_HEADER_HEIGHT;
      }
      setIsFixed(shouldBeFixed);
      setTopOffset(shouldBeFixed ? getIOSInAppTopOffset() : 0);
      ticking = false;
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateState);
    };

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    window.visualViewport?.addEventListener('resize', requestUpdate);
    window.visualViewport?.addEventListener('scroll', requestUpdate);
    updateState();

    return () => {
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      window.visualViewport?.removeEventListener('resize', requestUpdate);
      window.visualViewport?.removeEventListener('scroll', requestUpdate);
    };
  }, [inFlow]);

  const subheaderContent = (
    <div className="max-w-[1280px] mx-auto px-4 flex items-center justify-between h-11">
      <div className="flex items-center gap-2">
        <div
          className="rounded-full flex-shrink-0"
          style={{
            width: 8,
            height: 8,
            background: '#28c5a6',
            boxShadow: '0 0 6px 2px rgba(40,197,166,0.55)',
          }}
        />
        <span className="text-white font-medium text-sm">Дизайн {versionLabel}</span>
      </div>
      <button
        className="flex items-center gap-1.5 text-sm font-medium rounded-full px-3 py-1 transition-colors"
        style={{ color: '#28c5a6', border: '1px solid #28c5a6' }}
        onClick={() => setDesignModalOpen(true)}
      >
        Усі дизайни
        <ChevronDown size={14} />
      </button>
    </div>
  );

  // In-flow mode (mobile): plain block, no scroll logic, no spacer
  if (inFlow) {
    return (
      <>
        {designModalOpen && (
          <DesignSelectorModal
            onClose={() => setDesignModalOpen(false)}
            currentDesign={designSlug}
            designs={designs}
            designInfoText={designInfoText}
          />
        )}
        <div
          ref={subheaderRef}
          className="bg-[#181818] border-b border-[#222]"
          style={{ position: 'relative', zIndex: 50 }}
          data-fixed="false"
          data-ios-in-app="false"
        >
          {subheaderContent}
        </div>
      </>
    );
  }

  // Desktop mode: full fixed/sticky scroll behavior
  const subheaderStyle: React.CSSProperties = isFixed
    ? {
        position: 'fixed',
        top:
          topOffset > 0
            ? `calc(env(safe-area-inset-top, 0px) + ${topOffset}px)`
            : '0px',
        left: 0,
        right: 0,
        zIndex: 9999,
      }
    : {
        position: 'relative',
        zIndex: 50,
      };

  return (
    <>
      {designModalOpen && (
        <DesignSelectorModal
          onClose={() => setDesignModalOpen(false)}
          currentDesign={designSlug}
          designs={designs}
          designInfoText={designInfoText}
        />
      )}
      {isFixed && <div style={{ height: subheaderHeight }} aria-hidden="true" />}

      <div
        ref={subheaderRef}
        className="bg-[#181818] border-b border-[#222]"
        style={subheaderStyle}
        data-fixed={isFixed ? 'true' : 'false'}
        data-ios-in-app={isIOSInAppBrowser() ? 'true' : 'false'}
      >
        {subheaderContent}
      </div>
    </>
  );
}
