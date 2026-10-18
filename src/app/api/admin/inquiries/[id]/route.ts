import type { NextRequest } from "next/server";
import { guardAdmin, jsonError, jsonOk, logError } from "@/lib/api";
import { deleteInquiry, toggleInquiryRead } from "@/lib/inquiries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/admin/inquiries/:id — mark as read / unread. */
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

  const isRead = Boolean((payload as { isRead?: unknown } | null)?.isRead);

  try {
    const inquiry = await toggleInquiryRead(id, isRead);
    return jsonOk({ ok: true, inquiry });
  } catch (error) {
    logError("[api/admin/inquiries/:id] update failed:", error);
    return jsonError("আপডেট করা যায়নি।", 500);
  }
}

/** DELETE /api/admin/inquiries/:id */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const denied = await guardAdmin(request);
  if (denied) return denied;

  const { id } = await context.params;

  try {
    await deleteInquiry(id);
    return jsonOk({ ok: true });
  } catch (error) {
    logError("[api/admin/inquiries/:id] delete failed:", error);
    return jsonError("ডিলিট করা যায়নি।", 500);
  }
}
