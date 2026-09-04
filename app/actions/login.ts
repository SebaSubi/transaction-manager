"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  GENERIC_LOGIN_ERROR,
  type LoginState,
} from "@/lib/auth/loginState";
import { passwordMatches } from "@/lib/auth/password";
import { sanitizeNextPath } from "@/lib/auth/redirect";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
} from "@/lib/auth/session";

/**
 * Shared-password login (design §3).
 *
 * The password never leaves the server: this is a Server Action on the Node
 * runtime, which is also where `node:crypto`'s `timingSafeEqual` lives.
 */
export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const submitted = formData.get("password");
  const next = sanitizeNextPath(
    typeof formData.get("next") === "string" ? (formData.get("next") as string) : null,
  );

  const expected = process.env.APP_PASSWORD;
  if (expected === undefined || expected.trim() === "") {
    // Fail CLOSED: an unconfigured deployment denies everyone rather than
    // letting an empty submission through.
    return { error: GENERIC_LOGIN_ERROR };
  }

  if (typeof submitted !== "string" || !(await passwordMatches(submitted, expected))) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(), {
    httpOnly: true,
    // Unconditional, NOT `NODE_ENV === 'production'`. The spec requires
    // `secure=true` outright, and every current browser accepts `Secure` on
    // `http://localhost`, so a development-only exception buys nothing and
    // leaves dev running under attributes production never uses.
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect(next);
}
