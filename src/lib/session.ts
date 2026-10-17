import { jwtVerify, SignJWT } from "jose";

/**
 * Edge-safe session helpers (no Node-only APIs), so this module can be
 * imported from `middleware.ts` as well as from route handlers.
 */

export const ADMIN_COOKIE = "fm_admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

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
export async function createAdminToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
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
