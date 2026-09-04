import type { ThemePreference } from "@/lib/domain/types";

/**
 * Theme cookie names and defaults.
 *
 * Kept out of `app/actions/setTheme.ts` because a `"use server"` module may
 * export async functions ONLY — exporting a constant from it is a build error,
 * not a style preference.
 */

/** Read by `app/layout.tsx` on every server render. */
export const THEME_COOKIE = "tm_theme";

/** Written by the boot script via `document.cookie`; read on the server. */
export const SYSTEM_DARK_COOKIE = "tm_system_dark";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

/** One year: the preference is a durable setting, not a session value. */
export const THEME_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
