'use client';

import { useEffect, useRef } from 'react';

const MOBILE_MEDIA_QUERY = '(max-width: 639px)';
const KEYBOARD_HEIGHT_THRESHOLD = 120;
const FOCUSABLE_FIELD_SELECTOR = 'input:not([type="hidden"]), textarea, select';

function isFormField(value: EventTarget | Element | null): value is HTMLElement {
  return value instanceof HTMLElement && value.matches(FOCUSABLE_FIELD_SELECTOR);
}

export function useCartViewport(open: boolean) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const viewportNode = viewportRef.current;
    const scrollNode = scrollRef.current;
    if (!viewportNode || !scrollNode) return;

    const media = window.matchMedia(MOBILE_MEDIA_QUERY);
    const visualViewport = window.visualViewport;
    let animationFrame = 0;
    let keyboardOpen = false;
    let restoreScrollTop: number | null = null;
    let baselineHeight = visualViewport?.height ?? window.innerHeight;

    const keepFieldVisible = (field: HTMLElement) => {
      const scrollRect = scrollNode.getBoundingClientRect();
      const fieldRect = field.getBoundingClientRect();
      const edgeGap = 16;
      let delta = 0;

      if (fieldRect.top < scrollRect.top + edgeGap) {
        delta = fieldRect.top - scrollRect.top - edgeGap;
      } else if (fieldRect.bottom > scrollRect.bottom - edgeGap) {
        delta = fieldRect.bottom - scrollRect.bottom + edgeGap;
      }

      if (Math.abs(delta) > 1) {
        scrollNode.scrollBy({ top: delta, behavior: 'smooth' });
      }
    };

    const updateViewport = () => {
      animationFrame = 0;
      if (!media.matches) {
        viewportNode.style.removeProperty('height');
        viewportNode.style.removeProperty('top');
        viewportNode.dataset.softKeyboardOpen = 'false';
        keyboardOpen = false;
        restoreScrollTop = null;
        return;
      }

      const visibleHeight = visualViewport?.height ?? window.innerHeight;
      const visibleTop = visualViewport?.offsetTop ?? 0;
      const nextKeyboardOpen = baselineHeight - visibleHeight > KEYBOARD_HEIGHT_THRESHOLD;
      viewportNode.dataset.softKeyboardOpen = nextKeyboardOpen ? 'true' : 'false';
      viewportNode.style.height = `${Math.round(visibleHeight)}px`;
      viewportNode.style.top = `${Math.max(0, Math.round(visibleTop))}px`;

      if (!nextKeyboardOpen && !keyboardOpen) {
        baselineHeight = Math.max(baselineHeight, visibleHeight);
      }
      if (nextKeyboardOpen && !keyboardOpen && restoreScrollTop === null) {
        restoreScrollTop = scrollNode.scrollTop;
      }
      if (!nextKeyboardOpen && keyboardOpen && restoreScrollTop !== null) {
        const targetScrollTop = restoreScrollTop;
        restoreScrollTop = null;
        window.requestAnimationFrame(() => {
          scrollNode.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
        });
      }
      keyboardOpen = nextKeyboardOpen;

      if (keyboardOpen && isFormField(document.activeElement)) {
        keepFieldVisible(document.activeElement);
      }
    };

    const scheduleViewportUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateViewport);
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!isFormField(event.target)) return;
      const field = event.target;
      if (!keyboardOpen && restoreScrollTop === null) {
        restoreScrollTop = scrollNode.scrollTop;
      }
      window.requestAnimationFrame(() => keepFieldVisible(field));
    };

    const handleFocusOut = () => {
      window.setTimeout(() => {
        if (!keyboardOpen && !isFormField(document.activeElement)) {
          restoreScrollTop = null;
        }
      }, 0);
    };

    updateViewport();
    viewportNode.addEventListener('focusin', handleFocusIn);
    viewportNode.addEventListener('focusout', handleFocusOut);
    window.addEventListener('resize', scheduleViewportUpdate, { passive: true });
    media.addEventListener('change', scheduleViewportUpdate);
    visualViewport?.addEventListener('resize', scheduleViewportUpdate, { passive: true });
    visualViewport?.addEventListener('scroll', scheduleViewportUpdate, { passive: true });

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      viewportNode.removeEventListener('focusin', handleFocusIn);
      viewportNode.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('resize', scheduleViewportUpdate);
      media.removeEventListener('change', scheduleViewportUpdate);
      visualViewport?.removeEventListener('resize', scheduleViewportUpdate);
      visualViewport?.removeEventListener('scroll', scheduleViewportUpdate);
      viewportNode.style.removeProperty('height');
      viewportNode.style.removeProperty('top');
      delete viewportNode.dataset.softKeyboardOpen;
    };
  }, [open]);

  return { viewportRef, scrollRef };
}
