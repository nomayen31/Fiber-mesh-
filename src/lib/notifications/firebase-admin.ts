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

export type ServiceAccountParts = {
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
 * Why push delivery is off. Every field is a *name* or a fixed phrase — no part
 * of any credential value, and no value of any environment variable, is ever
 * carried in here. That is what makes it safe to return from an API route.
 */
export type PushConfigIssue = {
  code:
    | "no-credentials"
    | "invalid-json"
    | "missing-fields"
    | "invalid-private-key"
    | "init-failed";
  /** Field names only, e.g. `missing: project_id, client_email`. */
  detail: string;
};

class PushConfigError extends Error {
  readonly code: PushConfigIssue["code"];
  readonly detail: string;

  constructor(code: PushConfigIssue["code"], detail: string) {
    super(`${code}: ${detail}`);
    this.name = "PushConfigError";
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Private keys arrive with escaped newlines (`\n`) when they travel through a
 * `.env` file, a shell export or a single-line dashboard field, and with real
 * newlines when the JSON is pasted verbatim. Both spellings are accepted.
 */
function normalizePrivateKey(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

/**
 * Decode the credential blob. It may be the JSON file itself (`{` … `}`) or the
 * same JSON base64-encoded, which is what `docs/FIREBASE_SETUP.md` recommends
 * because a single base64 line cannot be mangled by a dashboard's newline
 * handling.
 */
export function decodeServiceAccountBlob(blob: string): string {
  const trimmed = blob.trim();
  if (trimmed.startsWith("{")) return trimmed;

  const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
  if (!decoded.startsWith("{")) {
    throw new PushConfigError(
      "invalid-json",
      `${PUSH_ENV_KEYS.blob} is neither JSON nor base64-encoded JSON`,
    );
  }
  return decoded;
}

/**
 * Turn service-account JSON text into the three values `cert()` needs.
 *
 * Both key spellings are accepted, because the file Google hands you and the
 * shape a hand-written variable tends to take are different:
 *
 *   - `project_id` / `client_email` / `private_key` — what
 *     *Project settings → Service accounts → Generate new private key* writes;
 *   - `projectId` / `clientEmail` / `privateKey` — camelCase, which earlier
 *     versions of this module expected.
 *
 * Accepting only camelCase was a real bug: a genuine service-account file can
 * never contain those names, so push silently stayed disabled no matter how
 * correctly the secret was configured.
 */
export function parseServiceAccountJson(text: string): ServiceAccountParts {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new PushConfigError("invalid-json", "the JSON could not be parsed");
  }

  const read = (...names: string[]): string => {
    for (const name of names) {
      const value = parsed[name];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };

  const projectId = read("project_id", "projectId");
  const clientEmail = read("client_email", "clientEmail");
  const privateKeyRaw = read("private_key", "privateKey");

  const missing = [
    !projectId && "project_id",
    !clientEmail && "client_email",
    !privateKeyRaw && "private_key",
  ].filter((name): name is string => Boolean(name));

  if (missing.length > 0) {
    throw new PushConfigError("missing-fields", `missing: ${missing.join(", ")}`);
  }

  const privateKey = normalizePrivateKey(privateKeyRaw);
  if (!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(privateKey)) {
    throw new PushConfigError(
      "invalid-private-key",
      "private_key is not a PEM block (expected '-----BEGIN PRIVATE KEY-----')",
    );
  }

  return { projectId, clientEmail, privateKey };
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
    return parseServiceAccountJson(decodeServiceAccountBlob(blob));
  }

  const projectId = process.env[PUSH_ENV_KEYS.projectId]?.trim();
  const clientEmail = process.env[PUSH_ENV_KEYS.clientEmail]?.trim();
  const privateKey = process.env[PUSH_ENV_KEYS.privateKey]?.trim();
  if (projectId && clientEmail && privateKey) {
    const normalized = normalizePrivateKey(privateKey);
    if (!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(normalized)) {
      throw new PushConfigError(
        "invalid-private-key",
        `${PUSH_ENV_KEYS.privateKey} is not a PEM block`,
      );
    }
    return { projectId, clientEmail, privateKey: normalized };
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
let lastIssue: PushConfigIssue | null = null;

function adminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return getApp();
  const account = readServiceAccount();
  if (!account) {
    throw new PushConfigError("no-credentials", "no Firebase Admin credentials present");
  }
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
    lastIssue = null;
  } catch (error) {
    cached = null;
    lastIssue =
      error instanceof PushConfigError
        ? { code: error.code, detail: error.detail }
        : // A failure inside the SDK itself. The detail stays generic on
          // purpose: an SDK error is the one place a credential value could
          // theoretically be echoed, and this value is returned over HTTP.
          { code: "init-failed", detail: "the Admin SDK rejected the credential" };
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

/**
 * Why push is off, as a value that is safe to show an administrator. `null`
 * when push is working.
 */
export function pushConfigIssue(): PushConfigIssue | null {
  getPushMessaging();
  return lastIssue;
}
