import type { NextRequest } from "next/server";
import { guardAdmin, jsonError, jsonOk, logError } from "@/lib/api";
import { deleteOrder, getOrderById, updateOrderStatus } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { queueOrderNotification } from "@/lib/notifications/dispatch";
import { scheduleDispatch } from "@/lib/notifications/schedule";
import { fieldErrors, orderStatusSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/orders/:id — a single order.
 *
 * Added for the Android lead-notification app: after the user taps a push, the
 * app deep-links to the order detail screen and fetches the full record from
 * here. The web dashboard did not need it (it renders rows from the list
 * endpoint), so this is purely additive.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const denied = await guardAdmin(request);
  if (denied) return denied;

  const { id } = await context.params;

  try {
    const order = await getOrderById(id);
    if (!order) return jsonError("অর্ডার পাওয়া যায়নি।", 404);
    return jsonOk({ ok: true, order });
  } catch (error) {
    logError("[api/admin/orders/:id] read failed:", error);
    return jsonError("অর্ডার আনা যায়নি।", 500);
  }
}

/** PATCH /api/admin/orders/:id — change the order status. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const denied = await guardAdmin(request);
  if (denied) return denied;

  const { id } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("অবৈধ অনুরোধ।", 400);
  }

  const parsed = orderStatusSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError("স্ট্যাটাস সঠিক নয়।", 422, fieldErrors(parsed.error));
  }

  try {
    // Read the previous status so that a genuine transition *into* CONFIRMED can
    // be told apart from a no-op re-save. A missing order is deliberately left to
    // `updateOrderStatus` above/below, which keeps the original 500 behaviour.
    const before = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNo: true,
        productName: true,
        quantity: true,
        total: true,
        district: true,
        source: true,
        status: true,
      },
    });

    const order = await updateOrderStatus(id, parsed.data.status);

    if (before && before.status !== "CONFIRMED" && order.status === "CONFIRMED") {
      const jobId = await queueOrderNotification(before, "order.confirmed");
      scheduleDispatch(jobId);
    }

    return jsonOk({ ok: true, order });
  } catch (error) {
    logError("[api/admin/orders/:id] update failed:", error);
    return jsonError("স্ট্যাটাস আপডেট করা যায়নি।", 500);
  }
}

/** DELETE /api/admin/orders/:id */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const denied = await guardAdmin(request);
  if (denied) return denied;

  const { id } = await context.params;

  try {
    await deleteOrder(id);
    return jsonOk({ ok: true });
  } catch (error) {
    logError("[api/admin/orders/:id] delete failed:", error);
    return jsonError("অর্ডার ডিলিট করা যায়নি।", 500);
  }
}
