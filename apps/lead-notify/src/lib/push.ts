/**
 * Push notifications (Firebase Cloud Messaging, via `expo-notifications`).
 *
 * The backend sends a **notification message** with `android.priority: "high"`,
 * so the same push is delivered whether the app is foregrounded, backgrounded or
 * terminated. This module is only responsible for the device side:
 *
 *   1. create the Android notification channel (must exist *before* the first
 *      token is requested — the platform requires it),
 *   2. ask for the Android 13+ POST_NOTIFICATIONS permission,
 *   3. fetch the FCM registration token (`getDevicePushTokenAsync`),
 *   4. keep that token fresh.
 *
 * It deliberately does **not** talk to the backend — registration lives in
 * `src/components/NotificationBridge.tsx`, which owns the authenticated session.
 */

import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

/**
 * Must match `ANDROID_CHANNEL_ID` in the backend
 * (`src/lib/notifications/config.ts`) and `defaultChannel` in app.json.
 */
export const ANDROID_CHANNEL_ID = "orders_high";

/**
 * Foreground presentation. Without a handler, a push received while the app is
 * open would be silently swallowed on Android.
 *
 * `shouldShowBanner` / `shouldShowList` are the SDK 53+ names — the older
 * `shouldShowAlert` no longer exists.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushSetupResult =
  | { status: "ready"; token: string; label: string }
  /** The user (or a policy) denied notifications. Nothing can be delivered. */
  | { status: "permission-denied" }
  /** No FCM possible: simulator, or Expo Go without a native Firebase build. */
  | { status: "unsupported"; reason: string }
  | { status: "error"; message: string };

/** `Pixel 7 · Android 15` — shown on the Settings screen. */
export function deviceLabel(): string {
  const model = Device.modelName ?? "Android";
  const os = Device.osVersion ? `Android ${Device.osVersion}` : "";
  return [model, os].filter(Boolean).join(" · ");
}

/**
 * Create the high-importance channel. Safe to call repeatedly — the platform
 * ignores a re-definition with the same id.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "নতুন অর্ডার",
    description: "নতুন অর্ডার ও গ্রাহকের মেসেজের জন্য নোটিফিকেশন",
    importance: Notifications.AndroidImportance.MAX,
    // Heads-up + sound + vibration, so a new lead is never missed.
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#2574eb",
    sound: "default",
    enableVibrate: true,
    showBadge: true,
  });
}

/** True when notification permission is currently granted. */
export async function hasPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  return current.granted;
}

/**
 * Ask for permission. On Android 13+ this is the POST_NOTIFICATIONS runtime
 * prompt; on older Android versions permission is granted at install time and
 * this resolves immediately.
 */
export async function requestPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * The FCM registration token.
 *
 * Returns `null` (with a reason) instead of throwing when the platform cannot
 * supply one, because that is a normal, expected state:
 *   - `Device.isDevice` is false on an emulator without Google Play services;
 *   - Expo Go no longer bundles the native FCM library.
 */
export async function getFcmToken(): Promise<
  { ok: true; token: string } | { ok: false; reason: string }
> {
  if (Platform.OS !== "android") {
    return {
      ok: false,
      reason: "এই অ্যাপটি আপাতত শুধু Android-এর জন্য তৈরি করা হয়েছে।",
    };
  }

  const token = await Notifications.getDevicePushTokenAsync();
  if (!token?.data || typeof token.data !== "string") {
    return { ok: false, reason: "ডিভাইস থেকে FCM টোকেন পাওয়া যায়নি।" };
  }
  return { ok: true, token: token.data };
}

/**
 * Full setup sequence, in the order the platform requires:
 * channel → permission → token.
 */
export async function setupPush(): Promise<PushSetupResult> {
  try {
    // 1. The channel must exist before a token is requested.
    await ensureAndroidChannel();

    // 2. A real device is required for a real FCM token.
    if (!Device.isDevice) {
      return {
        status: "unsupported",
        reason: "এমুলেটরে পুশ নোটিফিকেশন পাওয়া যায় না। আসল ফোনে চালান।",
      };
    }

    // 3. Android 13+ runtime permission.
    const granted = await requestPermission();
    if (!granted) {
      return { status: "permission-denied" };
    }

    // 4. The FCM registration token itself.
    const result = await getFcmToken();
    if (!result.ok) {
      return { status: "unsupported", reason: result.reason };
    }

    return { status: "ready", token: result.token, label: deviceLabel() };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "নোটিফিকেশন চালু করা যায়নি।",
    };
  }
}

/* ───────────────────────────── listeners ───────────────────────────── */

/**
 * FCM rotates a registration token from time to time; the old one starts failing
 * immediately, so the new one must be pushed to the server right away.
 */
export function addTokenRefreshListener(
  onToken: (token: string) => void,
): Notifications.EventSubscription {
  return Notifications.addPushTokenListener((token) => {
    if (typeof token.data === "string" && token.data.length > 0) {
      onToken(token.data);
    }
  });
}

/**
 * Extract the deep-link target from a notification.
 * The backend puts `{ entity, orderId, inquiryId, screen }` in the FCM `data`
 * payload; every value arrives as a string.
 */
export type LeadTarget =
  | { kind: "order"; id: string }
  | { kind: "inquiry"; id: string }
  | { kind: "list" };

export function targetFromResponse(
  response: Notifications.NotificationResponse | null | undefined,
): LeadTarget | null {
  const data = response?.notification?.request?.content?.data;
  if (!data) return null;

  const entity = typeof data.entity === "string" ? data.entity : null;

  if (entity === "order") {
    const id = typeof data.orderId === "string" ? data.orderId : null;
    return id ? { kind: "order", id } : { kind: "list" };
  }

  if (entity === "inquiry") {
    const id = typeof data.inquiryId === "string" ? data.inquiryId : null;
    return id ? { kind: "inquiry", id } : { kind: "list" };
  }

  return { kind: "list" };
}

/** Stable id for de-duplicating the cold-start response against the listener. */
export function responseKey(
  response: Notifications.NotificationResponse | null | undefined,
): string | null {
  const request = response?.notification?.request;
  if (!request?.identifier) return null;
  return `${request.identifier}:${response?.actionIdentifier ?? ""}`;
}
