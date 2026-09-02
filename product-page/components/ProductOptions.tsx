'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Camera, ShoppingCart, Magnet, Check, ArrowUpRight, ChevronRight, Info } from 'lucide-react';
import BenefitCards from './BenefitCards';
import InfoModal from './InfoModal';
import LogoModal from './LogoModal';
import {
  getBrandById,
  getFixationByValue,
  buildProductUrl,
  buildProductTitle,
} from '@/lib/product-data';
import type { ProductParams, ResolvedProductContent, SizeId } from '@/lib/content/types';
import { useCart } from '@/components/cart/cart-context';

const selectClasses =
  'w-full appearance-none rounded-[12px] border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-[#111111] cursor-pointer focus:border-gray-400 focus:outline-none';

const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)';
const GALLERY_SUBJECT_START_RATIO = 0.18;
const GALLERY_LEAD_IN_RATIO = 0.06;
const GALLERY_SCROLL_REQUEST_TTL_MS = 4000;

interface PendingGalleryScroll {
  selection: string;
  expiresAt: number;
}

let pendingMobileGalleryScroll: PendingGalleryScroll | null = null;

function gallerySelectionKey(designSlug: string, size: SizeId) {
  return `${designSlug}:${size}`;
}

function scrollToUpdatedMobileGallery(expectedSelection: string) {
  const galleries = Array.from(
    document.querySelectorAll<HTMLElement>('[data-product-gallery="mobile"]'),
  );
  const gallery = galleries.find(element => (
    element.dataset.gallerySelection === expectedSelection
    && element.getBoundingClientRect().height > 0
  ));

  if (!gallery) return;

  const rect = gallery.getBoundingClientRect();
  const visualViewport = window.visualViewport;
  const viewportTop = visualViewport?.offsetTop ?? 0;
  const viewportHeight = visualViewport?.height ?? window.innerHeight;
  const headerRect = document.querySelector('header')?.getBoundingClientRect();
  const headerBottom = headerRect && headerRect.top <= viewportTop && headerRect.bottom > viewportTop
    ? headerRect.bottom
    : viewportTop;
  const visibleTop = Math.max(viewportTop, headerBottom);
  const usefulGalleryTop = rect.top + rect.height * GALLERY_SUBJECT_START_RATIO;
  const leadIn = rect.height * GALLERY_LEAD_IN_RATIO;

  // Keep the page still when the useful gallery zone is already visible or only
  // fractionally hidden. Size controls sit below the gallery, so scrolling is
  // intentionally limited to cases where that zone is above the viewport.
  if (usefulGalleryTop >= visibleTop - leadIn) return;
  if (usefulGalleryTop > viewportTop + viewportHeight) return;

  const targetTop = window.scrollY + usefulGalleryTop - visibleTop - leadIn;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({
    top: Math.max(0, targetTop),
    behavior: reduceMotion ? 'auto' : 'smooth',
  });
}

