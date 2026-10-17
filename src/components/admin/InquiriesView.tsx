"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Mail,
  MailOpen,
  Phone,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { apiGet, apiSend } from "@/lib/client";
import type { InquiryListResponse, InquiryRow } from "@/lib/types";
import { cn, displayPhone, formatDateTime, formatNumber } from "@/lib/utils";

export function InquiriesView() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [data, setData] = useState<InquiryListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput.trim());
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
        q: query,
        ...(onlyUnread ? { unread: "1" } : {}),
      });
      const result = await apiGet<InquiryListResponse>(
        `/api/admin/inquiries?${params.toString()}`,
      );
      setData(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "মেসেজ আনা যায়নি।");
    } finally {
      setLoading(false);
    }
  }, [onlyUnread, page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleRead(inquiry: InquiryRow) {
    setBusyId(inquiry.id);
    try {
      await apiSend(`/api/admin/inquiries/${inquiry.id}`, "PATCH", {
        isRead: !inquiry.isRead,
      });
      setData((current) =>
        current
          ? {
              ...current,
              inquiries: current.inquiries.map((row) =>
                row.id === inquiry.id ? { ...row, isRead: !row.isRead } : row,
              ),
            }
          : current,
      );
    } catch (caught) {
      alert(caught instanceof Error ? caught.message : "আপডেট করা যায়নি।");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(inquiry: InquiryRow) {
    const confirmed = window.confirm(
      `${inquiry.name} এর মেসেজটি ডিলিট করতে চান?`,
    );
    if (!confirmed) return;

    setBusyId(inquiry.id);
    try {
      await apiSend(`/api/admin/inquiries/${inquiry.id}`, "DELETE");
      void load();
    } catch (caught) {
      alert(caught instanceof Error ? caught.message : "ডিলিট করা যায়নি।");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">গ্রাহকের মেসেজ</h1>
          <p className="mt-1 text-sm text-slate-600">
            যোগাযোগ ফর্ম থেকে আসা সব ইনকোয়ারি ও সাবমিশন
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            href="/api/admin/export?type=inquiries"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="inquiry-search">
            সার্চ (নাম, ফোন, বার্তা)
          </label>
          <input
            id="inquiry-search"
            className="input"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="যেমন: রফিক / 0171122"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 self-end rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            checked={onlyUnread}
            onChange={(event) => {
              setOnlyUnread(event.target.checked);
              setPage(1);
            }}
          />
          শুধু অপঠিত
        </label>
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

      <div className="space-y-3">
        {loading && !data ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-500">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden="true" />
            লোড হচ্ছে...
          </div>
        ) : data && data.inquiries.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-500">
            কোনো মেসেজ পাওয়া যায়নি।
          </div>
        ) : (
          data?.inquiries.map((inquiry) => (
            <article
              key={inquiry.id}
              className={cn(
                "rounded-2xl border bg-white p-4 shadow-card transition sm:p-5",
                inquiry.isRead ? "border-slate-200" : "border-brand-200 bg-brand-50/30",
                busyId === inquiry.id && "opacity-60",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 text-base">
                    {inquiry.name}
                    {!inquiry.isRead ? (
                      <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        নতুন
                      </span>
                    ) : null}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <a
                      href={`tel:${inquiry.phone}`}
                      className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      {displayPhone(inquiry.phone)}
                    </a>
                    {inquiry.email ? (
                      <a
                        href={`mailto:${inquiry.email}`}
                        className="inline-flex items-center gap-1.5 hover:text-slate-700"
                      >
                        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                        {inquiry.email}
                      </a>
                    ) : null}
                    <span>{formatDateTime(inquiry.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleRead(inquiry)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {inquiry.isRead ? (
                      <>
                        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                        অপঠিত করুন
                      </>
                    ) : (
                      <>
                        <MailOpen className="h-3.5 w-3.5" aria-hidden="true" />
                        পড়া হয়েছে
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(inquiry)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    ডিলিট
                  </button>
                </div>
              </div>

              {inquiry.subject ? (
                <p className="mt-3 text-sm font-medium text-slate-700">
                  বিষয়: {inquiry.subject}
                </p>
              ) : null}
              <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
                {inquiry.message}
              </p>
            </article>
          ))
        )}
      </div>

      {data ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-card">
          <p className="text-sm text-slate-600">
            মোট {formatNumber(data.total)} টি মেসেজ • পেজ{" "}
            {formatNumber(data.page)} / {formatNumber(data.totalPages)}
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
              onClick={() => setPage((value) => Math.min(data.totalPages, value + 1))}
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
  );
}
