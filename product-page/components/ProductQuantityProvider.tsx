'use client';

import { createContext, useContext, useMemo, useState } from 'react';

const ProductQuantityContext = createContext<{
  quantity: number;
  setQuantity: (quantity: number) => void;
} | null>(null);

/** Both responsive configurators share one draft quantity without moving the page into the client bundle. */
export default function ProductQuantityProvider({ children }: { children: React.ReactNode }) {
  const [quantity, setQuantity] = useState(1);
  const value = useMemo(() => ({ quantity, setQuantity }), [quantity]);
  return <ProductQuantityContext.Provider value={value}>{children}</ProductQuantityContext.Provider>;
}

export function useProductQuantity() {
  const value = useContext(ProductQuantityContext);
  if (!value) throw new Error('Product quantity requires its page provider');
  return value;
}
