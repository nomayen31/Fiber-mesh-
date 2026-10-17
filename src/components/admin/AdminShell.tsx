"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  ShoppingCart,
  X,
} from "lucide-react";
import { site } from "@/content/site";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Section";

const navigation = [
  { href: "/admin", label: "ওভারভিউ ও অ্যানালিটিক্স", icon: LayoutDashboard },
  { href: "/admin/orders", label: "অর্ডার ম্যানেজমেন্ট", icon: ShoppingCart },
  { href: "/admin/inquiries", label: "গ্রাহকের মেসেজ", icon: Mail },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.replace("/admin/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      {/* ── sidebar ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 shrink-0 border-r border-slate-800 bg-slate-900 px-4 py-5 text-slate-300 transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5">
            <Logo />
            <span>
              <span className="block text-sm font-bold text-white">
                {site.brand.name}
              </span>
              <span className="block text-[11px] text-slate-400">
                অ্যাডমিন ড্যাশবোর্ড
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden"
            aria-label="বন্ধ করুন"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="mt-8 space-y-1" aria-label="অ্যাডমিন মেনু">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition",
                  isActive(item.href)
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 space-y-1 border-t border-slate-800 pt-5">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            ওয়েবসাইট দেখুন
          </Link>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {loggingOut ? "লগআউট হচ্ছে..." : "লগআউট"}
          </button>
        </div>
      </aside>

      {open ? (
        <button
          type="button"
          aria-label="মেনু বন্ধ করুন"
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      {/* ── content ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-slate-200 p-2 text-slate-700"
            aria-label="মেনু খুলুন"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="font-semibold text-slate-900">অ্যাডমিন ড্যাশবোর্ড</span>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
