import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  MOBILE_SESSION_MAX_AGE_SECONDS,
  SESSION_MAX_AGE_SECONDS,
  bearerTokenFrom,
  createAdminToken,
  safeEqual,
  verifyAdminToken,
} from "@/lib/session";

/** Read and verify the admin session from the request cookies. */
export async function getAdminSession() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get(ADMIN_COOKIE)?.value);
}

/**
 * Session for an arbitrary request: `Authorization: Bearer` first (native
 * clients), then the `fm_admin_session` cookie (browser).
 *
 * When an `Authorization` header is present it is authoritative — an invalid
 * bearer is rejected outright rather than silently falling back to an ambient
 * cookie.
 */
export async function getAdminSessionFromRequest(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (header) {
    return verifyAdminToken(bearerTokenFrom(header));
  }
  return verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  return (await getAdminSession()) !== null;
}

/** Create the session cookie (must be called from a route handler / action). */
export async function startAdminSession(): Promise<void> {
  const token = await createAdminToken();
  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Issue a bearer token for a native client. No cookie is set, so the same call
 * cannot be turned into a session for a browser by a third-party page.
 */
export async function issueMobileToken(): Promise<{
  token: string;
  expiresIn: number;
}> {
  const token = await createAdminToken(MOBILE_SESSION_MAX_AGE_SECONDS);
  return { token, expiresIn: MOBILE_SESSION_MAX_AGE_SECONDS };
}

export async function endAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/** True when the login password matches ADMIN_PASSWORD. */
export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error("ADMIN_PASSWORD is not set in the environment.");
  }
  return safeEqual(password, expected);
}
