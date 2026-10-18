import type { NextRequest } from "next/server";
import { jsonError, jsonOk, logError, rateLimit } from "@/lib/api";
import { getAdminSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enabledEvents } from "@/lib/notifications/config";
import {
  isPushConfigured,
  missingPushEnvKeys,
  pushConfigIssue,
} from "@/lib/notifications/firebase-admin";
import { deviceRegisterSchema, fieldErrors } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Device registration for the Android lead-notification app.
 *
 * Authorisation comes from the existing admin session — either the browser
 * cookie or an `Authorization: Bearer` token issued by
 * `/api/admin/mobile/login`. The `adminId` a device is bound to is taken from
 * the **verified session**, never from the request body.
 */

/** Only the tail of the token is ever echoed back, and only to an admin. */
function tokenPreview(token: string): string {
  return token.length <= 6 ? "••••" : `••••${token.slice(-6)}`;
}

type DeviceRow = {
  id: string;
  token: string;
  platform: string;
  label: string | null;
  isActive: boolean;
  lastSeenAt: Date;
  createdAt: Date;
};

function present(device: DeviceRow) {
  return {
    id: device.id,
    platform: device.platform,
    label: device.label,
    isActive: device.isActive,
    lastSeenAt: device.lastSeenAt.toISOString(),
    createdAt: device.createdAt.toISOString(),
    tokenPreview: tokenPreview(device.token),
  };
}

/** GET /api/admin/devices — which phones are currently registered. */
export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) return jsonError("Unauthorized. অ্যাডমিন লগইন প্রয়োজন।", 401);

  try {
    const devices = await prisma.deviceToken.findMany({
      where: { adminId: session.sub },
      orderBy: [{ isActive: "desc" }, { lastSeenAt: "desc" }],
      select: {
        id: true,
        token: true,
        platform: true,
        label: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });

    return jsonOk({
      ok: true,
      devices: devices.map(present),
      /** Lets the app explain *why* no push arrives. */
      pushConfigured: isPushConfigured(),
      missingServerKeys: missingPushEnvKeys(),
      /**
       * A sanitized reason when `pushConfigured` is false even though no key is
       * missing — i.e. the variable is set but unusable (`missing-fields`,
       * `invalid-json`, `invalid-private-key`, `init-failed`). Field names only.
       */
      pushConfigIssue: pushConfigIssue(),
      enabledEvents: enabledEvents(),
    });
  } catch (error) {
    logError("[api/admin/devices] list failed:", error);
    return jsonError("ডিভাইসের তালিকা আনা যায়নি।", 500);
  }
}

/** POST /api/admin/devices — register (or refresh) this device's FCM token. */
export async function POST(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) return jsonError("Unauthorized. অ্যাডমিন লগইন প্রয়োজন।", 401);

  // Cheap abuse guard: token refresh happens on app start, not in a loop.
  const limit = rateLimit(`device-register:${session.sub}`, {
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return jsonError("অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।", 429);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("অবৈধ অনুরোধ।", 400);
  }

  const parsed = deviceRegisterSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError("ডিভাইস তথ্য সঠিক নয়।", 422, fieldErrors(parsed.error));
  }

  const { token, platform } = parsed.data;
  const label = parsed.data.label ? parsed.data.label : null;

  try {
    const existing = await prisma.deviceToken.findUnique({
      where: { token },
      select: { id: true, adminId: true },
    });

    // Never let one identity silently take over another's registration.
    if (existing && existing.adminId !== session.sub) {
      return jsonError("এই ডিভাইসটি অন্য একটি অ্যাকাউন্টে নিবন্ধিত।", 409);
    }

    const device = await prisma.deviceToken.upsert({
      where: { token },
      create: {
        token,
        adminId: session.sub,
        platform,
        label,
        isActive: true,
        lastSeenAt: new Date(),
      },
      update: {
        adminId: session.sub,
        platform,
        label,
        // Re-registering revives a token that was previously deactivated.
        isActive: true,
        lastSeenAt: new Date(),
      },
      select: {
        id: true,
        token: true,
        platform: true,
        label: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });

    return jsonOk({ ok: true, device: present(device) });
  } catch (error) {
    logError("[api/admin/devices] register failed:", error);
    return jsonError("ডিভাইস নিবন্ধন করা যায়নি।", 500);
  }
}

/**
 * DELETE /api/admin/devices?id=<id>|?token=<fcm token>
 *
 * Deactivates rather than deletes, so re-registering the same phone (a fresh
 * login) simply revives the row and the history stays intact. Always answers
 * `ok`, including for an unknown device, so the response cannot be used to probe
 * which tokens exist.
 */
export async function DELETE(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) return jsonError("Unauthorized. অ্যাডমিন লগইন প্রয়োজন।", 401);

  const id = request.nextUrl.searchParams.get("id")?.trim();
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!id && !token) {
    return jsonError("ডিভাইস আইডি অথবা টোকেন দিন।", 422);
  }

  try {
    await prisma.deviceToken.updateMany({
      where: {
        adminId: session.sub,
        ...(id ? { id } : { token: token! }),
      },
      data: { isActive: false },
    });
    return jsonOk({ ok: true });
  } catch (error) {
    logError("[api/admin/devices] unregister failed:", error);
    return jsonError("ডিভাইস নিবন্ধন বাতিল করা যায়নি।", 500);
  }
}
