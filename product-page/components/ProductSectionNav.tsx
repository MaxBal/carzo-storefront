'use client';

import { useState } from 'react';

type NavKey = 'description' | 'reviews';

interface ProductSectionNavProps {
  descriptionId?: string;
  reviewsId?: string;
  headerOffset?: number;
}

export default function ProductSectionNav({
  descriptionId = 'product-description',
  reviewsId = 'product-reviews',
  headerOffset = 72,
}: ProductSectionNavProps) {
  const [active, setActive] = useState<NavKey>('description');

  const goTo = (key: NavKey) => {
    setActive(key);
    const el = document.getElementById(key === 'description' ? descriptionId : reviewsId);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <nav className="psn-root" aria-label="Навігація по сторінці товару">
      <button
        type="button"
        className={`psn-item ${active === 'description' ? 'is-active' : ''}`}
        onClick={() => goTo('description')}
        aria-current={active === 'description' ? 'true' : undefined}
      >
        Опис
      </button>
      <button
        type="button"
        className={`psn-item ${active === 'reviews' ? 'is-active' : ''}`}
        onClick={() => goTo('reviews')}
        aria-current={active === 'reviews' ? 'true' : undefined}
      >
        Відгуки
      </button>
    </nav>
  );
}
