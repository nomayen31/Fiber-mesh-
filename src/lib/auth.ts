import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createAdminToken,
  safeEqual,
  verifyAdminToken,
} from "@/lib/session";

/** Read and verify the admin session from the request cookies. */
export async function getAdminSession() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get(ADMIN_COOKIE)?.value);
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
