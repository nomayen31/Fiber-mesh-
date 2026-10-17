"use client";

import Image from "next/image";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  Phone,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import { site } from "@/content/site";
import { useOrderModal } from "@/components/order/order-context";

export function Hero() {
  const { openOrder } = useOrderModal();
  const { hero, delivery } = site;

  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-white">
      {/* soft brand wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(55% 55% at 88% 6%, #dbeefe 0%, transparent 62%), radial-gradient(45% 45% at 2% 22%, #fffaeb 0%, transparent 58%)",
        }}
      />

      <div className="container-x relative grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:py-20">
        {/* ── copy ── */}
        <div className="animate-fade-up">
          <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {hero.eyebrow}
          </span>

          <h1 className="mt-5 text-balance text-[27px] leading-[1.45] tracking-normal text-slate-900 sm:text-[38px] sm:leading-[1.38] lg:text-[44px] lg:leading-[1.34]">
            {hero.title}
          </h1>

          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-slate-600 sm:mt-5 sm:text-base">
            {hero.subtitle}
          </p>

          {/* key promises — scannable in two seconds */}
          <ul className="mt-5 grid gap-2 text-[13.5px] text-slate-700 sm:grid-cols-2">
            {[
              { icon: <Banknote className="h-4 w-4" />, label: delivery.cod },
              { icon: <Truck className="h-4 w-4" />, label: delivery.nationwide },
              {
                icon: <CheckCircle2 className="h-4 w-4" />,
                label: "১০০% অরিজিনাল পণ্য",
              },
              {
                icon: <CheckCircle2 className="h-4 w-4" />,
                label: "১ মিটার × ৫০ মিটার / রোল",
              },
            ].map((item) => (
              <li key={item.label} className="flex items-center gap-2">
                <span className="text-emerald-600" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => openOrder()}
              className="btn-accent h-12 w-full px-6 text-base sm:w-auto"
            >
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              {hero.primaryCta}
            </button>
            <a
              href="#products"
              className="btn-outline h-12 w-full px-6 sm:w-auto"
            >
              {hero.secondaryCta}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
            <span>{hero.callLabel}</span>
            <a
              href={`tel:${site.contact.phone}`}
              className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              {site.contact.phoneDisplay}
            </a>
          </p>
        </div>

        {/* ── visual ── */}
        <div className="animate-fade-in">
          <div className="relative mx-auto max-w-md lg:max-w-none">
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-card-hover">
              <div className="relative aspect-[16/10] w-full lg:aspect-[4/3]">
                <Image
                  src={hero.image.src}
                  alt={hero.image.alt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 92vw, 520px"
                  className="object-cover"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <span className="chip bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                {delivery.nationwide}
              </span>
              <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">
                <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
                {delivery.cod}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
