import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/session";

/**
 * Protects every /admin route at the edge, before any page code runs.
 * Unauthenticated visitors are sent to /admin/login with a `next` parameter.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  const session = await verifyAdminToken(token);

  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    if (session) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
