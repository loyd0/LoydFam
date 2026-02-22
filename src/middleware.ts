import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Lightweight middleware that checks for the presence of a session cookie.
 * We can't import Prisma or Auth.js here because middleware runs in Edge Runtime
 * and Prisma requires Node.js APIs. Instead, we just check for the session token
 * cookie and redirect to /login if it's missing.
 *
 * The actual session validation happens at the page/API level via Auth.js.
 */
export function middleware(request: NextRequest) {
  const sessionToken =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (NextAuth routes)
     * - login page
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
