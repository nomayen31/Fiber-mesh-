/**
 * The push transport, behind a narrow interface so the whole delivery pipeline
 * can be unit-tested with a stub and without a network call.
 */

import { ANDROID_CHANNEL_ID, safeError } from "@/lib/notifications/config";
import { getPushMessaging } from "@/lib/notifications/firebase-admin";

export type PushContent = {
  title: string;
  body: string;
  data: Record<string, string>;
};

export type SendOutcome =
  /** FCM accepted the message. */
  | "sent"
  /** The token is permanently dead — the device row must be deactivated. */
  | "invalid-token"
  /** Transient or unknown failure — safe to retry later. */
  | "failed"
  /** Nothing was attempted (push not configured, or the event is disabled). */
  | "skipped";

export type SendResult = {
  outcome: SendOutcome;
  messageId?: string;
  /** FCM error code or a short sanitized message. Never contains the token. */
  error?: string;
};

export interface PushSender {
  /** False when the transport has no credentials and can never succeed. */
  readonly configured: boolean;
  send(token: string, content: PushContent): Promise<SendResult>;
}

/**
 * FCM error codes that mean "this token will never work again". Only these
 * deactivate a device; a generic `invalid-argument` could just as easily be a
 * malformed payload, and silently unregistering a working phone would be worse
 * than a retry.
 */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

function errorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "";
}

/**
 * Map a raw FCM/Admin SDK rejection onto a `SendResult`.
 * Pure and exported so the classification rules can be unit-tested without the
 * SDK, a credentials file or a network call.
 */
export function classifyFirebaseError(error: unknown): SendResult {
  const code = errorCode(error);
  if (DEAD_TOKEN_CODES.has(code)) {
    return { outcome: "invalid-token", error: code };
  }
  return { outcome: "failed", error: code || safeError(error) };
}

export const firebaseSender: PushSender = {
  get configured() {
    return getPushMessaging() !== null;
  },

  async send(token: string, content: PushContent): Promise<SendResult> {
    const messaging = getPushMessaging();
    if (!messaging) {
      return { outcome: "skipped", error: "push-not-configured" };
    }

    try {
      const messageId = await messaging.send({
        token,
        notification: { title: content.title, body: content.body },
        data: content.data,
        android: {
          // Data-only messages are throttled in Doze; a high-priority
          // notification message is delivered immediately.
          priority: "high",
          ttl: 60 * 60 * 1000,
          notification: {
            channelId: ANDROID_CHANNEL_ID,
            sound: "default",
            defaultVibrateTimings: true,
          },
        },
      });
      return { outcome: "sent", messageId };
    } catch (error) {
      return classifyFirebaseError(error);
    }
  },
};
