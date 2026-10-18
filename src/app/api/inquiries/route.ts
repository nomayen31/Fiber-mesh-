import type { NextRequest } from "next/server";
import { getClientIp, jsonError, jsonOk, logError, rateLimit } from "@/lib/api";
import { createInquiry } from "@/lib/inquiries";
import { queueInquiryNotification } from "@/lib/notifications/dispatch";
import { scheduleDispatch } from "@/lib/notifications/schedule";
import { fieldErrors, inquiryCreateSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/inquiries — the "যোগাযোগ" (contact) form on the landing page. */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = rateLimit(`inquiry:${ip}`, {
    limit: 6,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return jsonError(
      "অনেকবার বার্তা পাঠানো হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
      429,
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("অবৈধ অনুরোধ।", 400);
  }

  const parsed = inquiryCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(
      "ফর্মে কিছু তথ্য ঠিক নেই।",
      422,
      fieldErrors(parsed.error),
    );
  }

  if (parsed.data.website) {
    return jsonOk({ ok: true, spam: true });
  }

  try {
    const inquiry = await createInquiry(parsed.data);

    const jobId = await queueInquiryNotification({
      id: inquiry.id,
      name: parsed.data.name,
      subject: parsed.data.subject ? parsed.data.subject : null,
    });
    scheduleDispatch(jobId);

    return jsonOk({ ok: true });
  } catch (error) {
    logError("[api/inquiries] failed to save inquiry:", error);
    return jsonError(
      "দুঃখিত, বার্তাটি পাঠানো যায়নি। অনুগ্রহ করে ফোনে যোগাযোগ করুন।",
      500,
    );
  }
}
