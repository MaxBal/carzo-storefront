'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';

interface MobileStickyBuyProps {
  label: string;
  onBuy: () => void;
  /** Main static CTA button; sticky shows only after it fully leaves the viewport upward */
  triggerSelector?: string;
  disabled?: boolean;
}

export default function MobileStickyBuy({
  label,
  onBuy,
  triggerSelector = '[data-product-buy]',
  disabled = false,
}: MobileStickyBuyProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      // Desktop + mobile layouts both render ProductOptions; pick the visible buy button.
      const buttons = Array.from(document.querySelectorAll(triggerSelector));
      const el = buttons.find(node => (node as HTMLElement).getClientRects().length > 0);
      if (!el) {
        setVisible(false);
        return;
      }
      const rect = el.getBoundingClientRect();
      // Sticky only after the real static CTA has fully scrolled above the viewport.
      // Hidden layout nodes report bottom=0 — ignore them via getClientRects() above.
      setVisible(rect.height > 0 && rect.bottom <= 0);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [triggerSelector]);

  return (
    <div className={`msb-root ${visible ? 'is-visible' : ''}`} aria-hidden={!visible}>
      <button
        type="button"
        className="msb-btn"
        onClick={onBuy}
        disabled={disabled || !visible}
        tabIndex={visible ? 0 : -1}
      >
        <ShoppingCart size={19} strokeWidth={2} />
        {label}
      </button>
    </div>
  );
}
