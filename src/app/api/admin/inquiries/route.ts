import type { NextRequest } from "next/server";
import { guardAdmin, jsonError, jsonOk } from "@/lib/api";
import { listInquiries } from "@/lib/inquiries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/inquiries — contact-form submissions. */
export async function GET(request: NextRequest) {
  const denied = await guardAdmin();
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20) || 20));
  const q = (params.get("q") ?? "").slice(0, 80);
  const onlyUnread = params.get("unread") === "1";

  try {
    const data = await listInquiries({ page, pageSize, q, onlyUnread });
    return jsonOk(data);
  } catch (error) {
    console.error("[api/admin/inquiries] list failed:", error);
    return jsonError("মেসেজ লিস্ট আনা যায়নি।", 500);
  }
}
