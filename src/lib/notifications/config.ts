/**
 * Server-only configuration for the lead-notification pipeline.
 *
 * Nothing here is exposed to the browser: this module is imported exclusively by
 * route handlers that declare `runtime = "nodejs"`.
 */

import { MAX_SAFE_LENGTH, safeErrorText } from "@/lib/sanitize";

/** The Android notification channel the mobile app creates before it can receive anything. */
export const ANDROID_CHANNEL_ID = "orders_high";

/** Events the pipeline knows how to build a notification for. */
export const NOTIFY_EVENT_TYPES = [
  "order.created",
  "order.confirmed",
  "inquiry.created",
] as const;

export type NotifyEventType = (typeof NOTIFY_EVENT_TYPES)[number];

/**
 * Defaults are deliberately the *inbound lead* events.
 *
 * `order.confirmed` is implemented and available, but it is **off by default**:
 * it fires when a staff member moves a row to CONFIRMED, which is an action a
 * logged-in admin performs themselves — pushing to that same admin's phone
 * would just be their own tap echoed back. Turn it on with
 * `NOTIFY_EVENTS=order.created,order.confirmed,inquiry.created`.
 *
 * `NOTIFY_EVENTS=none` disables the pipeline entirely (jobs are recorded as
 * SKIPPED so the trail is still visible in the database).
 */
const DEFAULT_EVENTS: NotifyEventType[] = ["order.created", "inquiry.created"];

function isNotifyEventType(value: string): value is NotifyEventType {
  return (NOTIFY_EVENT_TYPES as readonly string[]).includes(value);
}

function parseEvents(raw: string | undefined): NotifyEventType[] {
  if (raw === undefined) return DEFAULT_EVENTS;
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return DEFAULT_EVENTS;
  if (parts.includes("none")) return [];
  return parts.filter(isNotifyEventType);
}

/** Which events may produce a push. */
export function enabledEvents(): NotifyEventType[] {
  return parseEvents(process.env.NOTIFY_EVENTS);
}

export function isEventEnabled(eventType: NotifyEventType): boolean {
  return enabledEvents().includes(eventType);
}

/** How many times a single job may be attempted before it is left alone. */
export const MAX_JOB_ATTEMPTS = 5;

/** Longest error string persisted on a job/delivery row. */
export const MAX_ERROR_LENGTH = MAX_SAFE_LENGTH;

/** A job younger than this is still eligible for automatic retry. */
export const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * How long a job may sit in `PROCESSING` before it is treated as orphaned.
 *
 * The inline dispatch runs in `after()`, i.e. *after* the response has been sent,
 * so the platform is free to freeze or reclaim the instance mid-send. When that
 * happens nothing writes a terminal status, and the row would stay `PROCESSING`
 * forever — invisible to `listRetryableJobIds()`, which only offers `PENDING` and
 * `FAILED`. A real send takes well under a second, so anything still `PROCESSING`
 * after this long is never coming back.
 *
 * Retrying is safe: delivery is recorded per (job, device), and a device that
 * already reached `SENT` is skipped, so the worst case is one extra push to a
 * device whose row was not written before the instance died.
 */
export const STALE_PROCESSING_MS = 5 * 60 * 1000;

/**
 * Trim, redact and clamp an error message so raw SDK text can never flood the
 * database or carry a credential. Delegates to the shared scrubber in
 * `@/lib/sanitize` so persisted error strings and log lines are redacted the
 * same way.
 */
export function safeError(error: unknown): string {
  return safeErrorText(error);
}
