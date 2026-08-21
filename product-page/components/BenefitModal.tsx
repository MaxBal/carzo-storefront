'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Wallet,
  Shield,
  Percent,
  RotateCcw,
  Truck,
  Package,
  PackageCheck,
  Undo2,
  RefreshCw,
  Calendar,
  Tag,
  Sparkles,
} from 'lucide-react';
import type { BenefitBlock, BenefitIcon, BenefitModalData, BenefitTextLine } from '@/lib/content/types';

interface BenefitModalProps {
  data: BenefitModalData;
  onClose: () => void;
}

const ICONS: Record<BenefitIcon, React.ElementType> = {
  wallet: Wallet,
  shield: Shield,
  percent: Percent,
  rotate: RotateCcw,
  truck: Truck,
  package: Package,
  package_check: PackageCheck,
  refresh: RefreshCw,
  calendar: Calendar,
  undo: Undo2,
  tag: Tag,
  sparkles: Sparkles,
};

function IconBadge({ icon }: { icon: BenefitIcon }) {
  const Icon = ICONS[icon];
  return (
    <div className="modal-info-icon">
      <Icon size={18} strokeWidth={1.8} />
    </div>
  );
}

function TextLine({ line }: { line: BenefitTextLine }) {
  const className = line.tone === 'small'
    ? 'modal-secondary-text mt-0.5'
    : `modal-body-text ${line.tone === 'accent' ? 'font-medium !text-[#5ce4ab]' : ''}`;
  const firstPercent = line.text.startsWith('20%') ? '20%' : null;

  return (
    <>
      {line.dividerBefore ? <div className="my-0.5 border-t border-[#dedede]" /> : null}
      <p className={className}>
        {firstPercent ? (
          <>
            <span className="font-semibold text-[#5ce4ab]">{firstPercent}</span>
            {line.text.slice(firstPercent.length)}
          </>
        ) : line.text}
      </p>
    </>
  );
}

function InfoCardBlock({ block }: { block: Extract<BenefitBlock, { type: 'info_card' }> }) {
  return (
    <div className="modal-card flex gap-3.5">
      <IconBadge icon={block.icon} />
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <p className="modal-card-title">{block.title}</p>
        {block.lines.map((line, index) => <TextLine key={`${line.text}-${index}`} line={line} />)}
        {block.highlight && (
          <div className="modal-nested-block mt-1">
            {block.highlight.title ? <p className="modal-card-title mb-1">{block.highlight.title}</p> : null}
            <p className="modal-body-text">{block.highlight.text}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BenefitBlockView({ block }: { block: BenefitBlock }) {
  if (block.type === 'info_card') return <InfoCardBlock block={block} />;

  if (block.type === 'badges') {
    return (
      <div className="flex gap-2 flex-wrap">
        {block.items.map(item => (
          <span key={item} className="rounded-full bg-[#f0f0f0] px-3 py-1.5 text-xs font-medium text-[#4d4d4d]">{item}</span>
        ))}
      </div>
    );
  }

  if (block.type === 'discount_grid') {
    return (
      <div className="grid grid-cols-2 gap-3">
        {block.items.map(item => (
          <div
            key={`${item.label}-${item.value}`}
            className="modal-card flex flex-col items-center gap-1 text-center"
          >
            <span className="modal-card-title">{item.label}</span>
            <span className="text-2xl font-bold text-[#5ce4ab]">{item.value}</span>
          </div>
        ))}
      </div>
    );
  }

  if (block.type === 'calculation') {
    return (
      <div className="modal-card overflow-hidden" style={{ padding: 0 }}>
        <div className="px-4 pt-4 pb-3 flex flex-col gap-2">
          {block.rows.map(row => (
            <div key={`${row.label}-${row.value}`} className="flex items-center justify-between">
              <span className={`text-base ${row.muted ? 'text-[#858585]' : 'text-gray-700'}`}>{row.label}</span>
              <span className={`text-base font-medium ${row.muted ? 'text-[#5ce4ab]' : 'text-gray-900'}`}>{row.value}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-[#f0f0f0] px-4 py-3">
          <span className="text-base font-bold text-gray-900">{block.totalLabel}</span>
          <span className="text-lg font-bold text-gray-900">{block.totalValue}</span>
        </div>
        <div className="border-t border-[#f0f0f0] px-4 py-2.5">
          <p className="modal-secondary-text">{block.note}</p>
        </div>
      </div>
    );
  }

  if (block.type === 'loyalty_hero') {
    return (
      <div className="modal-card flex flex-col items-center gap-1 px-4 py-6 text-center">
        <span className="text-5xl font-black tracking-tight text-[#5ce4ab]">{block.value}</span>
        <span className="modal-body-text font-bold">{block.label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0">
      {block.items.map((label, index) => (
        <div key={label} className="flex items-center flex-1 min-w-0">
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <div className="modal-info-icon text-sm font-bold">
              {index + 1}
            </div>
            <span className="modal-secondary-text px-1 text-center leading-tight">{label}</span>
          </div>
          {index < block.items.length - 1 ? <div className="-mt-5 h-px w-6 flex-shrink-0 bg-[#dedede]" /> : null}
        </div>
      ))}
    </div>
  );
}

export default function BenefitModal({ data, onClose }: BenefitModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const mobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const panelVariants = {
    hidden: mobile ? { y: '100%', opacity: 0 } : { y: 24, opacity: 0, scale: 0.97 },
    visible: mobile
      ? { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 340, damping: 34 } }
      : { y: 0, opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 340, damping: 34 } },
    exit: mobile
      ? { y: '100%', opacity: 0, transition: { duration: 0.22, ease: 'easeIn' as const } }
      : { y: 16, opacity: 0, scale: 0.97, transition: { duration: 0.18, ease: 'easeIn' as const } },
  };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        ref={backdropRef}
        className="fixed inset-0 z-[10000] flex items-end md:items-center md:justify-center"
        style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.45)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="benefit-modal-title"
        onClick={event => { if (event.target === backdropRef.current) onClose(); }}
      >
        <motion.div
          key="panel"
          className="modal-shell"
          style={{ boxShadow: '0 -4px 40px rgba(0,0,0,0.12)' }}
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={event => event.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-0 md:hidden flex-shrink-0">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          <div className="modal-header">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="benefit-modal-title" className="modal-title">{data.title}</h2>
                <p className="modal-subtitle">{data.subtitle}</p>
              </div>
              <button
                onClick={onClose}
                className="modal-close"
                aria-label="Закрити"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="modal-divider" />

          <div className="modal-scroll">
            <div className="modal-content">
              {data.blocks.map((block, index) => (
                <BenefitBlockView key={`${block.type}-${index}`} block={block} />
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
