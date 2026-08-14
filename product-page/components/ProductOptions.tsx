'use client';

import { useState, useEffect } from 'react';
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
  'w-full appearance-none bg-white border border-gray-200 rounded-[12px] px-4 py-3 text-sm text-gray-900 pr-10 cursor-pointer focus:outline-none focus:border-gray-400';

function SelectChevron() {
  return (
    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
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
  const { catalog, pricing, siteSettings } = content;

  const [selectedFixation, setSelectedFixation] = useState(persistedFixation);
  const [openModal, setOpenModal] = useState<'size' | 'logo' | 'fixation' | null>(null);

  // Keep local state in sync with the module-level persistence on param changes
  useEffect(() => {
    setSelectedFixation(persistedFixation);
  }, [size, designSlug, brandId]);

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

  const navigate = (newParams: ProductParams) => {
    const url = buildProductUrl(newParams, catalog);
    router.push(url, { scroll: false });
  };

  const handleSizeChange = (newSize: SizeId) => {
    navigate({ size: newSize, designSlug, brandId });
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
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">{productTitle}</h1>

        {/* Feature row */}
        <div className="mt-2 flex flex-nowrap items-center gap-[5px] text-[16px] font-normal leading-[22px] tracking-[-0.01em] text-[#5f6672] md:text-[17px] md:tracking-normal">
          <Magnet size={14} strokeWidth={1.5} className="flex-shrink-0 text-[#5f6672]" />
          <span className="whitespace-nowrap">{siteSettings.featureMagneticText}</span>
          <span className="flex items-center gap-[3px] whitespace-nowrap">
            <span>{siteSettings.featureMaterialFlag}</span>
            <span>{siteSettings.featureMaterialText}</span>
          </span>
        </div>

        {/* Price */}
        <div className="mt-4 flex flex-wrap items-center gap-[14px]">
          <span className="text-[26px] font-bold leading-none text-gray-900 md:text-[32px]">{currentPrice} ₴</span>
          <span className="ml-0.5 text-base font-medium text-[#9aa1ac] line-through">{oldPrice} ₴</span>
          <span className="ml-3 whitespace-nowrap rounded-full bg-[#ffe3cc] px-[13px] py-[5px] text-sm font-semibold leading-none text-[#f97316]">
            SALE {oldPrice - currentPrice}₴
          </span>
        </div>

        {/* Size section */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-base font-semibold text-gray-900">Розмір</span>
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
                  onClick={() => handleSizeChange(s.id)}
                  className="relative rounded-[12px] px-3.5 py-3 text-left transition-all"
                  style={{
                    border: active ? '1.5px solid #1a1a1a' : '1.5px solid #e5e7eb',
                    background: active ? '#F7F7F7' : 'white',
                  }}
                >
                  {active && (
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black flex items-center justify-center">
                      <Check size={11} color="white" strokeWidth={3} />
                    </span>
                  )}
                  <div className="text-sm font-medium leading-snug" style={{ color: active ? '#111' : '#596170' }}>{s.label}</div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-sm font-semibold text-gray-900">{variant.price} ₴</span>
                    <span className="text-xs text-gray-400 line-through">{variant.oldPrice} ₴</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fixation section */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-base font-semibold text-gray-900">Фіксація</span>
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
            <span className="text-base font-semibold text-gray-900">Марка автомобіля</span>
          </div>
          <div className="mb-[11px] mt-[5px] flex items-center gap-1.5">
            <Info size={13} strokeWidth={1.5} className="flex-shrink-0 text-[#626975]" />
            <span className="text-[13px] font-normal leading-[18px] text-[#626975]">Оберіть марку, щоб переглянути фото лого</span>
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
                border: '1.5px solid #28C5A6',
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
                <Camera size={18} color="#28C5A6" />
              </span>
              <span className="flex-1 text-left" style={{ color: '#159E85' }}>
                Переглянути {selectedBrand.name}
              </span>
              <ArrowUpRight size={20} color="#28C5A6" className="flex-shrink-0" />
            </button>
          )}
        </div>

        {/* CTA Button */}
        <button
          onClick={handleBuy}
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-[12px] bg-black text-base font-semibold text-white transition-colors hover:bg-gray-900 active:bg-gray-800"
          style={{ height: 52, fontSize: 16, fontWeight: 600 }}
        >
          <ShoppingCart size={19} strokeWidth={2} />
          Купити {currentPrice} ₴
        </button>

        {/* Benefit cards */}
        <BenefitCards data={content.benefitModals} />
      </div>

      {/* Modals */}
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
