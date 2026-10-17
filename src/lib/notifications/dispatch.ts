/**
 * Lead-notification dispatcher.
 *
 * Delivery rules, in one place:
 *
 *   - **Durable first.** `enqueue*` commits an outbox row *before* the HTTP
 *     response is flushed, so a job can never be lost to a frozen serverless
 *     function. Sending is a second, best-effort step.
 *   - **Idempotent.** One job per `eventKey`. A per-device delivery row is only
 *     written once, and a device whose delivery already reached SENT is never
 *     sent to twice.
 *   - **Isolated.** Nothing here throws at the caller. A push outage must never
 *     fail an order, and it must never look like an order failure to a customer.
 *   - **Recoverable.** Failures keep the job in FAILED with an incrementing
 *     attempt counter, so `dispatchPendingJobs()` (served by the retry endpoint)
 *     can pick it up again.
 */

import type { DeliveryStatus } from "@prisma/client";
import {
  MAX_JOB_ATTEMPTS,
  RETRY_WINDOW_MS,
  isEventEnabled,
  safeError,
  type NotifyEventType,
} from "@/lib/notifications/config";
import {
  buildInquiryNotification,
  buildOrderNotification,
  eventKeyFor,
  toJobPayload,
  type InquiryNotificationSource,
  type OrderNotificationSource,
} from "@/lib/notifications/payload";
import { firebaseSender, type PushSender } from "@/lib/notifications/sender";
import {
  prismaNotificationStore,
  type NotificationStore,
} from "@/lib/notifications/store";

export type DispatchDeps = {
  store?: NotificationStore;
  sender?: PushSender;
};

export type DispatchSummary = {
  jobId: string;
  status: DeliveryStatus | "MISSING";
  sent: number;
  failed: number;
  skipped: number;
  invalidTokens: number;
  /** True when the job had already been delivered and nothing was re-sent. */
  alreadyDone: boolean;
  error?: string;
};

function resolve(deps: DispatchDeps) {
  return {
    store: deps.store ?? prismaNotificationStore,
    sender: deps.sender ?? firebaseSender,
  };
}

/* ───────────────────────────── enqueue ───────────────────────────── */

/**
 * Persist an outbox job for a newly created order.
 * Returns the job id, or `null` when the event is disabled, already queued, or
 * the insert failed. Never throws.
 */
export async function enqueueOrderNotification(
  order: OrderNotificationSource,
  eventType: "order.created" | "order.confirmed" = "order.created",
  deps: DispatchDeps = {},
): Promise<string | null> {
  if (!isEventEnabled(eventType)) return null;
  const { store } = resolve(deps);
  const content = buildOrderNotification(order, eventType);
  const job = await store.createJob({
    eventKey: eventKeyFor(eventType, order.id),
    eventType,
    orderId: order.id,
    title: content.title,
    body: content.body,
    payload: toJobPayload(content, eventType),
  });
  return job?.id ?? null;
}

export async function enqueueInquiryNotification(
  inquiry: InquiryNotificationSource,
  deps: DispatchDeps = {},
): Promise<string | null> {
  const eventType: NotifyEventType = "inquiry.created";
  if (!isEventEnabled(eventType)) return null;
  const { store } = resolve(deps);
  const content = buildInquiryNotification(inquiry);
  const job = await store.createJob({
    eventKey: eventKeyFor(eventType, inquiry.id),
    eventType,
    orderId: null,
    title: content.title,
    body: content.body,
    payload: toJobPayload(content, eventType),
  });
  return job?.id ?? null;
}

/** Enqueue wrapper that swallows every error and logs a sanitized message. */
export async function queueOrderNotification(
  order: OrderNotificationSource,
  eventType: "order.created" | "order.confirmed" = "order.created",
): Promise<string | null> {
  try {
    return await enqueueOrderNotification(order, eventType);
  } catch (error) {
    console.error(
      "[notifications] could not queue order notification:",
      safeError(error),
    );
    return null;
  }
}

export async function queueInquiryNotification(
  inquiry: InquiryNotificationSource,
): Promise<string | null> {
  try {
    return await enqueueInquiryNotification(inquiry);
  } catch (error) {
    console.error(
      "[notifications] could not queue inquiry notification:",
      safeError(error),
    );
    return null;
  }
}

/* ──────────────────────────── dispatch ──────────────────────────── */

