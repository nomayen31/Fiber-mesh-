import type { NextRequest } from "next/server";
import { guardAdmin, jsonError } from "@/lib/api";
import { csvFileName, toCsv, type CsvColumn } from "@/lib/csv";
import { exportInquiries } from "@/lib/inquiries";
import { exportOrders } from "@/lib/orders";
import { districtLabel } from "@/content/districts";
import {
  displayPhone,
  formatDateTime,
  sourceMeta,
  statusMeta,
  type OrderSourceKey,
  type OrderStatusKey,
} from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderRow = Awaited<ReturnType<typeof exportOrders>>[number];
type InquiryRow = Awaited<ReturnType<typeof exportInquiries>>[number];

const orderColumns: CsvColumn<OrderRow>[] = [
  { key: "orderNo", label: "Order No (অর্ডার নম্বর)" },
  { key: "createdAt", label: "Date (তারিখ)", value: (row) => formatDateTime(row.createdAt) },
  { key: "customerName", label: "Customer Name (গ্রাহকের নাম)" },
  { key: "phone", label: "Phone (মোবাইল)", value: (row) => displayPhone(row.phone) },
  { key: "address", label: "Address (ঠিকানা)", value: (row) => row.address ?? "" },
  {
    key: "district",
    label: "District (জেলা)",
    value: (row) => (row.district ? districtLabel(row.district) : ""),
  },
  { key: "productName", label: "Product (পণ্য)" },
  { key: "quantity", label: "Quantity / Roll (পরিমাণ)" },
  { key: "unitPrice", label: "Unit Price (একক দাম)" },
  { key: "subtotal", label: "Subtotal (উপমোট)" },
  { key: "discount", label: "Discount (ছাড়)" },
  { key: "total", label: "Total (মোট)" },
  {
    key: "status",
    label: "Status (স্ট্যাটাস)",
    value: (row) => statusMeta[row.status as OrderStatusKey]?.label ?? row.status,
  },
  {
    key: "source",
    label: "Source (সোর্স)",
    value: (row) => sourceMeta[row.source as OrderSourceKey]?.label ?? row.source,
  },
  { key: "note", label: "Note (নোট)", value: (row) => row.note ?? "" },
];

const inquiryColumns: CsvColumn<InquiryRow>[] = [
  { key: "createdAt", label: "Date (তারিখ)", value: (row) => formatDateTime(row.createdAt) },
  { key: "name", label: "Name (নাম)" },
  { key: "phone", label: "Phone (মোবাইল)", value: (row) => displayPhone(row.phone) },
  { key: "email", label: "Email (ইমেইল)", value: (row) => row.email ?? "" },
  { key: "subject", label: "Subject (বিষয়)", value: (row) => row.subject ?? "" },
  { key: "message", label: "Message (বার্তা)" },
  { key: "isRead", label: "Read (দেখা হয়েছে)", value: (row) => (row.isRead ? "হ্যাঁ" : "না") },
];

/**
 * GET /api/admin/export?type=orders|inquiries
 * Streams a UTF-8 (BOM) CSV that opens correctly in Excel with Bengali text.
 */
export async function GET(request: NextRequest) {
  const denied = await guardAdmin(request);
  if (denied) return denied;

  const type = request.nextUrl.searchParams.get("type") ?? "orders";

  try {
    const isInquiry = type === "inquiries";
    const csv = isInquiry
      ? toCsv(inquiryColumns, await exportInquiries())
      : toCsv(orderColumns, await exportOrders());

    const filename = csvFileName(
      isInquiry ? "fiber-mesh-messages" : "fiber-mesh-orders",
    );

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/admin/export] failed:", error);
    return jsonError("CSV তৈরি করা যায়নি।", 500);
  }
}
