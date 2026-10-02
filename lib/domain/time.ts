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

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Renders a wall-clock Date as the `datetime-local` input value
 * ('YYYY-MM-DDTHH:mm'). Reads UTC components, which ARE the Buenos Aires wall
 * clock under the `TZ=UTC` invariant, so nothing is shifted.
 */
export function toDateTimeLocalValue(wallClock: Date): string {
  const year = String(wallClock.getUTCFullYear()).padStart(4, "0");
  return (
    `${year}-${pad2(wallClock.getUTCMonth() + 1)}-${pad2(wallClock.getUTCDate())}` +
    `T${pad2(wallClock.getUTCHours())}:${pad2(wallClock.getUTCMinutes())}`
  );
}

const DATE_TIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Parses a `datetime-local` value into a wall-clock Date, or `null` when the
 * shape or the calendar date is invalid (e.g. '2026-02-30T10:00').
 *
 * Built ONLY from parts via `wallClockFromParts`: `new Date(string)` and
 * `Date.parse` interpret the string in the process zone, which is exactly the
 * latent-bug class this module exists to eliminate. Optional seconds are
 * dropped.
 */
export function parseDateTimeLocal(value: string): Date | null {
  const match = DATE_TIME_LOCAL_PATTERN.exec(value);
  if (match === null) return null;

  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number);
  const date = wallClockFromParts(year, month, day, hour, minute);

  const roundTrips =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute;

  return roundTrips ? date : null;
}
