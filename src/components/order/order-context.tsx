"use client";

import { createContext, useContext } from "react";

export type OrderModalContextValue = {
  /** Open the order popup, optionally pre-selecting a product. */
  openOrder: (productSlug?: string) => void;
};

export const OrderModalContext = createContext<OrderModalContextValue | null>(
  null,
);

export function useOrderModal(): OrderModalContextValue {
  const context = useContext(OrderModalContext);
  if (!context) {
    throw new Error(
      "useOrderModal() must be used inside <OrderModalProvider>. Wrap the tree in app/layout.tsx.",
    );
  }
  return context;
}
