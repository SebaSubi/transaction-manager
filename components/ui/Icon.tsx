import type { LucideIcon, LucideProps } from "lucide-react";

/**
 * Single wrapper over the bundled `lucide-react` icons.
 *
 * The prototype fetched every icon from `unpkg.com/lucide-static` — one
 * third-party round trip per icon, ~20 per screen on a mobile connection.
 * Bundling removes all of them (obs #59).
 */
export function Icon({
  as: Component,
  size = 22,
  ...rest
}: LucideProps & { as: LucideIcon }) {
  return <Component size={size} strokeWidth={2} aria-hidden {...rest} />;
}
