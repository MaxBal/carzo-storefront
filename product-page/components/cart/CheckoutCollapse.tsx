'use client';

import type { ReactNode } from 'react';

interface CheckoutCollapseProps {
  open: boolean;
  id?: string;
  children: ReactNode;
}

/** Keep content mounted so opening and closing can both animate. */
export default function CheckoutCollapse({ open, id, children }: CheckoutCollapseProps) {
  return (
    <div
      id={id}
      className="checkout-collapse"
      data-open={open ? 'true' : 'false'}
      aria-hidden={!open}
      {...(open ? {} : { inert: '' })}
    >
      <div className="checkout-collapse__inner">{children}</div>
    </div>
  );
}
