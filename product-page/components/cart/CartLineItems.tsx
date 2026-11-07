'use client';

import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import type { CartQuoteLine } from '@/lib/cart/types';

export function money(value: number) {
  return new Intl.NumberFormat('uk-UA').format(value);
}

/** 1 товар / 2 товари / 5 товарів */
export function itemsCountLabel(quantity: number) {
  const mod10 = quantity % 10;
  const mod100 = quantity % 100;
  if (mod10 === 1 && mod100 !== 11) return `${quantity} товар`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${quantity} товари`;
  return `${quantity} товарів`;
}

interface CartLineItemsProps {
  lines: CartQuoteLine[];
  onQuantityChange: (itemKey: string, quantity: number) => void;
  onRemove: (itemKey: string) => void;
  /** Runs when a product link is clicked (e.g. close the drawer before navigating). */
  onNavigate?: () => void;
}

/**
 * Compact product list shared by the ordinary cart and the expanded
 * «Деталі замовлення» block in checkout. No per-item cards — thin dividers.
 */
export default function CartLineItems({ lines, onQuantityChange, onRemove, onNavigate }: CartLineItemsProps) {
  return (
    <ul className="divide-y divide-gray-100">
      {lines.map(line => (
        <li key={line.itemKey} className="flex flex-col gap-2 py-2.5 first:pt-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={line.productUrl}
                onClick={onNavigate}
                className="block truncate text-[14px] font-semibold leading-[1.3] hover:underline"
              >
                {line.title}
              </Link>
              <p className="mt-0.5 text-[12px] leading-[1.35] text-gray-500">
                {line.sizeLabel} · {line.brandName}
                <br />
                {line.fixationLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(line.itemKey)}
              className="-mr-1 shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
              aria-label={`Видалити ${line.title}`}
            >
              <Trash2 size={15} />
            </button>
          </div>
          {!line.inStock && <p className="text-[12px] font-medium text-red-600">Тимчасово немає в наявності</p>}
          <div className="flex items-end justify-between gap-2">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => onQuantityChange(line.itemKey, line.quantity - 1)}
                disabled={line.quantity <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Зменшити кількість"
              >
                <Minus size={15} />
              </button>
              <span className="min-w-7 text-center text-[14px] font-semibold tabular-nums">{line.quantity}</span>
              <button
                type="button"
                onClick={() => onQuantityChange(line.itemKey, line.quantity + 1)}
                disabled={line.quantity >= 20}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Збільшити кількість"
              >
                <Plus size={15} />
              </button>
            </div>
            <div className="text-right">
              {line.quantity > 1 && <p className="text-[11px] leading-[1.3] text-gray-500">{money(line.unitPrice)} ₴ / шт.</p>}
              <p className="text-[15px] font-bold leading-[1.3]">{money(line.lineTotal)} ₴</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
