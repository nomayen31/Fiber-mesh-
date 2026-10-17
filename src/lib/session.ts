import { jwtVerify, SignJWT } from "jose";

/**
 * Edge-safe session helpers (no Node-only APIs), so this module can be
 * imported from `middleware.ts` as well as from route handlers.
 */

export const ADMIN_COOKIE = "fm_admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

/**
 * The Android app cannot rely on an `httpOnly` cookie, so it holds the very same
 * signed JWT and presents it as `Authorization: Bearer <token>`.
 *
 * A phone that is carried around needs to stay signed in, so the mobile token
 * lives longer than the browser one. That is a deliberate trade-off — a stolen
 * phone yields a longer-lived token — and it is bounded and tunable:
 * `MOBILE_SESSION_MAX_AGE_SECONDS` (default 30 days, hard-capped at 90 days).
 * Logging out of the app deletes the stored token and unregisters the device.
 */
export const MOBILE_SESSION_MAX_AGE_SECONDS = (() => {
  const parsed = Number.parseInt(
    process.env.MOBILE_SESSION_MAX_AGE_SECONDS ?? "",
    10,
  );
  const oneHour = 60 * 60;
  const ninetyDays = 90 * 24 * oneHour;
  if (Number.isFinite(parsed) && parsed >= oneHour && parsed <= ninetyDays) {
    return parsed;
  }
  return 30 * 24 * oneHour;
})();

/**
 * Pull a bearer token out of an `Authorization` header.
 * Returns `null` for any other scheme (Basic, etc.).
 */
export function bearerTokenFrom(
  header: string | null | undefined,
): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

function getSecretKey(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ??
    "dev-only-secret-change-me-please-0123456789abcdef";
  if (secret.length < 32) {
    // Fail loudly in production, keep working in development.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET must be at least 32 characters long. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
      );
    }
  }
  return new TextEncoder().encode(secret.padEnd(32, "."));
}

export type AdminSession = {
  sub: string;
  role: "admin";
};

/** Create a signed JWT for the admin dashboard session. */
export async function createAdminToken(
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(getSecretKey());
}

/** Verify a session token. Returns null when invalid/expired. */
export async function verifyAdminToken(
  token: string | undefined | null,
): Promise<AdminSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    if (payload.role !== "admin") return null;
    return { sub: String(payload.sub ?? "admin"), role: "admin" };
  } catch {
    return null;
  }
}

/**
 * Constant-time string comparison so the admin password cannot be guessed
 * by measuring response times.
 */
export function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) {
    // Still compare something to keep the timing profile flat.
    let diff = 1;
    for (let i = 0; i < aBytes.length; i++) {
      diff |= aBytes[i]! ^ bBytes[i % Math.max(1, bBytes.length)]!;
    }
    return false;
  }
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i]! ^ bBytes[i]!;
  }
  return diff === 0;
}
