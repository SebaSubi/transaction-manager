import type { EffectiveTheme, ThemePreference } from "@/lib/domain/types";

const THEME_PREFERENCES: readonly ThemePreference[] = ["dark", "light", "system"];

/** Guards the `tm_theme` cookie value; anything else is rejected. */
export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === "string" &&
    (THEME_PREFERENCES as readonly string[]).includes(value)
  );
}

/**
 * Collapses a preference plus the OS answer into the attribute rendered on
 * `<html data-theme>`. Only `'system'` consults `systemPrefersDark`.
 */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): EffectiveTheme {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }
  return preference;
}
