import type { NextRequest } from "next/server";
import { getClientIp, jsonError, jsonOk, logError, rateLimit } from "@/lib/api";
import { checkAdminPassword, startAdminSession } from "@/lib/auth";
import { fieldErrors, loginSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/admin/login — password login that issues the session cookie. */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = rateLimit(`login:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    return jsonError(
      `অনেকবার ভুল চেষ্টা। ${limit.retryAfterSeconds} সেকেন্ড পরে আবার চেষ্টা করুন।`,
      429,
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("অবৈধ অনুরোধ।", 400);
  }

  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError("পাসওয়ার্ড দিন।", 422, fieldErrors(parsed.error));
  }

  let valid = false;
  try {
    valid = checkAdminPassword(parsed.data.password);
  } catch (error) {
    logError("[api/admin/login]", error);
    return jsonError(
      "সার্ভারে ADMIN_PASSWORD সেট করা হয়নি। .env ফাইল দেখুন।",
      500,
    );
  }

  if (!valid) {
    return jsonError("পাসওয়ার্ড ভুল হয়েছে।", 401);
  }

  await startAdminSession();
  return jsonOk({ ok: true });
}
