'use client';

import { useState } from 'react';
import { CreditCard, Truck, RotateCcw, Package, Users, ArrowUpRight } from 'lucide-react';
import BenefitModal from './BenefitModal';
import type { BenefitModalData, BenefitModalType } from '@/lib/content/types';

const ICONS: Record<BenefitModalType, React.ElementType> = {
  payment: CreditCard,
  delivery: Truck,
  returns: RotateCcw,
  bundle: Package,
  loyalty: Users,
};

interface BenefitCardsProps {
  data: BenefitModalData[];
}

export default function BenefitCards({ data }: BenefitCardsProps) {
  const [openModal, setOpenModal] = useState<BenefitModalType | null>(null);
  const selected = data.find(item => item.type === openModal);

  return (
    <>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 mt-3">
        {data.map(item => {
          const Icon = ICONS[item.type];
          return (
          <button
            key={item.type}
            onClick={() => setOpenModal(item.type)}
            className="relative flex-shrink-0 flex flex-col items-center justify-center bg-white border border-gray-200 rounded-[12px] gap-2 hover:border-[#2DD4BF] hover:shadow-sm active:scale-95 transition-all duration-150 cursor-pointer"
            style={{ width: 92, height: 88, padding: '10px 8px' }}
          >
            <ArrowUpRight size={14} strokeWidth={2} className="absolute top-1.5 right-1.5 text-gray-700" />
            <Icon size={24} strokeWidth={1.5} className="text-gray-800" />
            <span className="text-[10px] text-center text-gray-700 leading-tight whitespace-pre-line font-medium">
              {item.cardLabel}
            </span>
          </button>
          );
        })}
      </div>

      {selected && (
        <BenefitModal data={selected} onClose={() => setOpenModal(null)} />
      )}
    </>
  );
}
