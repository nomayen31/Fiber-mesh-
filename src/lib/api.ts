import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAdminSession, getAdminSessionFromRequest } from "@/lib/auth";

/** Small in-memory rate limiter (per process). Enough for form spam control. */
const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const windowStart = now - options.windowMs;
  const hits = (buckets.get(key) ?? []).filter((time) => time > windowStart);

  if (hits.length >= options.limit) {
    const retryAfterSeconds = Math.ceil(
      (hits[0]! + options.windowMs - now) / 1000,
    );
    buckets.set(key, hits);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  hits.push(now);
  buckets.set(key, hits);

  // Opportunistic cleanup so the map cannot grow forever.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((time) => time <= windowStart)) buckets.delete(k);
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data as object, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function jsonError(
  message: string,
  status = 400,
  errors?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    { error: message, ...(errors ? { errors } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Guard for `/api/admin/*` handlers. Returns a 401 response when the caller
 * has no valid session, otherwise null (meaning "carry on").
 *
 * Pass the request to accept `Authorization: Bearer <token>` (native clients) in
 * addition to the browser session cookie. Handlers that omit it are cookie-only.
 */
export async function guardAdmin(
  request?: NextRequest,
): Promise<NextResponse | null> {
  const session = request
    ? await getAdminSessionFromRequest(request)
    : await getAdminSession();
  if (!session) {
    return jsonError("Unauthorized. অ্যাডমিন লগইন প্রয়োজন।", 401);
  }
  return null;
}
