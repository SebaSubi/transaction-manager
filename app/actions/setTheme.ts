"use server";

import { cookies } from "next/headers";

import { assertSession } from "@/lib/auth/requireSession";
import { isThemePreference } from "@/lib/domain/theme";
import { THEME_COOKIE, THEME_MAX_AGE_SECONDS } from "@/lib/theme/cookies";

/**
 * Persists the theme preference in a cookie rather than `localStorage`.
 *
 * A cookie is readable during the SERVER render, so the very first byte of
 * HTML already carries the right `data-theme` and the correct palette paints
 * immediately. `localStorage` is only readable after hydration, which is
 * exactly the flash this design exists to avoid (design §7).
 *
 * The value is validated by `isThemePreference`: only 'dark', 'light' and
 * 'system' are ever written.
 */
export async function setTheme(preference: unknown): Promise<void> {
  // FIRST statement: a Server Action is reachable by a direct POST, so the
  // session is verified before anything is validated, read or written.
  await assertSession();

  if (!isThemePreference(preference)) {
    throw new Error(`Invalid theme preference: ${String(preference)}`);
  }

  const store = await cookies();
  store.set(THEME_COOKIE, preference, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: THEME_MAX_AGE_SECONDS,
  });
}
