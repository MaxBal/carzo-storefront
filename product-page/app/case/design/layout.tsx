import type { ReactNode } from 'react';
import ProductQuantityProvider from '@/components/ProductQuantityProvider';

export default function CaseDesignLayout({ children }: { children: ReactNode }) {
  return <ProductQuantityProvider>{children}</ProductQuantityProvider>;
}
