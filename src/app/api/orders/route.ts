import type { NextRequest } from "next/server";
import { getClientIp, jsonError, jsonOk, rateLimit } from "@/lib/api";
import { createWebsiteOrder } from "@/lib/orders";
import { fieldErrors, orderCreateSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/orders
 * Public endpoint used by the "অর্ডার করুন" modal on the landing page.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = rateLimit(`order:${ip}`, { limit: 8, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return jsonError(
      "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন অথবা সরাসরি ফোন করুন।",
      429,
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("অবৈধ অনুরোধ।", 400);
  }

  const parsed = orderCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(
      "ফর্মে কিছু তথ্য ঠিক নেই।",
      422,
      fieldErrors(parsed.error),
    );
  }

  // Anti-bot honeypot: a filled hidden field means an automated submission.
  if (parsed.data.website) {
    return jsonOk({ ok: true, orderNo: "FM-00000000-0000", spam: true });
  }

  try {
    const order = await createWebsiteOrder(parsed.data);
    return jsonOk({
      ok: true,
      order: {
        orderNo: order.orderNo,
        productName: order.productName,
        quantity: order.quantity,
        unitPrice: order.unitPrice,
        discount: order.discount,
        total: order.total,
        district: order.district,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return jsonError("নির্বাচিত পণ্যটি পাওয়া যায়নি।", 404);
    }
    console.error("[api/orders] failed to create order:", error);
    return jsonError(
      "দুঃখিত, অর্ডারটি সংরক্ষণ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন বা ফোন করুন।",
      500,
    );
  }
}
