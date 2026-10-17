import { jsonOk } from "@/lib/api";
import { endAdminSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/admin/logout */
export async function POST() {
  await endAdminSession();
  return jsonOk({ ok: true });
}
