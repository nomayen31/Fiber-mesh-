/**
 * Firebase Admin SDK bootstrap — **server only**.
 *
 * The Admin SDK can send a push to every registered device, so its credentials
 * are the most sensitive secret in this project:
 *
 *   - it is imported only from `src/lib/notifications/*`, which itself is
 *     imported only by route handlers with `runtime = "nodejs"`;
 *   - `getPushMessaging()` throws if it is ever evaluated in a browser bundle;
 *   - no credential value is ever logged, returned to a client, or stored in a
 *     `NEXT_PUBLIC_*` variable.
 *
 * Subpath imports (`firebase-admin/app`, `firebase-admin/messaging`) are used on
 * purpose: they keep Firestore/Storage out of the serverless bundle.
 *
 * When no credentials are present the module returns `null` rather than
 * throwing, so the whole pipeline degrades to "job recorded, delivery skipped"
 * and the website keeps working.
 */

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import { safeError } from "@/lib/notifications/config";

type ServiceAccountParts = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

/** Names only — used by diagnostics, never values. */
export const PUSH_ENV_KEYS = {
  blob: "FIREBASE_SERVICE_ACCOUNT_JSON",
  projectId: "FIREBASE_PROJECT_ID",
  clientEmail: "FIREBASE_CLIENT_EMAIL",
  privateKey: "FIREBASE_PRIVATE_KEY",
} as const;

/**
 * Private keys are normally pasted with escaped newlines (`\n`) when they travel
 * through a `.env` file, a shell export or a Vercel environment variable.
 */
function normalizePrivateKey(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

/**
 * Accepts either:
 *   1. `FIREBASE_SERVICE_ACCOUNT_JSON` — the whole service-account JSON, raw or
 *      base64-encoded (base64 survives newline mangling); or
 *   2. the three discrete `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` /
 *      `FIREBASE_PRIVATE_KEY` variables.
 */
function readServiceAccount(): ServiceAccountParts | null {
  const blob = process.env[PUSH_ENV_KEYS.blob]?.trim();
  if (blob) {
    const text = blob.startsWith("{")
      ? blob
      : Buffer.from(blob, "base64").toString("utf8");
    const parsed = JSON.parse(text) as Partial<ServiceAccountParts>;
    if (parsed.projectId && parsed.clientEmail && parsed.privateKey) {
      return {
        projectId: parsed.projectId,
        clientEmail: parsed.clientEmail,
        privateKey: normalizePrivateKey(parsed.privateKey),
      };
    }
    throw new Error(
      `${PUSH_ENV_KEYS.blob} is set but is missing projectId / clientEmail / privateKey.`,
    );
  }

  const projectId = process.env[PUSH_ENV_KEYS.projectId]?.trim();
  const clientEmail = process.env[PUSH_ENV_KEYS.clientEmail]?.trim();
  const privateKey = process.env[PUSH_ENV_KEYS.privateKey]?.trim();
  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey: normalizePrivateKey(privateKey),
    };
  }

  return null;
}

/** Which *variables* are missing. Values are never read out. */
export function missingPushEnvKeys(): string[] {
  if (process.env[PUSH_ENV_KEYS.blob]?.trim()) return [];
  return [
    PUSH_ENV_KEYS.projectId,
    PUSH_ENV_KEYS.clientEmail,
    PUSH_ENV_KEYS.privateKey,
  ].filter((key) => !process.env[key]?.trim());
}

let cached: Messaging | null | undefined;
let warned = false;

function adminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return getApp();
  const account = readServiceAccount();
  if (!account) throw new Error("No Firebase Admin credentials configured.");
  return initializeApp({
    credential: cert({
      projectId: account.projectId,
      clientEmail: account.clientEmail,
      privateKey: account.privateKey,
    }),
  });
}

/**
 * The cached Admin `Messaging` handle, or `null` when push is not configured.
 * Never throws for a missing/invalid configuration — a broken key must not take
 * orders down.
 */
export function getPushMessaging(): Messaging | null {
  if (typeof window !== "undefined") {
    throw new Error(
      "Firebase Admin must never be evaluated in the browser. Check that nothing client-side imports src/lib/notifications/*.",
    );
  }

  if (cached !== undefined) return cached;

  try {
    cached = getMessaging(adminApp());
  } catch (error) {
    cached = null;
    if (!warned) {
      warned = true;
      // Variable names and a sanitized message only — never the key itself.
      console.warn(
        `[notifications] push delivery disabled: ${safeError(error)} ` +
          `(missing: ${missingPushEnvKeys().join(", ") || "none"})`,
      );
    }
  }

  return cached;
}

/** True when a real push can be attempted. */
export function isPushConfigured(): boolean {
  return getPushMessaging() !== null;
}