/**
 * Attempt delivery of one job to every active device.
 * Always resolves — failures are recorded, never thrown.
 */
export async function dispatchJob(
  jobId: string,
  deps: DispatchDeps = {},
): Promise<DispatchSummary> {
  const { store, sender } = resolve(deps);
  const base: DispatchSummary = {
    jobId,
    status: "MISSING",
    sent: 0,
    failed: 0,
    skipped: 0,
    invalidTokens: 0,
    alreadyDone: false,
  };

  try {
    const job = await store.getJob(jobId);
    if (!job) return { ...base, error: "job-not-found" };

    if (job.status === "SENT") {
      return { ...base, status: "SENT", alreadyDone: true };
    }

    await store.updateJob(jobId, {
      status: "PROCESSING",
      attempts: job.attempts + 1,
    });

    const devices = await store.listActiveDevices();
    if (devices.length === 0) {
      await store.updateJob(jobId, {
        status: "SKIPPED",
        lastError: "no-active-device",
        processedAt: new Date(),
      });
      return { ...base, status: "SKIPPED" };
    }

    const content = { title: job.title, body: job.body, data: job.payload };
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let invalidTokens = 0;
    let firstError: string | null = null;

    for (const device of devices) {
      const existing = await store.getDeliveryStatus(jobId, device.id);
      if (existing === "SENT") {
        // Already delivered to this device — never send twice.
        sent += 1;
        continue;
      }

      const result = await sender.send(device.token, content);

      if (result.outcome === "sent") {
        sent += 1;
        await store.upsertDelivery({
          jobId,
          deviceTokenId: device.id,
          status: "SENT",
          messageId: result.messageId ?? null,
          error: null,
        });
        continue;
      }

      if (result.outcome === "invalid-token") {
        invalidTokens += 1;
        firstError ??= result.error ?? "invalid-token";
        await store.upsertDelivery({
          jobId,
          deviceTokenId: device.id,
          status: "FAILED",
          error: result.error ?? "invalid-token",
        });
        // The app was uninstalled or the token was rotated: stop using it.
        await store.deactivateDevice(device.id);
        continue;
      }

      if (result.outcome === "skipped") {
        skipped += 1;
        await store.upsertDelivery({
          jobId,
          deviceTokenId: device.id,
          status: "SKIPPED",
          error: result.error ?? "skipped",
        });
        continue;
      }

      failed += 1;
      firstError ??= result.error ?? "send-failed";
      await store.upsertDelivery({
        jobId,
        deviceTokenId: device.id,
        status: "FAILED",
        error: result.error ?? "send-failed",
      });
    }

    // Any unresolved failure keeps the job retryable; the per-device guard above
    // means a retry only ever touches the devices that are still missing.
    const status: DeliveryStatus =
      failed > 0
        ? "FAILED"
        : sent > 0
          ? "SENT"
          : invalidTokens > 0
            ? "FAILED"
            : "SKIPPED";

    await store.updateJob(jobId, {
      status,
      sentCount: sent,
      failedCount: failed + invalidTokens,
      lastError: firstError,
      processedAt: new Date(),
    });

    return {
      jobId,
      status,
      sent,
      failed,
      skipped,
      invalidTokens,
      alreadyDone: false,
      ...(firstError ? { error: firstError } : {}),
    };
  } catch (error) {
    const message = safeError(error);
    console.error(`[notifications] dispatch failed for job ${jobId}:`, message);
    // Best effort: mark it failed so the retry endpoint can pick it up.
    try {
      await store.updateJob(jobId, { status: "FAILED", lastError: message });
    } catch {
      /* the store itself is unavailable — nothing more we can do */
    }
    return { ...base, status: "FAILED", error: message };
  }
}

/** Retry every job that is still pending or has previously failed. */
export async function dispatchPendingJobs(
  deps: DispatchDeps & { limit?: number } = {},
): Promise<{ processed: number; summaries: DispatchSummary[] }> {
  const { store } = resolve(deps);
  const limit = deps.limit ?? 25;
  const ids = await store.listRetryableJobIds({
    since: new Date(Date.now() - RETRY_WINDOW_MS),
    maxAttempts: MAX_JOB_ATTEMPTS,
    limit,
  });

  const summaries: DispatchSummary[] = [];
  for (const id of ids) {
    summaries.push(await dispatchJob(id, deps));
  }
  return { processed: summaries.length, summaries };
}
