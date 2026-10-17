/**
 * Server-only configuration for the lead-notification pipeline.
 *
 * Nothing here is exposed to the browser: this module is imported exclusively by
 * route handlers that declare `runtime = "nodejs"`.
 */

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
export const MAX_ERROR_LENGTH = 400;

/** A job younger than this is still eligible for automatic retry. */
export const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Trim and clamp an error message so raw SDK text can never flood the database. */
export function safeError(error: unknown): string {
  const text =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : "unknown error";
  return text.replace(/\s+/g, " ").slice(0, MAX_ERROR_LENGTH);
}