function SelectChevron() {
  return (
    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#777777]">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ConfiguratorHeading({ step, children }: { step: number; children: ReactNode }) {
  return (
    <span className="block min-w-0">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#777777]">
        Крок {step}
      </span>
      <span className="block truncate text-[16px] font-semibold tracking-[-0.02em] text-[#111111]">
        {children}
      </span>
    </span>
  );
}

// Persists across client-side navigations, resets on full page load.
let persistedFixation = 'none';

interface ProductOptionsProps {
  params: ProductParams;
  content: ResolvedProductContent;
}

export default function ProductOptions({ params, content }: ProductOptionsProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const { size, designSlug, brandId } = params;
  const { catalog, pricing, siteSettings, gallery } = content;

  const [selectedFixation, setSelectedFixation] = useState(persistedFixation);
  const [openModal, setOpenModal] = useState<'design' | 'size' | 'logo' | 'fixation' | null>(null);

  const designThumbnails = catalog.designs.map(design => {
    const firstGalleryImage = gallery
      .filter(img => img.designSlug === design.slug && !img.isPlaceholder)
      .sort((a, b) => a.sort - b.sort)[0];
    return {
      ...design,
      thumbnailSrc: firstGalleryImage?.src || design.selectorImage,
    };
  });

  // Keep local state in sync with the module-level persistence on param changes
  useEffect(() => {
    setSelectedFixation(persistedFixation);
  }, [size, designSlug, brandId]);

  useEffect(() => {
    const expectedSelection = gallerySelectionKey(designSlug, size);
    const pendingRequest = pendingMobileGalleryScroll;
    if (!pendingRequest) return;
    if (pendingRequest.expiresAt <= Date.now() || pendingRequest.selection !== expectedSelection) {
      if (pendingMobileGalleryScroll === pendingRequest) pendingMobileGalleryScroll = null;
      return;
    }
    if (!window.matchMedia(MOBILE_VIEWPORT_QUERY).matches) {
      pendingMobileGalleryScroll = null;
      return;
    }

    let firstFrame = 0;
    let secondFrame = 0;
    firstFrame = window.requestAnimationFrame(() => {
      if (pendingMobileGalleryScroll !== pendingRequest) return;
      secondFrame = window.requestAnimationFrame(() => {
        if (pendingMobileGalleryScroll !== pendingRequest) return;
        pendingMobileGalleryScroll = null;
        scrollToUpdatedMobileGallery(expectedSelection);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [designSlug, size]);

  const updateFixation = (value: string) => {
    persistedFixation = value;
    setSelectedFixation(value);
  };

  const fixData = getFixationByValue(selectedFixation, catalog);
  const selectedBrand = getBrandById(brandId, catalog);
  const brandSelected = !!selectedBrand && selectedBrand.id !== 'none';

  const basePrice = pricing.selectedVariant.price;
  const baseOldPrice = pricing.selectedVariant.oldPrice;
  const logoExtra = brandSelected && selectedBrand ? selectedBrand.price : 0;

  const currentPrice = basePrice + logoExtra + fixData.extra;
  const oldPrice = baseOldPrice + logoExtra + fixData.extra;

  const productTitle = buildProductTitle(params, catalog);
  const selectedDesign = catalog.designs.find(design => design.slug === designSlug);
  const selectedDesignVersion = selectedDesign?.version ?? designSlug.replace('-', '.');

  const navigate = (newParams: ProductParams) => {
    const url = buildProductUrl(newParams, catalog);
    router.push(url, { scroll: false });
  };

  const handleSizeChange = (newSize: SizeId) => {
    if (newSize === size) return;
    if (typeof window !== 'undefined' && window.matchMedia(MOBILE_VIEWPORT_QUERY).matches) {
      const pendingRequest = {
        selection: gallerySelectionKey(designSlug, newSize),
        expiresAt: Date.now() + GALLERY_SCROLL_REQUEST_TTL_MS,
      };
      pendingMobileGalleryScroll = pendingRequest;
      window.setTimeout(() => {
        if (pendingMobileGalleryScroll === pendingRequest) pendingMobileGalleryScroll = null;
      }, GALLERY_SCROLL_REQUEST_TTL_MS);
    }
    navigate({ size: newSize, designSlug, brandId });
  };

  const handleDesignChange = (newDesignSlug: string) => {
    if (newDesignSlug === designSlug) return;
    navigate({ size, designSlug: newDesignSlug, brandId });
  };

  const handleBrandChange = (newBrandId: string) => {
    navigate({ size, designSlug, brandId: newBrandId });
  };

  const handleBuy = () => {
    addItem({ size, designSlug, brandId, fixation: selectedFixation });
  };

  return (
    <>
      <div className="flex flex-col">
        {/* Title */}
        <h1 className="text-[28px] font-bold leading-[1.08] tracking-[-0.055em] text-[#080808] sm:text-[32px] lg:text-[38px]">
          {productTitle}
        </h1>

        {/* Key characteristics */}
        <section
          className="mt-3 grid grid-cols-[20px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2 rounded-[12px] border border-[#1A1A1A] bg-white px-3.5 py-3"
          aria-label="Ключові характеристики"
          data-product-characteristics
        >
          <span className="product-magnet-icon flex h-5 w-5 items-center justify-center" aria-hidden="true">
            <Magnet size={16} strokeWidth={1.7} className="text-[#5ce4ab]" />
          </span>
          <span className="text-sm font-medium leading-5 text-[#111111]">{siteSettings.featureMagneticText}</span>
          <span className="flex h-5 w-5 items-center justify-center text-sm leading-5" aria-hidden="true">
            {siteSettings.featureMaterialFlag.startsWith('/') ? (
              <img src={siteSettings.featureMaterialFlag} alt="" width="16" height="12" className="inline-block" />
            ) : (
              siteSettings.featureMaterialFlag
            )}
          </span>
          <span className="text-sm font-medium leading-5 text-[#111111]">{siteSettings.featureMaterialText}</span>
        </section>

        {/* Price */}
        <div className="mt-4 flex flex-wrap items-center gap-[14px]">
          <span className="text-[30px] font-bold leading-none tracking-[-0.06em] text-[#080808] md:text-[38px]">{currentPrice} ₴</span>
          <span className="ml-2 text-[16px] font-medium text-[#777777] line-through md:text-[18px]">{oldPrice} ₴</span>
          <span className="inline-flex whitespace-nowrap rounded-full bg-[#5ce4ab] px-2.5 py-1 text-[12px] font-semibold uppercase leading-none tracking-[0.04em] text-[#080808]">
            SALE {oldPrice - currentPrice}₴
          </span>
        </div>

        {/* Design section */}
        <div className="mt-6">
          <div className="mb-3 flex min-h-[44px] items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#5ce4ab] shadow-[0_0_6px_2px_rgba(92,228,171,0.45)]" aria-hidden="true" />
              <ConfiguratorHeading step={1}>Дизайн {selectedDesignVersion}</ConfiguratorHeading>
            </div>
            <button
              type="button"
              className="overview-btn"
              onClick={() => setOpenModal('design')}
            >
              про дизайни
              <ChevronRight size={13} strokeWidth={1.7} aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Оберіть дизайн">
            {designThumbnails.map(design => {
              const active = design.slug === designSlug;
              return (
                <button
                  key={design.slug}
                  type="button"
                  onClick={() => handleDesignChange(design.slug)}
                  aria-label={`Обрати дизайн ${design.version}`}
                  aria-pressed={active}
                  data-design-slug={design.slug}
                  className={`design-option relative flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border-[1.5px] transition-[border-color,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#777777] focus-visible:ring-offset-2 ${
                    active
                      ? 'border-[#1A1A1A]'
                      : 'border-[#E5E7EB]'
                  }`}
                >
                  <Image
                    src={design.thumbnailSrc}
                    alt={design.label}
                    fill
                    className="object-cover"
                    sizes="60px"
                    unoptimized
                  />
                  {active ? (
                    <span className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-[#080808]" aria-hidden="true">
                      <Check size={9} color="white" strokeWidth={3} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Size section */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <ConfiguratorHeading step={2}>Розмір</ConfiguratorHeading>
            <button
              className="overview-btn"
              onClick={() => setOpenModal('size')}
            >
              <Camera size={13} strokeWidth={1.7} />
              в середині
              <ChevronRight size={13} strokeWidth={1.7} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {catalog.sizes.map(s => {
              const active = size === s.id;
              const variant = pricing.sizePrices[s.id];
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSizeChange(s.id)}
                  aria-pressed={active}
                  data-size-id={s.id}
                  className="relative rounded-[12px] px-3.5 py-3 text-left transition-all"
                  style={{
                    border: active ? '1.5px solid #1a1a1a' : '1.5px solid #e5e7eb',
                    background: active ? '#F7F7F7' : 'white',
                  }}
                >
                  {active && (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#080808]">
                      <Check size={11} color="white" strokeWidth={3} />
                    </span>
                  )}
                  <div className="text-sm font-medium leading-snug" style={{ color: active ? '#111111' : '#555555' }}>{s.label}</div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-sm font-semibold text-[#111111]">{variant.price} ₴</span>
                    <span className="text-xs text-[#777777] line-through">{variant.oldPrice} ₴</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fixation section */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <ConfiguratorHeading step={3}>Фіксація</ConfiguratorHeading>
            <button
              className="overview-btn"
              onClick={() => setOpenModal('fixation')}
            >
              <Camera size={13} strokeWidth={1.7} />
              фіксації
              <ChevronRight size={13} strokeWidth={1.7} />
            </button>
          </div>

          <div className="relative">
            <select
              value={selectedFixation}
              onChange={e => updateFixation(e.target.value)}
              aria-label="Оберіть тип фіксації"
              className={selectClasses}
              style={{ height: 48 }}
            >
              {catalog.fixations.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>

        {/* Brand selector section */}
        <div className="mt-6">
          <div>
            <ConfiguratorHeading step={4}>Марка автомобіля</ConfiguratorHeading>
          </div>
          <div className="mb-[11px] mt-[5px] flex items-center gap-1.5">
            <Info size={13} strokeWidth={1.5} className="flex-shrink-0 text-[#777777]" />
            <span className="text-[12px] font-light leading-[1.45] tracking-[0.06em] text-[#777777] sm:text-[13px]">Оберіть марку, щоб переглянути фото лого</span>
          </div>

          <div className="relative">
            <select
              value={brandId}
              onChange={e => handleBrandChange(e.target.value)}
              aria-label="Оберіть марку автомобіля"
              className={selectClasses}
              style={{ height: 48 }}
            >
              {catalog.brands.map(brand => (
                <option key={brand.id} value={brand.id}>
                  {brand.id === 'none' ? 'Без лого 0 ₴' : `${brand.flag} ${brand.name} +${brand.price} ₴`}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>

          {/* Preview button */}
          {brandSelected && selectedBrand && (
            <button
              type="button"
              onClick={() => setOpenModal('logo')}
              className="w-full flex items-center gap-2.5 mt-2.5 transition-colors hover:bg-[#E5F9F4]"
              style={{
                height: 48,
                background: '#F0FCF9',
                border: '1.5px solid #5ce4ab',
                borderRadius: 12,
                color: '#159E85',
                padding: '0 16px',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <span
                className="flex-shrink-0 flex items-center justify-center rounded-full"
                style={{ width: 30, height: 30, background: 'rgba(40, 197, 166, 0.12)' }}
              >
                <Camera size={18} color="#5ce4ab" />
              </span>
              <span className="flex-1 text-left" style={{ color: '#159E85' }}>
                Переглянути {selectedBrand.name}
              </span>
              <ArrowUpRight size={20} color="#5ce4ab" className="flex-shrink-0" />
            </button>
          )}
        </div>

        {/* CTA Button */}
        <button
          onClick={handleBuy}
          className="mt-6 flex h-[48px] w-full items-center justify-center gap-2.5 rounded-[12px] bg-[#080808] text-[15px] font-semibold tracking-[-0.01em] text-white transition-colors hover:bg-gray-800 active:bg-gray-900"
        >
          <ShoppingCart size={19} strokeWidth={2} />
          Купити {currentPrice} ₴
        </button>

        {/* Benefit cards */}
        <BenefitCards data={content.benefitModals} />
      </div>

      {/* Modals */}
      {openModal === 'design' && (
        <InfoModal
          title="Про дизайни"
          text={siteSettings.designInfoText}
          onClose={() => setOpenModal(null)}
        />
      )}
      {openModal === 'size' && (
        <InfoModal data={content.insideModal} onClose={() => setOpenModal(null)} />
      )}
      {openModal === 'logo' && brandSelected && selectedBrand && (
        <LogoModal onClose={() => setOpenModal(null)} data={content.logoModal} />
      )}
      {openModal === 'fixation' && (
        <InfoModal data={content.fixationModal} onClose={() => setOpenModal(null)} />
      )}
    </>
  );
}
