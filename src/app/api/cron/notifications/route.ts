import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { bearerTokenFrom, safeEqual } from "@/lib/session";
import { dispatchPendingJobs } from "@/lib/notifications/dispatch";
import { isPushConfigured } from "@/lib/notifications/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Retries are fast (a handful of FCM calls); 60s is plenty of headroom. */
export const maxDuration = 60;

/**
 * GET|POST /api/cron/notifications
 *
 * Retry endpoint for the outbox. The normal path delivers inline right after an
 * order is saved; this exists for the cases where the serverless function was
 * frozen before delivery finished, or FCM was briefly unavailable.
 *
 * Authentication: a shared secret, compared in constant time.
 *   - `Authorization: Bearer <CRON_SECRET>` — what Vercel Cron sends.
 *   - `?secret=<CRON_SECRET>` — for any other scheduler (GitHub Actions, cron-job.org).
 *
 * With no `CRON_SECRET` set the endpoint is **disabled** (503) rather than open,
 * so it can never be an anonymous "spam everyone" button.
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const bearer = bearerTokenFrom(request.headers.get("authorization"));
  if (bearer && safeEqual(bearer, secret)) return true;

  const provided = request.nextUrl.searchParams.get("secret");
  return Boolean(provided && safeEqual(provided, secret));
}

async function handle(request: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return jsonError(
      "CRON_SECRET সেট করা নেই, তাই এই এন্ডপয়েন্ট নিষ্ক্রিয়।",
      503,
    );
  }

  if (!isAuthorized(request)) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const limitParam = Number.parseInt(
      request.nextUrl.searchParams.get("limit") ?? "",
      10,
    );
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 100)
      : 25;

    const result = await dispatchPendingJobs({ limit });
    return jsonOk({
      ok: true,
      pushConfigured: isPushConfigured(),
      processed: result.processed,
      summaries: result.summaries,
    });
  } catch (error) {
    console.error("[api/cron/notifications] failed:", error);
    return jsonError("রিট্রাই চালানো যায়নি।", 500);
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
