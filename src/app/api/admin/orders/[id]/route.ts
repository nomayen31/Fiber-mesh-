import type { NextRequest } from "next/server";
import { guardAdmin, jsonError, jsonOk } from "@/lib/api";
import { deleteOrder, updateOrderStatus } from "@/lib/orders";
import { fieldErrors, orderStatusSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/admin/orders/:id — change the order status. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const denied = await guardAdmin();
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
    const order = await updateOrderStatus(id, parsed.data.status);
    return jsonOk({ ok: true, order });
  } catch (error) {
    console.error("[api/admin/orders/:id] update failed:", error);
    return jsonError("স্ট্যাটাস আপডেট করা যায়নি।", 500);
  }
}

/** DELETE /api/admin/orders/:id */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const denied = await guardAdmin();
  if (denied) return denied;

  const { id } = await context.params;

  try {
    await deleteOrder(id);
    return jsonOk({ ok: true });
  } catch (error) {
    console.error("[api/admin/orders/:id] delete failed:", error);
    return jsonError("অর্ডার ডিলিট করা যায়নি।", 500);
  }
}
