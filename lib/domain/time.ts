/**
 * Buenos Aires is UTC-3 year-round. Argentina abolished daylight saving in
 * 2009, so a fixed offset is correct, not an approximation (design §5).
 */
const BUENOS_AIRES_UTC_OFFSET_MINUTES = -180;

const MINUTE_MS = 60_000;

/**
 * The ONLY permitted source of "now" on the server.
 *
 * Returns a Date whose UTC components are the Buenos Aires wall clock. Under
 * the `TZ=UTC` process invariant this is exactly what `timestamp without time
 * zone` columns store, so a 21:00 Buenos Aires action never records tomorrow's
 * date. Bare `new Date()` treated as local time is banned.
 */
export function nowInBuenosAires(): Date {
  return new Date(Date.now() + BUENOS_AIRES_UTC_OFFSET_MINUTES * MINUTE_MS);
}

/**
 * Builds a wall-clock Date from Buenos Aires calendar parts.
 *
 * `month` is 1-based (1 = January), matching the 'YYYY-MM' month key and the
 * date strings flowing through the UI, not JavaScript's 0-based Date API.
 */
export function wallClockFromParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}
