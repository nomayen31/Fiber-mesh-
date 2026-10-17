"use client";

import { Phone, ShoppingBag } from "lucide-react";
import { site } from "@/content/site";
import { useOrderModal } from "@/components/order/order-context";

/**
 * Mobile-only sticky action bar — the primary conversion surface for
 * Facebook-ad traffic, where almost every visit is a phone in portrait.
 * Respects the iOS home-indicator safe area.
 */
export function MobileCallBar() {
  const { openOrder } = useOrderModal();

  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
      <p className="mb-1.5 text-center text-[11px] font-medium text-slate-500">
        সারাদেশে হোম ডেলিভারি • ক্যাশ অন ডেলিভারি
      </p>
      <div className="flex items-center gap-2">
        <a
          href={`tel:${site.contact.phone}`}
          aria-label={`কল করুন ${site.contact.phoneDisplay}`}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-brand-700 shadow-sm transition active:scale-95"
        >
          <Phone className="h-5 w-5" aria-hidden="true" />
        </a>
        <button
          type="button"
          onClick={() => openOrder()}
          className="btn-accent h-12 flex-1 text-[15px]"
        >
          <ShoppingBag className="h-5 w-5" aria-hidden="true" />
          অর্ডার করুন
        </button>
      </div>
    </div>
  );
}
