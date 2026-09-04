"use client";

import { useEffect } from "react";

/**
 * Keeps `'system'` live after first paint.
 *
 * The blocking boot script in `app/layout.tsx` corrects the theme BEFORE first
 * paint; this only handles the OS preference changing while the app is open.
 * It writes `data-theme` on `<html>` and refreshes the `tm_system_dark` cookie
 * so the next server render already guesses right — it never puts the theme
 * into React state, which is what would reintroduce a hydration mismatch.
 */
export function SystemThemeWatcher() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = (prefersDark: boolean) => {
      const root = document.documentElement;
      if (root.dataset.themePref !== "system") return;
      root.dataset.theme = prefersDark ? "dark" : "light";
      document.cookie = `tm_system_dark=${prefersDark ? "1" : "0"};path=/;max-age=31536000;samesite=lax`;
    };

    const onChange = (event: MediaQueryListEvent) => apply(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return null;
}
