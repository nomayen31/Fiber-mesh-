"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react";
import { site } from "@/content/site";
import { divisions, getDistrict, districtWithDelivery } from "@/content/districts";
import { cn, formatBdt, priceFor } from "@/lib/utils";
import type { ProductSummary } from "@/lib/types";

type OrderSuccess = {
  orderNo: string;
  productName: string;
  quantity: number;
  total: number;
  district?: string | null;
};

const emptyForm = {
  customerName: "",
  phone: "",
  district: "",
  address: "",
  note: "",
  website: "", // honeypot
};

export function OrderModal({
  isOpen,
  onClose,
  products,
  activeSlug,
  loadingProducts,
  productsError,
}: {
  isOpen: boolean;
  onClose: () => void;
  products: ProductSummary[];
  activeSlug: string | null;
  loadingProducts: boolean;
  productsError: string | null;
}) {
  const copy = site.orderForm;
  const [form, setForm] = useState(emptyForm);
  const [slug, setSlug] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<OrderSuccess | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const selectedProduct = useMemo(
    () => products.find((product) => product.slug === slug) ?? products[0] ?? null,
    [products, slug],
  );

  const pricing = useMemo(
    () => priceFor(selectedProduct?.price ?? 0, quantity),
    [selectedProduct?.price, quantity],
  );

  const selectedDistrict = getDistrict(form.district);

  // Sync the pre-selected product whenever the popup is opened.
  useEffect(() => {
    if (!isOpen) return;
    setSuccess(null);
    setFormError(null);
    setErrors({});
    setForm(emptyForm);
    setQuantity(1);
    setSlug(activeSlug ?? "");
  }, [isOpen, activeSlug]);

  // Once products arrive, make sure something is always selected.
  useEffect(() => {
    if (!isOpen) return;
    if (!slug && products.length > 0) {
      setSlug(activeSlug && products.some((p) => p.slug === activeSlug) ? activeSlug : products[0]!.slug);
    }
    if (slug && products.length > 0 && !products.some((p) => p.slug === slug)) {
      setSlug(activeSlug && products.some((p) => p.slug === activeSlug) ? activeSlug : products[0]!.slug);
    }
  }, [isOpen, products, slug, activeSlug]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const setField = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setErrors({});

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          productSlug: slug,
          quantity,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        errors?: Record<string, string>;
        order?: OrderSuccess;
      };

      if (!response.ok || !data.order) {
        setErrors(data.errors ?? {});
        setFormError(
          data.error ?? "অর্ডারটি সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।",
        );
        return;
      }

      setSuccess(data.order);
      setForm(emptyForm);
    } catch {
      setFormError(
        "ইন্টারনেট সংযোগে সমস্যা হচ্ছে। অনুগ্রহ করে সরাসরি ফোন করুন।",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[94vh] w-full max-w-2xl animate-scale-in overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        {/* ── header ── */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="order-modal-title" className="text-lg font-semibold text-slate-900">
                {copy.title}
              </h2>
              <p className="text-xs text-slate-500 sm:text-sm">{copy.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {success ? (
          <SuccessView
            success={success}
            onAnother={() => {
              setSuccess(null);
              setQuantity(1);
            }}
            onClose={onClose}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6">
            {productsError ? (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {productsError}
              </p>
            ) : null}

            {formError ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {formError}
              </p>
            ) : null}

            {/* ── product + quantity ── */}
            <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr]">
              <div>
                <label className="label" htmlFor="order-product">
                  {copy.fields.product}
                </label>
                <select
                  id="order-product"
                  className="input"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  disabled={loadingProducts || products.length === 0}
                  required
                >
                  {loadingProducts && products.length === 0 ? (
                    <option value="">লোড হচ্ছে...</option>
                  ) : null}
                  {products.map((product) => (
                    <option key={product.slug} value={product.slug}>
                      {product.name} — {formatBdt(product.price)}
                      {product.gsm ? ` (${product.gsm} GSM)` : ""}
                    </option>
                  ))}
                </select>
                {errors.productSlug ? (
                  <p className="mt-1 text-xs text-rose-600">{errors.productSlug}</p>
                ) : null}
              </div>

              <div>
                <label className="label" htmlFor="order-quantity">
                  {copy.fields.quantity}
                </label>
                <div className="flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    className="flex h-[46px] w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50"
                    aria-label="পরিমাণ কমান"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <input
                    id="order-quantity"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={10000}
                    value={quantity}
                    onChange={(event) => {
                      const next = Number.parseInt(event.target.value, 10);
                      setQuantity(Number.isFinite(next) ? Math.min(10000, Math.max(1, next)) : 1);
                    }}
                    className="input text-center font-semibold"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.min(10000, value + 1))}
                    className="flex h-[46px] w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50"
                    aria-label="পরিমাণ বাড়ান"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                {errors.quantity ? (
                  <p className="mt-1 text-xs text-rose-600">{errors.quantity}</p>
                ) : null}
              </div>
            </div>

            {/* ── selected product picture (visual confirmation) ── */}
            {selectedProduct ? (
              <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                  {selectedProduct.imageUrl ? (
                    <Image
                      src={selectedProduct.imageUrl}
                      alt={selectedProduct.name}
                      fill
                      sizes="64px"
                      className="object-contain"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-brand-700">
                      {selectedProduct.gsm ?? ""} GSM
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-500">
                    {copy.fields.picture}
                  </p>
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {selectedProduct.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatBdt(selectedProduct.price)}{" "}
                    {site.productsSection.priceSuffix}
                    {selectedProduct.gsm ? ` • ${selectedProduct.gsm} GSM` : ""}
                  </p>
                </div>
              </div>
            ) : null}

            {/* ── customer details ── */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="order-name">
                  {copy.fields.name} <span className="text-rose-500">*</span>
                </label>
                <input
                  id="order-name"
                  ref={firstFieldRef}
                  className="input"
                  placeholder={copy.fields.namePlaceholder}
                  value={form.customerName}
                  onChange={(event) => setField("customerName", event.target.value)}
                  autoComplete="name"
                  minLength={3}
                  maxLength={80}
                  required
                />
                {errors.customerName ? (
                  <p className="mt-1 text-xs text-rose-600">{errors.customerName}</p>
                ) : null}
              </div>

              <div>
                <label className="label" htmlFor="order-phone">
                  {copy.fields.phone} <span className="text-rose-500">*</span>
                </label>
                <input
                  id="order-phone"
                  className="input"
                  type="tel"
                  inputMode="tel"
                  placeholder={copy.fields.phonePlaceholder}
                  value={form.phone}
                  onChange={(event) => setField("phone", event.target.value)}
                  autoComplete="tel"
                  required
                />
                {errors.phone ? (
                  <p className="mt-1 text-xs text-rose-600">{errors.phone}</p>
                ) : null}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="order-district">
                {copy.fields.district} <span className="text-rose-500">*</span>
              </label>
              <select
                id="order-district"
                className="input"
                value={form.district}
                onChange={(event) => setField("district", event.target.value)}
                required
              >
                <option value="" disabled>
                  {copy.fields.districtPlaceholder}
                </option>
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
              ) : selectedDistrict ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                  {copy.fields.deliveryEstimate} {selectedDistrict.delivery}
                </p>
              ) : null}
            </div>

            <div>
              <label className="label" htmlFor="order-address">
                {copy.fields.address} <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="order-address"
                className="input min-h-[80px] resize-y"
                placeholder={copy.fields.addressPlaceholder}
                value={form.address}
                onChange={(event) => setField("address", event.target.value)}
                minLength={8}
                maxLength={300}
                required
              />
              {errors.address ? (
                <p className="mt-1 text-xs text-rose-600">{errors.address}</p>
              ) : null}
            </div>

            <div>
              <label className="label" htmlFor="order-note">
                {copy.fields.note}
              </label>
              <input
                id="order-note"
                className="input"
                placeholder={copy.fields.notePlaceholder}
                value={form.note}
                onChange={(event) => setField("note", event.target.value)}
                maxLength={500}
              />
            </div>

            {/* Anti-bot honeypot: hidden from users, filled by bots. */}
            <input
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="pointer-events-none absolute h-0 w-0 opacity-0"
              value={form.website}
              onChange={(event) => setField("website", event.target.value)}
            />

            {/* ── price summary ── */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-600">
                    {selectedProduct ? selectedProduct.name : "পণ্য"} ({formatBdt(pricing.unitPrice)} × {pricing.quantity})
                  </dt>
                  <dd className="font-medium text-slate-800">
                    {formatBdt(pricing.subtotal)}
                  </dd>
                </div>
                {pricing.discount > 0 ? (
                  <div className="flex items-center justify-between text-emerald-700">
                    <dt>
                      {copy.discountLabel} ({pricing.discountPercent}%)
                    </dt>
                    <dd className="font-medium">- {formatBdt(pricing.discount)}</dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-slate-200 pt-2.5">
                  <dt className="font-semibold text-slate-800">{copy.totalLabel}</dt>
                  <dd className="text-lg font-bold text-brand-700">
                    {formatBdt(pricing.total)}
                  </dd>
                </div>
              </dl>
              {pricing.discount === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  {site.productsSection.bulkNote}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">{copy.deliveryNote}</p>
            </div>

            {/* ── actions: pinned to the bottom so the total and the submit
                   button are always visible on a phone ── */}
            <div className="sticky bottom-0 -mx-5 -mb-5 mt-2 border-t border-slate-200 bg-white/95 px-5 pb-4 pt-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[13px] text-slate-500">
                  {copy.totalLabel}
                </span>
                <span className="text-xl font-bold text-brand-700">
                  {formatBdt(pricing.total)}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={submitting || products.length === 0}
                  className="btn-accent h-12 w-full text-base"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      {copy.submitting}
                    </>
                  ) : (
                    copy.submit
                  )}
                </button>
                <a
                  href={`tel:${site.contact.phone}`}
                  className="btn-ghost h-10 w-full text-[13px] text-slate-600"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  {copy.callToOrder}
                </a>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function SuccessView({
  success,
  onAnother,
  onClose,
}: {
  success: OrderSuccess;
  onAnother: () => void;
  onClose: () => void;
}) {
  const copy = site.orderForm;
  return (
    <div className="px-5 py-8 text-center sm:px-8">
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
      </span>
      <h3 className="text-xl font-semibold text-slate-900">{copy.successTitle}</h3>
      <p className="mx-auto mt-3 max-w-md text-sm text-slate-600">
        {copy.successText}
      </p>

      <div className="mx-auto mt-5 max-w-sm rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-600">{copy.orderNumberLabel}</span>
          <span className="font-mono font-semibold text-brand-700">
            {success.orderNo}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-slate-600">পণ্য</span>
          <span className="text-right font-medium text-slate-800">
            {success.productName} × {success.quantity}
          </span>
        </div>
        {success.district ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-slate-600">ডেলিভারি</span>
            <span className="text-right font-medium text-slate-800">
              {districtWithDelivery(success.district)}
            </span>
          </div>
        ) : null}
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
          <span className="font-medium text-slate-700">{copy.totalLabel}</span>
          <span className="font-bold text-brand-700">{formatBdt(success.total)}</span>
        </div>
      </div>

      <div className={cn("mt-6 flex flex-col justify-center gap-3 sm:flex-row")}>
        <a href={`tel:${site.contact.phone}`} className="btn-primary">
          <Phone className="h-4 w-4" aria-hidden="true" />
          {site.contact.phoneDisplay}
        </a>
        <button type="button" onClick={onAnother} className="btn-outline">
          {copy.anotherOrder}
        </button>
        <button type="button" onClick={onClose} className="btn-ghost">
          বন্ধ করুন
        </button>
      </div>
    </div>
  );
}
