import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { DEFAULT_AUTHENTICATED_PATH, LOGIN_PATH } from "@/lib/auth/redirect";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * The shared-password gate (design §3).
 *
 * Everything except the static-asset set is gated by the matcher below.
 * `/login` escapes through the explicit early return here rather than through
 * the matcher, so a matcher typo alone cannot lock the household out of the
 * login screen — and keeping `/login` inside the matcher is also what lets us
 * bounce an already-authenticated visitor away from it.
 *
 * Every rejection path is identical: absent, malformed, unsigned, tampered and
 * expired all produce the same delete-cookie + 307. There is no branch that
 * could accidentally admit one of them.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === LOGIN_PATH) {
    if (session !== null) {
      return NextResponse.redirect(
        new URL(DEFAULT_AUTHENTICATED_PATH, request.nextUrl),
      );
    }
    return NextResponse.next();
  }

  if (session !== null) {
    return NextResponse.next();
  }

  const loginUrl = new URL(LOGIN_PATH, request.nextUrl);
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  const response = NextResponse.redirect(loginUrl);
  // Deleting is what stops an expired cookie being resent on every subsequent
  // navigation and re-failing verification each time.
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest).*)",
  ],
};
