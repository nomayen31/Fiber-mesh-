/**
 * Shared helpers: BDT formatting, bulk pricing, Bangladesh-time day maths and
 * Bengali labels for order status / source.
 */

import { bulkDiscountTiers } from "@/content/products";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/** ৳1,250 */
export function formatBdt(amount: number): string {
  return `৳${Math.round(amount).toLocaleString("en-IN")}`;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-IN");
}

export type PriceBreakdown = {
  unitPrice: number;
  quantity: number;
  subtotal: number;
  discountPercent: number;
  discount: number;
  total: number;
};

/** Server + client share this exact function, so totals can never disagree. */
export function priceFor(unitPrice: number, quantity: number): PriceBreakdown {
  const qty = Math.max(1, Math.floor(quantity));
  const subtotal = unitPrice * qty;
  const tier = bulkDiscountTiers.find((t) => qty >= t.minQty);
  const discountPercent = tier?.percent ?? 0;
  const discount = Math.round((subtotal * discountPercent) / 100);
  return {
    unitPrice,
    quantity: qty,
    subtotal,
    discountPercent,
    discount,
    total: subtotal - discount,
  };
}

/* ─────────────────────────── Bangladesh time ─────────────────────────── */

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // UTC+6, no daylight saving
const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight (Asia/Dhaka) of the day the given instant falls in. */
export function startOfDhakaDay(date: Date = new Date()): Date {
  const shifted = date.getTime() + DHAKA_OFFSET_MS;
  const startOfShifted = Math.floor(shifted / DAY_MS) * DAY_MS;
  return new Date(startOfShifted - DHAKA_OFFSET_MS);
}

export function addDhakaDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** `2026-10-17` for the given instant, in Bangladesh time. */
export function dhakaDayKey(date: Date): string {
  return new Date(date.getTime() + DHAKA_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/** `17 Oct 2026, 4:35 PM` in Bangladesh time. */
export function formatDateTime(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}

/** `17 Oct` — short label for chart axes. */
export function formatShortDate(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
  }).format(value);
}

/** `17 Oct 2026` */
export function formatDate(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

/** Value for `<input type="datetime-local">` in Bangladesh time. */
export function toDhakaInputValue(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() + DHAKA_OFFSET_MS);
  return shifted.toISOString().slice(0, 16);
}

/** Parse a `datetime-local` value as Bangladesh time. */
export function fromDhakaInputValue(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getTime() - DHAKA_OFFSET_MS);
}

/* ─────────────────────────── Bengali labels ─────────────────────────── */

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatusKey = (typeof ORDER_STATUSES)[number];

export const statusMeta: Record<
  OrderStatusKey,
  { label: string; badge: string; dot: string }
> = {
  PENDING: {
    label: "পেন্ডিং",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    dot: "#f79009",
  },
  CONFIRMED: {
    label: "কনফার্মড",
    badge: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    dot: "#3b92f6",
  },
  PROCESSING: {
    label: "প্রসেসিং",
    badge: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    dot: "#f97316",
  },
  SHIPPED: {
    label: "কুরিয়ারে পাঠানো",
    badge: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    dot: "#8b5cf6",
  },
  COMPLETED: {
    label: "সম্পন্ন",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    dot: "#10b981",
  },
  CANCELLED: {
    label: "বাতিল",
    badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    dot: "#f43f5e",
  },
};

export const orderSources = ["WEBSITE", "PHONE", "MANUAL"] as const;
export type OrderSourceKey = (typeof orderSources)[number];

export const sourceMeta: Record<OrderSourceKey, { label: string }> = {
  WEBSITE: { label: "ওয়েবসাইট ফর্ম" },
  PHONE: { label: "ফোন কল" },
  MANUAL: { label: "ম্যানুয়াল এন্ট্রি" },
};

/** Normalise a BD mobile number to the `01XXXXXXXXX` shape. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+880")) return `0${digits.slice(4)}`;
  if (digits.startsWith("880")) return `0${digits.slice(3)}`;
  return digits;
}

export function displayPhone(value: string): string {
  const n = normalizePhone(value);
  if (/^01[3-9]\d{8}$/.test(n)) {
    return `${n.slice(0, 5)}-${n.slice(5)}`;
  }
  return value;
}
