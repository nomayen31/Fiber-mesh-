"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Download,
  Loader2,
  Mail,
  MessageSquare,
  Package,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { apiGet } from "@/lib/client";
import type { AdminStats, StatsRangeKey } from "@/lib/types";
import { cn, formatBdt, formatDateTime, formatNumber } from "@/lib/utils";
import { RevenueTrendChart, OrdersTrendChart, StatusDonut } from "@/components/admin/Charts";
import { StatCard, StatusBadge } from "@/components/admin/StatCard";

const ranges: { key: StatsRangeKey; label: string }[] = [
  { key: "7d", label: "৭ দিন" },
  { key: "30d", label: "৩০ দিন" },
  { key: "90d", label: "৯০ দিন" },
];

export function DashboardView() {
  const [range, setRange] = useState<StatsRangeKey>("7d");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextRange: StatsRangeKey) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<AdminStats>(
        `/api/admin/stats?range=${nextRange}`,
      );
      setStats(data);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "ড্যাশবোর্ডের তথ্য আনা যায়নি।",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range]);

  return (
    <div className="space-y-6">
      {/* ── header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">ওভারভিউ ও অ্যানালিটিক্স</h1>
          <p className="mt-1 text-sm text-slate-600">
            {stats
              ? `সর্বশেষ আপডেট: ${formatDateTime(stats.generatedAt)}`
              : "ডেটা লোড হচ্ছে..."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {ranges.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRange(item.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition",
                  range === item.key
                    ? "bg-brand-600 text-white"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load(range)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            রিফ্রেশ
          </button>
          <a
            href="/api/admin/export?type=orders"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV ডাউনলোড
          </a>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {error}
            <br />
            <span className="text-xs">
              ডেটাবেস কানেকশন (DATABASE_URL) ঠিক আছে কিনা দেখুন এবং{" "}
              <code>npm run db:push</code> চালানো হয়েছে কিনা নিশ্চিত করুন।
            </span>
          </span>
        </p>
      ) : null}

      {!stats && loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : null}

      {stats ? (
        <>
          {/* ── order cards ── */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-500">
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              অর্ডারের পরিসংখ্যান
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="আজকের অর্ডার"
                value={formatNumber(stats.cards.ordersToday)}
                hint={`আজ ওয়েবসাইট + ম্যানুয়াল: ${formatNumber(stats.cards.todaySubmissions)} টি নতুন সাবমিশন`}
                icon={CalendarDays}
                tone="brand"
              />
              <StatCard
                label="শেষ ৭ দিনের অর্ডার"
                value={formatNumber(stats.cards.ordersWeek)}
                hint={`মোট রোল: ${formatNumber(
                  stats.series.slice(-7).reduce((sum, day) => sum + day.rolls, 0),
                )}`}
                icon={TrendingUp}
                tone="violet"
              />
              <StatCard
                label="শেষ ৩০ দিনের অর্ডার"
                value={formatNumber(stats.cards.ordersMonth)}
                hint={`মোট রোল: ${formatNumber(stats.cards.rollsThisMonth)}`}
                icon={BarChart3}
                tone="amber"
              />
            </div>
          </section>

          {/* ── revenue cards ── */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Wallet className="h-4 w-4" aria-hidden="true" />
              বিক্রয় (Sales Revenue)
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="আজকের বিক্রয়"
                value={formatBdt(stats.cards.revenueToday)}
                hint="বাতিল অর্ডার বাদ দিয়ে"
                icon={Wallet}
                tone="emerald"
              />
              <StatCard
                label="শেষ ৭ দিনের বিক্রয়"
                value={formatBdt(stats.cards.revenueWeek)}
                hint={`দৈনিক গড়: ${formatBdt(Math.round(stats.cards.revenueWeek / 7))}`}
                icon={TrendingUp}
                tone="emerald"
              />
              <StatCard
                label="শেষ ৩০ দিনের বিক্রয়"
                value={formatBdt(stats.cards.revenueMonth)}
                hint={`দৈনিক গড়: ${formatBdt(Math.round(stats.cards.revenueMonth / 30))}`}
                icon={TrendingUp}
                tone="emerald"
              />
            </div>
          </section>

          {/* ── totals ── */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="মোট ফর্ম সাবমিশন"
              value={formatNumber(stats.cards.totalFormSubmissions)}
              hint={`ওয়েবসাইট অর্ডার ${formatNumber(stats.cards.websiteSubmissions)} + মেসেজ ${formatNumber(
                stats.cards.inquiries,
              )}`}
              icon={MessageSquare}
              tone="brand"
            />
            <StatCard
              label="মোট অর্ডার (সর্বকালীন)"
              value={formatNumber(stats.cards.totalOrders)}
              hint={`ওয়েবসাইট ${stats.cards.websiteSubmissions} • ফোন ${stats.cards.phoneOrders} • ম্যানুয়াল ${stats.cards.manualOrders}`}
              icon={Package}
              tone="slate"
            />
            <StatCard
              label="মোট বিক্রয় (সর্বকালীন)"
              value={formatBdt(stats.cards.totalRevenue)}
              hint={`গড় অর্ডার ভ্যালু: ${formatBdt(stats.cards.avgOrderValue)} • ${formatNumber(
                stats.cards.totalRolls,
              )} রোল`}
              icon={Wallet}
              tone="emerald"
            />
          </section>

          {/* ── charts ── */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card lg:col-span-2">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base">
                    বিক্রয়ের ট্রেন্ড (শেষ {stats.days} দিন)
                  </h2>
                  <p className="text-xs text-slate-500">
                    প্রতিদিনের মোট বিক্রয় (বাতিল বাদে)
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  মোট:{" "}
                  {formatBdt(
                    stats.series.reduce((sum, day) => sum + day.revenue, 0),
                  )}
                </span>
              </div>
              <RevenueTrendChart data={stats.series} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <h2 className="text-base">অর্ডার ও রোলের ট্রেন্ড</h2>
              <p className="mb-4 text-xs text-slate-500">
                দৈনিক অর্ডার সংখ্যা ও প্রতি অর্ডারে রোল
              </p>
              <OrdersTrendChart data={stats.series} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <h2 className="text-base">স্ট্যাটাস অনুযায়ী অর্ডার</h2>
              <p className="mb-4 text-xs text-slate-500">
                পেন্ডিং, কনফার্মড, সম্পন্ন ও বাতিলের অনুপাত
              </p>
              <StatusDonut data={stats.statusBreakdown} />
            </div>
          </section>

          {/* ── top products + recent orders ── */}
          <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <h2 className="text-base">সবচেয়ে বেশি বিক্রি হওয়া পণ্য</h2>
              <p className="mb-4 text-xs text-slate-500">
                মোট বিক্রয় অনুযায়ী শীর্ষ ৫
              </p>
              {stats.topProducts.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  এখনো কোনো বিক্রয় হয়নি।
                </p>
              ) : (
                <ul className="space-y-3">
                  {stats.topProducts.map((item, index) => (
                    <li key={item.productName} className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {item.productName}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {formatNumber(item.orders)} অর্ডার •{" "}
                          {formatNumber(item.rolls)} রোল
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-brand-700">
                        {formatBdt(item.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-base">সর্বশেষ অর্ডার</h2>
                  <p className="text-xs text-slate-500">
                    নতুন অর্ডার আসা মাত্র এখানে দেখা যাবে
                  </p>
                </div>
                <Link
                  href="/admin/orders"
                  className="text-sm font-semibold text-brand-700 hover:underline"
                >
                  সব দেখুন →
                </Link>
              </div>

              {stats.recentOrders.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  এখনো কোনো অর্ডার আসেনি।
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {stats.recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
                          {order.customerName}
                          <span className="font-mono text-[11px] text-slate-400">
                            {order.orderNo}
                          </span>
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {order.productName} × {order.quantity} • {order.phone}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        {formatBdt(order.total)}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            অপঠিত গ্রাহক মেসেজ: {formatNumber(stats.cards.unreadInquiries)} •{" "}
            <Link href="/admin/inquiries" className="font-medium text-brand-700 hover:underline">
              মেসেজ দেখুন
            </Link>
          </p>
        </>
      ) : null}
    </div>
  );
}
