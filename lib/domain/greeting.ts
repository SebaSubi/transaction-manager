/**
 * Time-based Spanish greeting, read from the Buenos Aires wall clock.
 *
 * Boundaries: hour < 12 -> 'Buenos días', hour < 19 -> 'Buenas tardes',
 * otherwise 'Buenas noches'. Reads the UTC components because under the
 * `TZ=UTC` invariant they ARE the Buenos Aires wall clock.
 */
export function greeting(
  wallClock: Date,
): "Buenos días" | "Buenas tardes" | "Buenas noches" {
  const hour = wallClock.getUTCHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}
