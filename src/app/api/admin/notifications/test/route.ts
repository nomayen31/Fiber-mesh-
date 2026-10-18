import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, jsonOk, logError, rateLimit } from "@/lib/api";
import { getAdminSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isPushConfigured,
  missingPushEnvKeys,
  pushConfigIssue,
} from "@/lib/notifications/firebase-admin";
import { firebaseSender } from "@/lib/notifications/sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `POST /api/admin/notifications/test` — "send a test notification to my phone".
 *
 * This exists because "the token is registered" and "a push actually arrives"
 * are different facts. It answers the middle one: *did Firebase accept a message
 * for my device?* Only the phone itself can answer the last one.
 *
 * Deliberate limits:
 *   - it requires the existing admin session (cookie **or** bearer token);
 *   - the target is always resolved from `session.sub`, never from the body, so
 *     it cannot be used to push to somebody else's phone;
 *   - it is rate limited per admin;
 *   - it sends a fixed, PII-free payload — no customer data is involved;
 *   - it creates **no** `NotificationJob` row: a test is a diagnostic, not a
 *     lead, and must not pollute the delivery ledger;
 *   - it returns FCM outcome codes only. Tokens and credentials are never
 *     echoed back, and a full service-account JSON is never read here.
 */
export async function POST(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) return jsonError("Unauthorized. অ্যাডমিন লগইন প্রয়োজন।", 401);

  const limit = rateLimit(`notify-test:${session.sub}`, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return jsonError(
      `একটানা অনেকবার টেস্ট করা হয়েছে। ${limit.retryAfterSeconds} সেকেন্ড পরে আবার চেষ্টা করুন।`,
      429,
    );
  }

  // An optional deviceId narrows the test to one phone. It is only ever used as
  // an extra filter on top of `adminId`, so a foreign id simply matches nothing.
  let deviceId = "";
  try {
    const body = (await request.json()) as { deviceId?: unknown } | null;
    if (body && typeof body.deviceId === "string") deviceId = body.deviceId.trim();
  } catch {
    // An empty body is valid: "test every device I have registered".
  }

  try {
    const devices = await prisma.deviceToken.findMany({
      where: {
        adminId: session.sub,
        isActive: true,
        ...(deviceId ? { id: deviceId } : {}),
      },
      orderBy: { lastSeenAt: "desc" },
      take: 5,
      select: { id: true, token: true, label: true },
    });

    if (devices.length === 0) {
      return jsonError(
        deviceId
          ? "এই ফোনটি নিবন্ধিত নেই। লগআউট করে আবার লগইন করুন।"
          : "এই অ্যাকাউন্টে কোনো নিবন্ধিত ফোন নেই। লগআউট করে আবার লগইন করুন।",
        404,
      );
    }

    // A missing server key is a *configuration* problem, not a delivery one, so
    // it gets its own status instead of being reported as a successful send.
    if (!isPushConfigured()) {
      const issue = pushConfigIssue();
      return NextResponse.json(
        {
          error:
            "সার্ভারে Firebase Admin কী ঠিকভাবে সেট করা নেই, তাই টেস্ট নোটিফিকেশন পাঠানো যাবে না।",
          pushConfigured: false,
          missingServerKeys: missingPushEnvKeys(),
          // Field names and a fixed phrase only — never a credential value.
          pushConfigIssue: issue,
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const content = {
      title: "টেস্ট নোটিফিকেশন",
      body: "Fiber Mesh নোটিফিকেশন ঠিকঠাক কাজ করছে।",
      data: { type: "test", entity: "none", screen: "settings" },
    };

    const results: Array<{
      deviceId: string;
      label: string | null;
      outcome: string;
      error?: string;
    }> = [];

    for (const device of devices) {
      const result = await firebaseSender.send(device.token, content);

      // Same rule as the lead pipeline: only a *confirmed* dead token is
      // deactivated. Nothing here can delete a row.
      if (result.outcome === "invalid-token") {
        await prisma.deviceToken
          .update({ where: { id: device.id }, data: { isActive: false } })
          .catch(() => undefined);
      }

      results.push({
        deviceId: device.id,
        label: device.label,
        outcome: result.outcome,
        // Sanitized FCM code only — `sender.ts` never puts the token in here.
        ...(result.error ? { error: result.error } : {}),
      });
    }

    return jsonOk({
      ok: true,
      sentCount: results.filter((result) => result.outcome === "sent").length,
      results,
    });
  } catch (error) {
    logError("[api/admin/notifications/test] failed:", error);
    return jsonError("টেস্ট নোটিফিকেশন পাঠানো যায়নি।", 500);
  }
}
