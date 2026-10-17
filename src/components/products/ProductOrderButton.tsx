"use client";

import { Phone, ShoppingBag } from "lucide-react";
import { useOrderModal } from "@/components/order/order-context";
import { site } from "@/content/site";

export function ProductOrderButton({
  slug,
  className,
  label,
}: {
  slug: string;
  className?: string;
  label?: string;
}) {
  const { openOrder } = useOrderModal();
  return (
    <button
      type="button"
      onClick={() => openOrder(slug)}
      className={className ?? "btn-accent"}
    >
      <ShoppingBag className="h-4 w-4" aria-hidden="true" />
      {label ?? site.productsSection.orderNow}
    </button>
  );
}

export function ProductCallButton() {
  return (
    <a href={`tel:${site.contact.phone}`} className="btn-outline">
      <Phone className="h-4 w-4" aria-hidden="true" />
      {site.contact.phoneDisplay}
    </a>
  );
}
