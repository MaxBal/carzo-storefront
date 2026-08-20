'use client';

import { useEffect, useRef } from 'react';

const MOBILE_MEDIA_QUERY = '(max-width: 639px)';
const MIN_KEYBOARD_HEIGHT = 120;
const KEYBOARD_HEIGHT_RATIO = 0.2;
const VIEWPORT_WIDTH_EPSILON = 1;
const FIELD_EDGE_GAP = 16;
const MIN_DROPDOWN_RESULTS_SPACE = 136;
const TEXT_INPUT_TYPES = new Set([
  'email',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'url',
]);

function editableFieldInside(
  value: EventTarget | Element | null,
  viewportNode: HTMLElement,
): HTMLElement | null {
  if (!(value instanceof HTMLElement) || !viewportNode.contains(value)) return null;

  if (value instanceof HTMLInputElement) {
    return !value.disabled && !value.readOnly && TEXT_INPUT_TYPES.has(value.type)
      ? value
      : null;
  }

  if (value instanceof HTMLTextAreaElement) {
    return !value.disabled && !value.readOnly ? value : null;
  }

  const contentEditable = value.closest<HTMLElement>('[contenteditable]:not([contenteditable="false"])');
  if (
    contentEditable
    && viewportNode.contains(contentEditable)
    && contentEditable.getAttribute('aria-disabled') !== 'true'
    && contentEditable.getAttribute('aria-readonly') !== 'true'
  ) {
    return contentEditable;
  }

  return null;
}

