import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";

import { isThemePreference, resolveTheme } from "@/lib/domain/theme";
import { THEME_BOOT_SCRIPT } from "@/lib/theme/bootScript";
import {
  DEFAULT_THEME_PREFERENCE,
  SYSTEM_DARK_COOKIE,
  THEME_COOKIE,
} from "@/lib/theme/cookies";

import "./globals.css";

export const metadata: Metadata = {
  title: "Transaction Manager",
  description: "Gastos compartidos del hogar",
  appleWebApp: { capable: true, title: "Transaction Manager", statusBarStyle: "default" },
};

// `viewportFit: "cover"` is what makes iOS report real `env(safe-area-inset-*)`
// values. Without it they are 0, and when the app is launched from the home
// screen the bottom nav sits inside the home-indicator gesture area.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();

  const rawPreference = store.get(THEME_COOKIE)?.value;
  const preference = isThemePreference(rawPreference)
    ? rawPreference
    : DEFAULT_THEME_PREFERENCE;

  // Default '1' (dark) matches the prototype's `systemPrefersDark: true`.
  const systemPrefersDark = store.get(SYSTEM_DARK_COOKIE)?.value !== "0";
  const theme = resolveTheme(preference, systemPrefersDark);

  return (
    <html
      lang="es"
      data-theme={theme}
      data-theme-pref={preference}
      // The boot script below corrects `data-theme` before React hydrates.
      // This is the established App Router pattern for pre-hydration DOM
      // correction; no component reads the effective theme during render.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
