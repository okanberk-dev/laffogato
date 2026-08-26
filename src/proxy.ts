import { NextResponse, type NextRequest } from "next/server";

import {
  ADMIN_COOKIE_NAME,
  readSessionFromCookieValue,
} from "@/lib/admin/auth";

/**
 * Admin route guard.
 *
 * Reads the signed session cookie and redirects unauthenticated visitors
 * to /admin/giris. The cookie is verified in full by the admin layout; this
 * only checks for its presence, which is all the edge runtime can do cheaply.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAdminRoute = path.startsWith("/admin");
  const isAdminLogin = path === "/admin/giris";

  if (!isAdminRoute || isAdminLogin) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const session = readSessionFromCookieValue(cookie);

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/giris";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