export function useCartViewport(open: boolean, checkoutActive = false) {
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
    let fieldVisibilityFrame = 0;
    let focusOutTimer = 0;
    let keyboardOpen = false;
    let baselineHeight = visualViewport?.height ?? window.innerHeight;
    let baselineWidth = visualViewport?.width ?? window.innerWidth;
    let previousMobileMatch = media.matches;
    let baselineResetPending = false;

    viewportNode.dataset.checkoutActive = checkoutActive ? 'true' : 'false';

    const keepFieldVisible = (field: HTMLElement) => {
      const scrollRect = scrollNode.getBoundingClientRect();
      const fieldRect = field.getBoundingClientRect();
      const searchableDropdown = field.closest<HTMLElement>('[data-keyboard-dropdown]');
      let delta = 0;

      if (searchableDropdown && scrollNode.contains(searchableDropdown)) {
        if (fieldRect.top < scrollRect.top + FIELD_EDGE_GAP) {
          delta = fieldRect.top - scrollRect.top - FIELD_EDGE_GAP;
        } else {
          // Keep room for roughly three delivery options without moving an
          // already well-positioned field all the way to the top.
          const availableBelow = scrollRect.bottom - FIELD_EDGE_GAP - fieldRect.bottom;
          const availableAbove = fieldRect.top - scrollRect.top - FIELD_EDGE_GAP;
          if (availableBelow < MIN_DROPDOWN_RESULTS_SPACE && availableAbove > 0) {
            delta = Math.min(MIN_DROPDOWN_RESULTS_SPACE - availableBelow, availableAbove);
          }
        }
      } else if (fieldRect.top < scrollRect.top + FIELD_EDGE_GAP) {
        delta = fieldRect.top - scrollRect.top - FIELD_EDGE_GAP;
      } else if (fieldRect.bottom > scrollRect.bottom - FIELD_EDGE_GAP) {
        delta = fieldRect.bottom - scrollRect.bottom + FIELD_EDGE_GAP;
      }

      if (Math.abs(delta) > 1) {
        scrollNode.scrollBy({ top: delta, behavior: 'smooth' });
      }
    };

    const scheduleFieldVisibility = (field: HTMLElement) => {
      if (fieldVisibilityFrame) window.cancelAnimationFrame(fieldVisibilityFrame);
      fieldVisibilityFrame = window.requestAnimationFrame(() => {
        fieldVisibilityFrame = 0;
        const activeField = editableFieldInside(document.activeElement, viewportNode);
        if (keyboardOpen && activeField === field) keepFieldVisible(field);
      });
    };

    const updateViewport = () => {
      animationFrame = 0;
      const visibleHeight = visualViewport?.height ?? window.innerHeight;
      const visibleWidth = visualViewport?.width ?? window.innerWidth;
      const visibleTop = visualViewport?.offsetTop ?? 0;
      const mobileMatch = media.matches;
      const widthChanged = Math.abs(visibleWidth - baselineWidth) > VIEWPORT_WIDTH_EPSILON;

      if (baselineResetPending || mobileMatch !== previousMobileMatch || widthChanged) {
        baselineHeight = visibleHeight;
        baselineWidth = visibleWidth;
        baselineResetPending = false;
        keyboardOpen = false;
      }
      previousMobileMatch = mobileMatch;

      if (!media.matches) {
        viewportNode.style.removeProperty('height');
        viewportNode.style.removeProperty('top');
        viewportNode.dataset.softKeyboardOpen = 'false';
        keyboardOpen = false;
        return;
      }

      const focusedEditable = editableFieldInside(document.activeElement, viewportNode);
      const keyboardHeightThreshold = Math.max(
        MIN_KEYBOARD_HEIGHT,
        baselineHeight * KEYBOARD_HEIGHT_RATIO,
      );
      const viewportShrunk = baselineHeight - visibleHeight > keyboardHeightThreshold;
      const nextKeyboardOpen = checkoutActive
        && viewportShrunk
        && (focusedEditable !== null || keyboardOpen);

      viewportNode.dataset.softKeyboardOpen = nextKeyboardOpen ? 'true' : 'false';
      viewportNode.style.height = `${Math.round(visibleHeight)}px`;
      viewportNode.style.top = `${Math.max(0, Math.round(visibleTop))}px`;

      if (!viewportShrunk && !keyboardOpen) {
        baselineHeight = Math.max(baselineHeight, visibleHeight);
      }
      keyboardOpen = nextKeyboardOpen;

      if (keyboardOpen && focusedEditable) scheduleFieldVisibility(focusedEditable);
    };

    const scheduleViewportUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateViewport);
    };

    const handleFocusIn = (event: FocusEvent) => {
      const field = editableFieldInside(event.target, viewportNode);
      if (!field) return;
      scheduleViewportUpdate();
      if (keyboardOpen) scheduleFieldVisibility(field);
    };

    const handleFocusOut = () => {
      if (focusOutTimer) window.clearTimeout(focusOutTimer);
      focusOutTimer = window.setTimeout(() => {
        focusOutTimer = 0;
        scheduleViewportUpdate();
      }, 0);
    };

    const handleMediaChange = () => {
      baselineResetPending = true;
      scheduleViewportUpdate();
    };

    const handleOrientationChange = () => {
      baselineResetPending = true;
      scheduleViewportUpdate();
    };

    updateViewport();
    viewportNode.addEventListener('focusin', handleFocusIn);
    viewportNode.addEventListener('focusout', handleFocusOut);
    window.addEventListener('resize', scheduleViewportUpdate, { passive: true });
    window.addEventListener('orientationchange', handleOrientationChange, { passive: true });
    media.addEventListener('change', handleMediaChange);
    visualViewport?.addEventListener('resize', scheduleViewportUpdate, { passive: true });
    visualViewport?.addEventListener('scroll', scheduleViewportUpdate, { passive: true });

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (fieldVisibilityFrame) window.cancelAnimationFrame(fieldVisibilityFrame);
      if (focusOutTimer) window.clearTimeout(focusOutTimer);
      viewportNode.removeEventListener('focusin', handleFocusIn);
      viewportNode.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('resize', scheduleViewportUpdate);
      window.removeEventListener('orientationchange', handleOrientationChange);
      media.removeEventListener('change', handleMediaChange);
      visualViewport?.removeEventListener('resize', scheduleViewportUpdate);
      visualViewport?.removeEventListener('scroll', scheduleViewportUpdate);
      viewportNode.style.removeProperty('height');
      viewportNode.style.removeProperty('top');
      delete viewportNode.dataset.softKeyboardOpen;
      delete viewportNode.dataset.checkoutActive;
    };
  }, [checkoutActive, open]);

  return { viewportRef, scrollRef };
}
