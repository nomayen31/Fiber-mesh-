"use client";

import { useCallback, useEffect, useState } from "react";
import { OrderModalContext } from "@/components/order/order-context";
import { OrderModal } from "@/components/order/OrderModal";
import type { ProductSummary } from "@/lib/types";

/**
 * Sits at the root of the app and powers every "অর্ডার করুন" button.
 *
 * Usage from any client component:
 *   const { openOrder } = useOrderModal();
 *   <button onClick={() => openOrder(product.slug)}>অর্ডার করুন</button>
 */
export function OrderModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    if (products.length > 0 || loadingProducts) return;
    setLoadingProducts(true);
    setProductsError(null);
    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as { products: ProductSummary[] };
      setProducts(data.products ?? []);
    } catch {
      setProductsError(
        "পণ্যের তালিকা আনা যায়নি। অনুগ্রহ করে ফোন করে অর্ডার করুন।",
      );
    } finally {
      setLoadingProducts(false);
    }
  }, [loadingProducts, products.length]);

  const openOrder = useCallback(
    (productSlug?: string) => {
      setActiveSlug(productSlug ?? null);
      setIsOpen(true);
      void loadProducts();
    },
    [loadProducts],
  );

  const closeOrder = useCallback(() => setIsOpen(false), []);

  // Nothing inside the modal should scroll the page behind it.
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  return (
    <OrderModalContext.Provider value={{ openOrder }}>
      {children}
      <OrderModal
        isOpen={isOpen}
        onClose={closeOrder}
        products={products}
        activeSlug={activeSlug}
        loadingProducts={loadingProducts}
        productsError={productsError}
      />
    </OrderModalContext.Provider>
  );
}
