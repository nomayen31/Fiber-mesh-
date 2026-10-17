"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, Phone, ShoppingBag, X } from "lucide-react";
import { site } from "@/content/site";
import { useOrderModal } from "@/components/order/order-context";
import { Logo } from "@/components/ui/Section";
import { cn } from "@/lib/utils";

export function Header() {
  const { openOrder } = useOrderModal();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition",
        scrolled
          ? "border-slate-200 bg-white/95 shadow-sm backdrop-blur"
          : "border-transparent bg-white",
      )}
    >
      <div className="container-x flex h-16 items-center justify-between gap-4 sm:h-[72px]">
        <Link href="/" className="flex items-center gap-2.5" aria-label={site.brand.name}>
          <Logo />
          <span className="leading-tight">
            <span className="block text-base font-bold tracking-tight text-slate-900 sm:text-lg">
              {site.brand.name}
            </span>
            <span className="hidden text-[11px] text-slate-500 sm:block">
              {site.brand.tagline}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="প্রধান মেনু">
          {site.nav.map((item) => (
            <a
              key={item.href}
              href={`/${item.href}`}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-brand-700"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={`tel:${site.contact.phone}`}
            className="hidden items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:bg-brand-50/60 sm:inline-flex"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            <span className="hidden xl:inline">{site.contact.phoneDisplay}</span>
            <span className="xl:hidden">কল করুন</span>
          </a>
          <button
            type="button"
            onClick={() => openOrder()}
            className="btn-accent px-4 py-2.5 text-sm"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            অর্ডার করুন
          </button>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-lg p-2.5 text-slate-700 transition hover:bg-slate-100 lg:hidden"
            aria-label={open ? "মেনু বন্ধ করুন" : "মেনু খুলুন"}
            aria-expanded={open}
          >
            {open ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-slate-200 bg-white lg:hidden">
          <nav className="container-x grid gap-1 py-3" aria-label="মোবাইল মেনু">
            {site.nav.map((item) => (
              <a
                key={item.href}
                href={`/${item.href}`}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-slate-700 transition hover:bg-slate-100"
              >
                {item.label}
              </a>
            ))}
            <a
              href={`tel:${site.contact.phone}`}
              className="mt-2 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-[15px] font-semibold text-brand-700"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              {site.contact.phoneDisplay}
            </a>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
