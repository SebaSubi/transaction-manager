"use client";

import { startTransition, useOptimistic } from "react";

import { setTheme } from "@/app/actions/setTheme";
import {
  SegmentedControl,
  type SegmentedOption,
} from "@/components/molecules/SegmentedControl";
import { PROFILE_COPY } from "@/lib/copy/es";
import { resolveTheme } from "@/lib/domain/theme";
import type { ThemePreference } from "@/lib/domain/types";

const OPTIONS: readonly SegmentedOption<ThemePreference>[] = [
  { value: "dark", label: PROFILE_COPY.themeDark },
  { value: "light", label: PROFILE_COPY.themeLight },
  { value: "system", label: PROFILE_COPY.themeSystem },
];

/**
 * Writes the preference and the effective theme on `<html>` so the palette
 * changes on the same frame, without putting the theme into render state.
 */
export function applyThemeToDocument(preference: ThemePreference): void {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.themePref = preference;
  root.dataset.theme = resolveTheme(preference, prefersDark);
}

/** Dark, light or system. A rejected save reverts both selection and document. */
export function ThemeSwitch({ preference }: { preference: ThemePreference }) {
  const [optimistic, setOptimistic] = useOptimistic<ThemePreference, ThemePreference>(
    preference,
    (_, next) => next,
  );

  function change(next: ThemePreference) {
    if (next === optimistic) return;
    const previous = optimistic;
    startTransition(async () => {
      setOptimistic(next);
      applyThemeToDocument(next);
      try {
        await setTheme(next);
      } catch {
        applyThemeToDocument(previous);
      }
    });
  }

  return (
    <section className="settings-section">
      <h2 className="section-title">{PROFILE_COPY.themeSection}</h2>
      <SegmentedControl
        options={OPTIONS}
        value={optimistic}
        onChange={change}
        ariaLabel={PROFILE_COPY.themeSection}
      />
    </section>
  );
}
