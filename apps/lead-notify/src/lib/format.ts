/**
 * Formatting + Bengali label helpers.
 *
 * These deliberately mirror `src/lib/utils.ts` on the website so an order reads
 * identically in the dashboard and on the phone. Two details are copied on
 * purpose:
 *
 *   1. Amounts use **Latin** digits (`৳7,500`), Indian digit grouping included,
 *      because that is what `formatBdt()` produces on the web.
 *   2. Times are always rendered in Bangladesh time (UTC+6, fixed offset — the
 *      country has never used daylight saving). The arithmetic is done manually
 *      rather than through `Intl.DateTimeFormat` with a `timeZone`, because
 *      Hermes' ICU data varies by build and a silent fallback to the device
 *      timezone would be a subtle, hard-to-notice bug.
 */

import { colors } from "@/theme";

/* ────────────────────────────── numbers ────────────────────────────── */

/** `100000` → `1,00,000` (Indian grouping, matching `toLocaleString("en-IN")`). */
function groupIndian(value: number): string {
  const digits = String(Math.abs(Math.round(value)));
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

/** `৳7,500` — exactly what the web dashboard shows. */
export function formatBdt(amount: number): string {
  return `${amount < 0 ? "-" : ""}৳${groupIndian(amount)}`;
}

export function formatNumber(value: number): string {
  return `${value < 0 ? "-" : ""}${groupIndian(value)}`;
}

/* ─────────────────────────────── dates ─────────────────────────────── */

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function toDate(input: string | number | Date | null | undefined): Date | null {
  if (input === null || input === undefined || input === "") return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

type DhakaParts = {
  day: number;
  monthIndex: number;
  year: number;
  hour: number;
  minute: number;
};

function dhakaParts(date: Date): DhakaParts {
  const shifted = new Date(date.getTime() + DHAKA_OFFSET_MS);
  return {
    day: shifted.getUTCDate(),
    monthIndex: shifted.getUTCMonth(),
    year: shifted.getUTCFullYear(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** `17 Oct 2026, 4:35 PM` */
export function formatDateTime(input: string | number | Date | null): string {
  const date = toDate(input);
  if (!date) return "—";
  const p = dhakaParts(date);
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const meridiem = p.hour < 12 ? "AM" : "PM";
  return `${pad(p.day)} ${MONTHS[p.monthIndex]} ${p.year}, ${pad(hour12)}:${pad(p.minute)} ${meridiem}`;
}

/** `17 Oct 2026` */
export function formatDate(input: string | number | Date | null): string {
  const date = toDate(input);
  if (!date) return "—";
  const p = dhakaParts(date);
  return `${pad(p.day)} ${MONTHS[p.monthIndex]} ${p.year}`;
}

/** `4:35 PM` */
export function formatTime(input: string | number | Date | null): string {
  const date = toDate(input);
  if (!date) return "—";
  const p = dhakaParts(date);
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${pad(hour12)}:${pad(p.minute)} ${p.hour < 12 ? "AM" : "PM"}`;
}

/**
 * `এখনই`, `৫ মিনিট আগে`, `৩ ঘণ্টা আগে`, `২ দিন আগে` — a friendly label for the
 * order list. Falls back to the absolute date beyond a week.
 */
export function formatRelative(input: string | number | Date | null): string {
  const date = toDate(input);
  if (!date) return "—";

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "এখনই";
  if (minutes < 60) return `${minutes} মিনিট আগে`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ঘণ্টা আগে`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} দিন আগে`;

  return formatDate(date);
}

/* ─────────────────────────────── phone ─────────────────────────────── */

/** `01581190839` → `01581-190839`, matching `displayPhone()` on the web. */
export function displayPhone(value: string): string {
  const digits = value.replace(/[^\d]/g, "").replace(/^880/, "0");
  if (/^01[3-9]\d{8}$/.test(digits)) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return value;
}

/* ───────────────────────── order status labels ───────────────────────── */

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatusKey = (typeof ORDER_STATUSES)[number];

export type StatusMeta = {
  label: string;
  /** Background / text / border for the pill. */
  background: string;
  text: string;
  border: string;
  /** Solid colour for the dot, matching the web `dot` value. */
  dot: string;
};

/** Verbatim port of `statusMeta` in src/lib/utils.ts. */
export const STATUS_META: Record<OrderStatusKey, StatusMeta> = {
  PENDING: {
    label: "পেন্ডিং",
    background: colors.amber[50],
    text: colors.amber[700],
    border: colors.amber[200],
    dot: "#f79009",
  },
  CONFIRMED: {
    label: "কনফার্মড",
    background: colors.sky[50],
    text: colors.sky[700],
    border: colors.sky[200],
    dot: "#3b92f6",
  },
  PROCESSING: {
    label: "প্রসেসিং",
    background: colors.orange[50],
    text: colors.orange[700],
    border: colors.orange[200],
    dot: "#f97316",
  },
  SHIPPED: {
    label: "কুরিয়ারে পাঠানো",
    background: colors.violet[50],
    text: colors.violet[700],
    border: colors.violet[200],
    dot: "#8b5cf6",
  },
  COMPLETED: {
    label: "সম্পন্ন",
    background: colors.emerald[50],
    text: colors.emerald[700],
    border: colors.emerald[200],
    dot: "#10b981",
  },
  CANCELLED: {
    label: "বাতিল",
    background: colors.rose[50],
    text: colors.rose[700],
    border: colors.rose[200],
    dot: "#f43f5e",
  },
};

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status as OrderStatusKey] ?? STATUS_META.PENDING;
}

export const ORDER_SOURCES = ["WEBSITE", "PHONE", "MANUAL"] as const;
export type OrderSourceKey = (typeof ORDER_SOURCES)[number];

/** Verbatim port of `sourceMeta` in src/lib/utils.ts. */
export const SOURCE_META: Record<OrderSourceKey, { label: string }> = {
  WEBSITE: { label: "ওয়েবসাইট ফর্ম" },
  PHONE: { label: "ফোন কল" },
  MANUAL: { label: "ম্যানুয়াল এন্ট্রি" },
};

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "—";
  return SOURCE_META[source as OrderSourceKey]?.label ?? source;
}

/** `5` → `৫ রোল` */
export function formatQuantity(quantity: number): string {
  return `${formatNumber(quantity)} রোল`;
}

/** `বিগ রোল (Big Roll) — ৫০ × ১ মিটার` → `বিগ রোল` (for tight list rows). */
export function shortProductName(name: string): string {
  const cut = name.split("—")[0]?.split("(")[0]?.trim();
  return cut && cut.length > 0 ? cut : name;
}

/* ───────────────────────────── pricing ───────────────────────────── */

/**
 * Verbatim port of `bulkDiscountTiers` from `src/content/products.ts`.
 * Order matters: the first tier whose `minQty` is reached wins, so the list is
 * written largest-first.
 */
export const BULK_DISCOUNT_TIERS = [
  { minQty: 25, percent: 10 },
  { minQty: 10, percent: 5 },
  { minQty: 5, percent: 2 },
] as const;

export type PriceBreakdown = {
  unitPrice: number;
  quantity: number;
  subtotal: number;
  discountPercent: number;
  discount: number;
  total: number;
};

/**
 * Port of `priceFor()` in `src/lib/utils.ts`.
 *
 * This is used **only to preview** the total while the form is being filled in.
 * The submitted `unitPrice`/`quantity` are recomputed by the server with this
 * same function, and the server's answer is what gets stored — so the preview
 * can be wrong for a moment but the saved order never can be.
 */
export function priceFor(unitPrice: number, quantity: number): PriceBreakdown {
  const qty = Math.max(1, Math.floor(quantity));
  const subtotal = unitPrice * qty;
  const tier = BULK_DISCOUNT_TIERS.find((item) => qty >= item.minQty);
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

