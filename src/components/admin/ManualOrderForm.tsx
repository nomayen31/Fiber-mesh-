"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Plus, X } from "lucide-react";
import { apiGet, apiSend } from "@/lib/client";
import { ORDER_STATUSES, formatBdt, orderSources, priceFor, statusMeta, toDhakaInputValue, type OrderStatusKey, type OrderSourceKey } from "@/lib/utils";
import { sourceMeta } from "@/lib/utils";
import { divisions } from "@/content/districts";
import type { ProductSummary } from "@/lib/types";

type FormState = {
  customerName: string;
  phone: string;
  district: string;
  address: string;
  productSlug: string;
  unitPrice: string;
  quantity: string;
  applyBulkDiscount: boolean;
  status: OrderStatusKey;
  source: OrderSourceKey;
  note: string;
  createdAt: string;
};

export function ManualOrderForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [form, setForm] = useState<FormState>({
    customerName: "",
    phone: "",
    district: "",
    address: "",
    productSlug: "",
    unitPrice: "0",
    quantity: "1",
    applyBulkDiscount: true,
    status: "COMPLETED",
    source: "MANUAL",
    note: "",
    createdAt: toDhakaInputValue(),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiGet<{ products: ProductSummary[] }>("/api/products");
        setProducts(data.products);
      } catch {
        // Products are optional here — a custom item name can be typed instead.
      }
    })();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const selected = useMemo(
    () => products.find((product) => product.slug === form.productSlug) ?? null,
    [products, form.productSlug],
  );

  const quantity = Math.max(1, Number.parseInt(form.quantity, 10) || 1);
  const unitPrice = Math.max(0, Number.parseInt(form.unitPrice, 10) || 0);
  const pricing = useMemo(() => {
    if (!form.applyBulkDiscount) {
      const subtotal = unitPrice * quantity;
      return { subtotal, discount: 0, total: subtotal, discountPercent: 0 };
    }
    return priceFor(unitPrice, quantity);
  }, [form.applyBulkDiscount, quantity, unitPrice]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  function handleProductChange(slug: string) {
    const product = products.find((item) => item.slug === slug);
    setForm((current) => ({
      ...current,
      productSlug: slug,
      unitPrice: product ? String(product.price) : current.unitPrice,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setErrors({});

    try {
      await apiSend("/api/admin/orders", "POST", {
        customerName: form.customerName,
        phone: form.phone,
        district: form.district,
        address: form.address,
        productSlug: form.productSlug,
        productName: selected?.name ?? "",
        unitPrice,
        quantity,
        applyBulkDiscount: form.applyBulkDiscount,
        status: form.status,
        source: form.source,
        note: form.note,
        createdAt: form.createdAt,
      });
      onSaved();
      onClose();
    } catch (caught) {
      const error = caught as Error & { errors?: Record<string, string> };
      setErrors(error.errors ?? {});
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-order-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="manual-order-title" className="text-lg">
                ম্যানুয়াল অর্ডার যোগ করুন
              </h2>
              <p className="text-xs text-slate-500">
                ফোন কল, হোয়াটসঅ্যাপ বা অফলাইন বিক্রয় এখানে লিখে রাখুন
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6">
          {formError ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {formError}
            </p>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="manual-name">
                গ্রাহকের নাম <span className="text-rose-500">*</span>
              </label>
              <input
                id="manual-name"
                className="input"
                value={form.customerName}
                onChange={(event) => setField("customerName", event.target.value)}
                required
                minLength={3}
              />
              {errors.customerName ? (
                <p className="mt-1 text-xs text-rose-600">{errors.customerName}</p>
              ) : null}
            </div>

            <div>
              <label className="label" htmlFor="manual-phone">
                মোবাইল নম্বর <span className="text-rose-500">*</span>
              </label>
              <input
                id="manual-phone"
                className="input"
                type="tel"
                placeholder="01711223344"
                value={form.phone}
                onChange={(event) => setField("phone", event.target.value)}
                required
              />
              {errors.phone ? (
                <p className="mt-1 text-xs text-rose-600">{errors.phone}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="manual-address">
                ঠিকানা (ঐচ্ছিক)
              </label>
              <input
                id="manual-address"
                className="input"
                value={form.address}
                onChange={(event) => setField("address", event.target.value)}
                placeholder="গ্রাহকের ঠিকানা"
              />
            </div>

            <div>
              <label className="label" htmlFor="manual-district">
                জেলা (ঐচ্ছিক)
              </label>
              <select
                id="manual-district"
                className="input"
                value={form.district}
                onChange={(event) => setField("district", event.target.value)}
              >
                <option value="">— জেলা নির্বাচন করুন —</option>
                {divisions.map((division) => (
                  <optgroup key={division.name} label={division.name}>
                    {division.districts.map((district) => (
                      <option key={district.value} value={district.value}>
                        {district.label} ({district.delivery})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {errors.district ? (
                <p className="mt-1 text-xs text-rose-600">{errors.district}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="manual-product">
                পণ্য
              </label>
              <select
                id="manual-product"
                className="input"
                value={form.productSlug}
                onChange={(event) => handleProductChange(event.target.value)}
              >
                <option value="">— কাস্টম আইটেম —</option>
                {products.map((product) => (
                  <option key={product.slug} value={product.slug}>
                    {product.name} ({formatBdt(product.price)})
                  </option>
                ))}
              </select>
              {!form.productSlug ? (
                <p className="mt-1 text-xs text-slate-500">
                  কাস্টম আইটেমের জন্য নিচে দাম ও পণ্যের নাম লিখুন।
                </p>
              ) : null}
            </div>

            <div>
              <label className="label" htmlFor="manual-price">
                একক দাম (৳ / রোল) <span className="text-rose-500">*</span>
              </label>
              <input
                id="manual-price"
                className="input"
                type="number"
                min={0}
                step={1}
                value={form.unitPrice}
                onChange={(event) => setField("unitPrice", event.target.value)}
                required
              />
              {errors.unitPrice ? (
                <p className="mt-1 text-xs text-rose-600">{errors.unitPrice}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="manual-quantity">
                পরিমাণ (রোল) <span className="text-rose-500">*</span>
              </label>
              <input
                id="manual-quantity"
                className="input"
                type="number"
                min={1}
                step={1}
                value={form.quantity}
                onChange={(event) => setField("quantity", event.target.value)}
                required
              />
              {errors.quantity ? (
                <p className="mt-1 text-xs text-rose-600">{errors.quantity}</p>
              ) : null}
            </div>

            <div>
              <label className="label" htmlFor="manual-status">
                স্ট্যাটাস
              </label>
              <select
                id="manual-status"
                className="input"
                value={form.status}
                onChange={(event) =>
                  setField("status", event.target.value as OrderStatusKey)
                }
              >
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusMeta[status].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="manual-source">
                সোর্স
              </label>
              <select
                id="manual-source"
                className="input"
                value={form.source}
                onChange={(event) =>
                  setField("source", event.target.value as OrderSourceKey)
                }
              >
                <option value="MANUAL">{sourceMeta.MANUAL.label}</option>
                <option value="PHONE">{sourceMeta.PHONE.label}</option>
              </select>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="manual-date">
                অর্ডারের তারিখ ও সময়
              </label>
              <input
                id="manual-date"
                className="input"
                type="datetime-local"
                value={form.createdAt}
                onChange={(event) => setField("createdAt", event.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">
                পুরোনো বিক্রয় লিখতে চাইলে তারিখ পরিবর্তন করুন—চার্টেও সেই তারিখে
                যোগ হবে।
              </p>
            </div>

            <div className="flex items-end">
              <label className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={form.applyBulkDiscount}
                  onChange={(event) =>
                    setField("applyBulkDiscount", event.target.checked)
                  }
                />
                বাল্ক ছাড় প্রয়োগ করুন (৫+ রোল)
              </label>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="manual-note">
              নোট (ঐচ্ছিক)
            </label>
            <input
              id="manual-note"
              className="input"
              value={form.note}
              onChange={(event) => setField("note", event.target.value)}
              placeholder="যেমন: কুরিয়ারে পাঠানো হয়েছে, ক্যাশ অন ডেলিভারি"
              maxLength={500}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">
                {selected?.name ?? "কাস্টম আইটেম"} × {quantity}
              </span>
              <span className="font-medium">{formatBdt(pricing.subtotal)}</span>
            </div>
            {pricing.discount > 0 ? (
              <div className="mt-1.5 flex justify-between text-emerald-700">
                <span>বাল্ক ছাড় ({pricing.discountPercent}%)</span>
                <span>- {formatBdt(pricing.discount)}</span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold">
              <span>সর্বমোট</span>
              <span className="text-brand-700">{formatBdt(pricing.total)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  সংরক্ষণ হচ্ছে...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  অর্ডার যোগ করুন
                </>
              )}
            </button>
            <button type="button" onClick={onClose} className="btn-outline">
              বাতিল
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
