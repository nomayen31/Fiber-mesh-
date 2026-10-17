import type { NextRequest } from "next/server";
import { getClientIp, jsonError, jsonOk, rateLimit } from "@/lib/api";
import { checkAdminPassword, issueMobileToken } from "@/lib/auth";
import { fieldErrors, loginSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/mobile/login
 *
 * The native app cannot hold an `httpOnly` cookie, so instead of setting one
 * this endpoint returns the **same signed admin JWT** as a bearer token. Nothing
 * about the authentication model changes: identical password, identical secret,
 * identical claims — only the transport differs.
 *
 * The token is returned in the JSON body. That is intentional and safe *here*
 * because a browser page cannot read this response cross-origin (no CORS
 * headers are set, so `fetch` from another origin is blocked by the browser),
 * and the endpoint never sets a cookie.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  // A separate bucket from the web login so the two cannot exhaust each other.
  const limit = rateLimit(`mobile-login:${ip}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
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
    console.error("[api/admin/mobile/login]", error);
    return jsonError("সার্ভারে ADMIN_PASSWORD সেট করা হয়নি।", 500);
  }

  if (!valid) {
    // Same message as the web login: never hint at which part was wrong.
    return jsonError("পাসওয়ার্ড ভুল হয়েছে।", 401);
  }

  const { token, expiresIn } = await issueMobileToken();
  return jsonOk({ ok: true, token, tokenType: "Bearer", expiresIn });
}
