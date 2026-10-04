import { cookies } from "next/headers";

import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Thrown when a Server Action is invoked without a valid session.
 */
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Defense in depth for Server Actions (design Decision 9).
 *
 * Every exported Server Action is reachable by a direct POST, and `proxy.ts`
 * deliberately lets `/login` through, so each mutating action calls this as
 * its FIRST statement, before any parsing, read or write. It costs one HMAC
 * verification and touches no database.
 */
export async function assertSession(): Promise<void> {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (session === null) {
    throw new UnauthorizedError();
  }
}
