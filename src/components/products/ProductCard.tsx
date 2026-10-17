"use client";

import Link from "next/link";
import { ArrowUpRight, Check, ShoppingBag } from "lucide-react";
import { useOrderModal } from "@/components/order/order-context";
import { ProductImageCarousel } from "@/components/products/ProductImageCarousel";
import { site } from "@/content/site";
import { formatBdt } from "@/lib/utils";
import type { ProductSummary } from "@/lib/types";

export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductSummary;
  priority?: boolean;
}) {
  const { openOrder } = useOrderModal();
  const copy = site.productsSection;
  const highlights = product.specs.slice(0, 3);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover">
      {/* ── image carousel ── */}
      <div className="relative bg-slate-50/70">
        <ProductImageCarousel
          images={product.images}
          alt={product.name}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          priority={priority}
          className="aspect-[4/5] w-full"
          imageClassName="object-contain p-2.5"
        />

        {product.badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-accent-500 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
            {product.badge}
          </span>
        ) : null}

        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-100 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          স্টকে আছে
        </span>
      </div>

      {/* ── body ── */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="text-[16px] leading-snug text-slate-900 sm:text-[17px]">
          {product.name}
        </h3>
        {product.tagline ? (
          <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-slate-600">
            {product.tagline}
          </p>
        ) : null}

        <ul className="mt-3.5 space-y-1.5">
          {highlights.map((spec) => (
            <li key={spec.label} className="flex items-start gap-2 text-[13px]">
              <Check
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              <span className="text-slate-500">{spec.label}:</span>
              <span className="font-medium text-slate-800">{spec.value}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between gap-2 border-t border-slate-100 pt-3.5">
            <p className="leading-none">
              <span className="text-[22px] font-bold tracking-normal text-brand-700">
                {formatBdt(product.price)}
              </span>
              <span className="ml-1 text-xs font-medium text-slate-500">
                / {product.unit}
              </span>
            </p>
            <span className="pb-0.5 text-right text-[11px] font-medium leading-tight text-emerald-700">
              ৫+ রোলে ছাড়
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => openOrder(product.slug)}
              className="btn-accent h-11 w-full text-sm"
            >
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              {copy.orderNow}
            </button>
            <Link
              href={`/products/${product.slug}`}
              className="inline-flex items-center justify-center gap-1 py-1 text-[13px] font-semibold text-slate-600 transition hover:text-brand-700"
            >
              {copy.viewDetails}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
