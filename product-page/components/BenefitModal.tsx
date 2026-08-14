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
    <div
      className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
      style={{ background: '#f0fdf9' }}
    >
      <Icon size={18} strokeWidth={1.8} className="text-[#2DD4BF]" />
    </div>
  );
}

function TextLine({ line }: { line: BenefitTextLine }) {
  const className = line.tone === 'small'
    ? 'text-xs text-gray-400 leading-relaxed mt-0.5'
    : `text-sm leading-relaxed ${line.tone === 'accent' ? 'text-[#0d9488] font-medium' : 'text-gray-600'}`;
  const firstPercent = line.text.startsWith('20%') ? '20%' : null;

  return (
    <>
      {line.dividerBefore && <div className="border-t border-gray-100 my-0.5" />}
      <p className={className}>
        {firstPercent ? (
          <>
            <span className="text-[#0d9488] font-semibold">{firstPercent}</span>
            {line.text.slice(firstPercent.length)}
          </>
        ) : line.text}
      </p>
    </>
  );
}

function InfoCardBlock({ block }: { block: Extract<BenefitBlock, { type: 'info_card' }> }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex gap-3.5 shadow-sm">
      <IconBadge icon={block.icon} />
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 leading-snug">{block.title}</p>
        {block.lines.map((line, index) => <TextLine key={`${line.text}-${index}`} line={line} />)}
        {block.highlight && (
          <div className="rounded-2xl px-4 py-3.5 mt-1" style={{ background: '#f8fffe', border: '1px solid #99f6e4' }}>
            {block.highlight.title && <p className="text-sm font-bold text-gray-900 mb-1">{block.highlight.title}</p>}
            <p className="text-sm text-gray-600 leading-relaxed">{block.highlight.text}</p>
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
          <span key={item} className="text-xs font-medium text-gray-700 bg-gray-100 rounded-full px-3 py-1.5">{item}</span>
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
            className="rounded-2xl p-4 flex flex-col gap-1 items-center text-center"
            style={{ background: '#f0fdf9', border: '1.5px solid #99f6e4' }}
          >
            <span className="text-xs font-semibold text-gray-500">{item.label}</span>
            <span className="text-2xl font-bold text-[#0d9488]">{item.value}</span>
          </div>
        ))}
      </div>
    );
  }

  if (block.type === 'calculation') {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-3 flex flex-col gap-2">
          {block.rows.map(row => (
            <div key={`${row.label}-${row.value}`} className="flex items-center justify-between">
              <span className={`text-sm ${row.muted ? 'text-gray-400' : 'text-gray-700'}`}>{row.label}</span>
              <span className={`text-sm font-medium ${row.muted ? 'text-[#0d9488]' : 'text-gray-900'}`}>{row.value}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50">
          <span className="text-sm font-bold text-gray-900">{block.totalLabel}</span>
          <span className="text-lg font-bold text-gray-900">{block.totalValue}</span>
        </div>
        <div className="px-4 py-2.5 border-t border-gray-100">
          <p className="text-xs text-gray-400">{block.note}</p>
        </div>
      </div>
    );
  }

  if (block.type === 'loyalty_hero') {
    return (
      <div
        className="rounded-2xl p-6 flex flex-col items-center gap-1 text-center"
        style={{ background: 'linear-gradient(135deg, #f0fdf9 0%, #e6fffa 100%)', border: '1.5px solid #99f6e4' }}
      >
        <span className="text-5xl font-black text-[#0d9488] tracking-tight">{block.value}</span>
        <span className="text-sm text-gray-500 font-medium">{block.label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0">
      {block.items.map((label, index) => (
        <div key={label} className="flex items-center flex-1 min-w-0">
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: '#2DD4BF' }}
            >
              {index + 1}
            </div>
            <span className="text-xs text-center text-gray-600 leading-tight px-1">{label}</span>
          </div>
          {index < block.items.length - 1 && <div className="flex-shrink-0 w-6 h-px bg-gray-200 -mt-5" />}
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
          className="relative bg-white w-full flex flex-col rounded-t-3xl md:rounded-2xl md:max-w-[680px] md:mx-6 md:shadow-2xl"
          style={{
            maxHeight: 'calc(100dvh - 56px)',
            height: 'calc(100dvh - 56px)',
            boxShadow: '0 -4px 40px rgba(0,0,0,0.12)',
          }}
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={event => event.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-0 md:hidden flex-shrink-0">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          <div className="flex-shrink-0 px-5 pt-4 pb-4 md:pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="benefit-modal-title" className="text-xl font-bold text-gray-900 leading-tight">{data.title}</h2>
                <p className="text-sm text-gray-400 mt-0.5 leading-snug">{data.subtitle}</p>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600 mt-0.5"
                aria-label="Закрити"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="flex-shrink-0 h-px bg-gray-100 mx-5" />

          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-5 flex flex-col gap-3 pb-safe-area">
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
