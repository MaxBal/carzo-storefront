'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, ShoppingCart, Link2, Check, ArrowUpRight } from 'lucide-react';
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
  'w-full appearance-none bg-white border border-gray-200 rounded-[10px] px-4 py-3 text-sm text-gray-900 pr-10 cursor-pointer focus:outline-none focus:border-gray-400';

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
        <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
          <Link2 size={14} className="text-gray-500" />
          <span>{siteSettings.featureMagneticText}</span>
          <span className="text-gray-300">|</span>
          <span>{siteSettings.featureMaterialFlag}</span>
          <span>{siteSettings.featureMaterialText}</span>
        </div>

        {/* Price */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <span className="text-3xl font-bold text-gray-900">{currentPrice} ₴</span>
          <div className="flex items-center gap-3">
            <span className="text-base text-gray-400 line-through">{oldPrice} ₴</span>
            <span
              style={{
                background: '#FFE3CC',
                color: '#F97316',
                borderRadius: 999,
                padding: '5px 13px',
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              SALE {oldPrice - currentPrice}₴
            </span>
          </div>
        </div>

        {/* Size section */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-semibold text-gray-900">Розміри:</span>
            <button
              className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 transition-colors"
              style={{ color: '#28c5a6', border: '1px solid #28c5a6', background: 'transparent' }}
              onClick={() => setOpenModal('size')}
            >
              <Camera size={12} strokeWidth={2} />
              в середині
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
                  className="relative text-left rounded-[10px] px-3.5 py-3 transition-all"
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
                  <div className="text-sm font-medium text-gray-900 leading-snug">{s.label}</div>
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
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-semibold text-gray-900">Фіксація:</span>
            <button
              className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 transition-colors"
              style={{ color: '#28c5a6', border: '1px solid #28c5a6', background: 'transparent' }}
              onClick={() => setOpenModal('fixation')}
            >
              <Camera size={12} strokeWidth={2} />
              фіксації
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
        <div className="mt-5">
          <div className="mb-2.5">
            <span className="text-sm font-semibold text-gray-900">Оберіть марку авто щоб переглянути фото:</span>
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
                borderRadius: 10,
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
          className="mt-5 w-full bg-black text-white font-semibold text-base rounded-[10px] flex items-center justify-center gap-2.5 hover:bg-gray-900 active:bg-gray-800 transition-colors"
          style={{ height: 52 }}
        >
          <ShoppingCart size={18} strokeWidth={2} />
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
