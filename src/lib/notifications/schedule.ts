import { after } from "next/server";
import { safeError } from "@/lib/notifications/config";
import { dispatchJob } from "@/lib/notifications/dispatch";

/**
 * Best-effort inline delivery, scheduled to run **after** the HTTP response has
 * been flushed so a slow FCM call can never delay an order confirmation.
 *
 * This is an optimisation, not the durability guarantee: the outbox row is
 * already committed before this is called, so if the serverless function is
 * frozen the moment the response is sent, `/api/cron/notifications` still
 * delivers the job later.
 *
 * Kept in its own module (importing `next/server`) so that
 * `src/lib/notifications/dispatch.ts` stays importable from plain Node tests.
 */
export function scheduleDispatch(jobId: string | null | undefined): void {
  if (!jobId) return;
  try {
    after(() => dispatchJob(jobId));
  } catch (error) {
    // Called outside a request scope (a script, a test, a seed). The job is
    // already durable; the retry endpoint owns it now.
    console.warn(
      "[notifications] inline dispatch not scheduled:",
      safeError(error),
    );
  }
}
