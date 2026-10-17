import type { NextRequest } from "next/server";
import { guardAdmin, jsonError, jsonOk } from "@/lib/api";
import { createManualOrder, listOrders } from "@/lib/orders";
import { queueOrderNotification } from "@/lib/notifications/dispatch";
import { scheduleDispatch } from "@/lib/notifications/schedule";
import {
  adminOrderSchema,
  fieldErrors,
  orderQuerySchema,
} from "@/lib/validators";
import { fromDhakaInputValue } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/orders — paginated, filterable order list. */
export async function GET(request: NextRequest) {
  const denied = await guardAdmin(request);
  if (denied) return denied;

  const searchParams = Object.fromEntries(
    request.nextUrl.searchParams.entries(),
  );
  const parsed = orderQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return jsonError("ফিল্টার সেটিংস ভুল।", 422, fieldErrors(parsed.error));
  }

  try {
    const data = await listOrders({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      status: parsed.data.status,
      source: parsed.data.source,
      q: parsed.data.q,
      from: parsed.data.from,
      to: parsed.data.to,
    });
    return jsonOk(data);
  } catch (error) {
    console.error("[api/admin/orders] list failed:", error);
    return jsonError("অর্ডার লিস্ট আনা যায়নি।", 500);
  }
}

/** POST /api/admin/orders — add a phone / offline order manually. */
export async function POST(request: NextRequest) {
  const denied = await guardAdmin(request);
  if (denied) return denied;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("অবৈধ অনুরোধ।", 400);
  }

  const parsed = adminOrderSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError("ফর্মে কিছু তথ্য ঠিক নেই।", 422, fieldErrors(parsed.error));
  }

  // `createdAt` arrives from <input type="datetime-local"> and represents
  // Bangladesh local time, so it must be converted before storing.
  const createdAt = parsed.data.createdAt
    ? fromDhakaInputValue(parsed.data.createdAt)?.toISOString()
    : undefined;

  try {
    const order = await createManualOrder({ ...parsed.data, createdAt: createdAt ?? "" });
    const jobId = await queueOrderNotification(order, "order.created");
    scheduleDispatch(jobId);
    return jsonOk({ ok: true, order }, 201);
  } catch (error) {
    console.error("[api/admin/orders] manual create failed:", error);
    return jsonError("অর্ডার যোগ করা যায়নি।", 500);
  }
}
