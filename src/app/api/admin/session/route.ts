import { jsonOk } from "@/lib/api";
import { endAdminSession, getAdminSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/session — is the current visitor logged in? */
export async function GET() {
  const session = await getAdminSession();
  return jsonOk({ authenticated: session !== null });
}

/** DELETE /api/admin/session — log out. */
export async function DELETE() {
  await endAdminSession();
  return jsonOk({ ok: true });
}
