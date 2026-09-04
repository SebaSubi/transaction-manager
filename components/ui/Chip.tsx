import type { ReactNode } from "react";

export function Chip({
  children,
  active = false,
  color,
}: {
  children: ReactNode;
  active?: boolean;
  /**
   * A CSS custom-property reference from `categoryColor()`, e.g.
   * `var(--accent-3)` — never a hex literal, so the browser resolves the
   * palette from `[data-theme]` and React never reads the effective theme.
   */
  color?: string;
}) {
  return (
    <span
      className={active ? "chip chip--active" : "chip"}
      style={color === undefined ? undefined : { color }}
    >
      {children}
    </span>
  );
}
