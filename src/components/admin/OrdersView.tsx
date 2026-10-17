"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { apiGet, apiSend } from "@/lib/client";
import { ManualOrderForm } from "@/components/admin/ManualOrderForm";
import { StatusBadge } from "@/components/admin/StatCard";
import { districtLabel } from "@/content/districts";
import type { OrderListResponse, OrderRow } from "@/lib/types";
import {
  ORDER_STATUSES,
  cn,
  displayPhone,
  formatBdt,
  formatDateTime,
  formatNumber,
  orderSources,
  sourceMeta,
  statusMeta,
  type OrderSourceKey,
  type OrderStatusKey,
} from "@/lib/utils";

type Filters = {
  q: string;
  status: OrderStatusKey | "ALL";
  source: OrderSourceKey | "ALL";
  from: string;
  to: string;
};

const initialFilters: Filters = {
  q: "",
  status: "ALL",
  source: "ALL",
  from: "",
  to: "",
};

export function OrdersView() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OrderListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Debounce the search box so typing does not hammer the API.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, q: searchInput.trim() }));
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        status: filters.status,
        source: filters.source,
        q: filters.q,
        from: filters.from,
        to: filters.to,
      });
      const result = await apiGet<OrderListResponse>(
        `/api/admin/orders?${params.toString()}`,
      );
      setData(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "অর্ডার আনা যায়নি।");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(order: OrderRow, status: OrderStatusKey) {
    setBusyId(order.id);
    try {
      await apiSend(`/api/admin/orders/${order.id}`, "PATCH", { status });
      setData((current) =>
        current
          ? {
              ...current,
              orders: current.orders.map((row) =>
                row.id === order.id ? { ...row, status } : row,
              ),
            }
          : current,
      );
    } catch (caught) {
      alert(caught instanceof Error ? caught.message : "স্ট্যাটাস আপডেট হয়নি।");
    } finally {
      setBusyId(null);
    }
  }

  async function removeOrder(order: OrderRow) {
    const confirmed = window.confirm(
      `আপনি কি নিশ্চিতভাবে অর্ডার ${order.orderNo} ডিলিট করতে চান? এটি ফিরিয়ে আনা যাবে না।`,
    );
    if (!confirmed) return;

    setBusyId(order.id);
    try {
      await apiSend(`/api/admin/orders/${order.id}`, "DELETE");
      void load();
    } catch (caught) {
      alert(caught instanceof Error ? caught.message : "ডিলিট করা যায়নি।");
    } finally {
      setBusyId(null);
    }
  }

  const hasFilters =
    filters.q !== "" ||
    filters.status !== "ALL" ||
    filters.source !== "ALL" ||
    filters.from !== "" ||
    filters.to !== "";

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">অর্ডার ম্যানেজমেন্ট</h1>
          <p className="mt-1 text-sm text-slate-600">
            সব অর্ডার, স্ট্যাটাস আপডেট, ম্যানুয়াল এন্ট্রি ও CSV এক্সপোর্ট
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowManualForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-600"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            ম্যানুয়াল অর্ডার
          </button>
          <button
            type="button"
            onClick={() => void load()}
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
            CSV
          </a>
        </div>
      </div>

      {/* filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="label" htmlFor="orders-search">
              সার্চ (নাম, ফোন, অর্ডার নম্বর)
            </label>
            <input
              id="orders-search"
              className="input"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="যেমন: রফিক / 0171122 / FM-2026"
            />
          </div>

          <div>
            <label className="label" htmlFor="orders-status">
              স্ট্যাটাস
            </label>
            <select
              id="orders-status"
              className="input"
              value={filters.status}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  status: event.target.value as Filters["status"],
                }));
                setPage(1);
              }}
            >
              <option value="ALL">সব স্ট্যাটাস</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusMeta[status].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="orders-source">
              সোর্স
            </label>
            <select
              id="orders-source"
              className="input"
              value={filters.source}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  source: event.target.value as Filters["source"],
                }));
                setPage(1);
              }}
            >
              <option value="ALL">সব সোর্স</option>
              {orderSources.map((source) => (
                <option key={source} value={source}>
                  {sourceMeta[source].label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="orders-from">
                থেকে
              </label>
              <input
                id="orders-from"
                type="date"
                className="input"
                value={filters.from}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, from: event.target.value }));
                  setPage(1);
                }}
              />
            </div>
            <div>
              <label className="label" htmlFor="orders-to">
                পর্যন্ত
              </label>
              <input
                id="orders-to"
                type="date"
                className="input"
                value={filters.to}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, to: event.target.value }));
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span className="text-slate-600">
              মোট: <strong className="text-slate-900">{formatNumber(data?.total ?? 0)}</strong> টি অর্ডার
            </span>
            <span className="text-slate-600">
              বিক্রয়:{" "}
              <strong className="text-emerald-700">
                {formatBdt(data?.filteredRevenue ?? 0)}
              </strong>
            </span>
            <span className="text-slate-600">
              রোল:{" "}
              <strong className="text-slate-900">
                {formatNumber(data?.filteredRolls ?? 0)}
              </strong>
            </span>
          </div>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setFilters(initialFilters);
                setSearchInput("");
                setPage(1);
              }}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              ফিল্টার রিসেট করুন
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      {/* table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">অর্ডার</th>
                <th className="px-4 py-3 font-semibold">গ্রাহক</th>
                <th className="px-4 py-3 font-semibold">পণ্য</th>
                <th className="px-4 py-3 font-semibold">পরিমাণ</th>
                <th className="px-4 py-3 font-semibold">মোট</th>
                <th className="px-4 py-3 font-semibold">সোর্স</th>
                <th className="px-4 py-3 font-semibold">স্ট্যাটাস</th>
                <th className="px-4 py-3 text-right font-semibold">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !data ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <Loader2
                      className="mx-auto mb-2 h-5 w-5 animate-spin"
                      aria-hidden="true"
                    />
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : data && data.orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    কোনো অর্ডার পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                data?.orders.map((order) => (
                  <tr
                    key={order.id}
                    className={cn(
                      "align-top transition hover:bg-slate-50/70",
                      busyId === order.id && "opacity-60",
                    )}
                  >
                    <td className="px-4 py-3.5">
                      <span className="block font-mono text-xs font-semibold text-brand-700">
                        {order.orderNo}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {formatDateTime(order.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="block font-medium text-slate-800">
                        {order.customerName}
                      </span>
                      <a
                        href={`tel:${order.phone}`}
                        className="block text-xs text-brand-700 hover:underline"
                      >
                        {displayPhone(order.phone)}
                      </a>
                      {order.district ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          {districtLabel(order.district)}
                        </span>
                      ) : null}
                      {order.address ? (
                        <span
                          className="mt-1 block max-w-[220px] truncate text-xs text-slate-500"
                          title={order.address}
                        >
                          {order.address}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="block max-w-[220px] text-slate-700">
                        {order.productName}
                      </span>
                      {order.note ? (
                        <span
                          className="mt-1 block max-w-[220px] truncate text-xs text-slate-500"
                          title={order.note}
                        >
                          নোট: {order.note}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="block font-medium text-slate-800">
                        {formatNumber(order.quantity)} রোল
                      </span>
                      <span className="block text-xs text-slate-500">
                        {formatBdt(order.unitPrice)} / রোল
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="block font-semibold text-slate-900">
                        {formatBdt(order.total)}
                      </span>
                      {order.discount > 0 ? (
                        <span className="block text-xs text-emerald-700">
                          ছাড় {formatBdt(order.discount)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-slate-600">
                        {sourceMeta[order.source].label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={order.status}
                        onChange={(event) =>
                          void changeStatus(
                            order,
                            event.target.value as OrderStatusKey,
                          )
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        aria-label={`${order.orderNo} এর স্ট্যাটাস`}
                      >
                        {ORDER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {statusMeta[status].label}
                          </option>
                        ))}
                      </select>
                      <span className="mt-1.5 block">
                        <StatusBadge status={order.status} />
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => void removeOrder(order)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        ডিলিট
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        {data ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3.5">
            <p className="text-sm text-slate-600">
              পেজ {formatNumber(data.page)} / {formatNumber(data.totalPages)}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={data.page <= 1 || loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                আগের
              </button>
              <button
                type="button"
                onClick={() =>
                  setPage((value) => Math.min(data.totalPages, value + 1))
                }
                disabled={data.page >= data.totalPages || loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                পরের
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {showManualForm ? (
        <ManualOrderForm
          onClose={() => setShowManualForm(false)}
          onSaved={() => {
            setPage(1);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
