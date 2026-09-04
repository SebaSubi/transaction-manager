/**
 * Hand-written environment variable validation.
 *
 * No zod: four assertions do not justify a runtime dependency in the
 * proxy bundle (design §2, Connection Policy).
 */

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Asserts the running process resolves its timezone to UTC.
 *
 * DEFENCE IN DEPTH, not a correctness requirement of the driver round trip.
 * Drizzle's `timestamp without time zone` mapping appends `+0000` when reading
 * and serialises with `toISOString()` when writing, so a `Date` survives the
 * round trip identically whatever `TZ` is set to; the domain layer is likewise
 * timezone-independent, using `Date.UTC` and `getUTC*` throughout.
 *
 * The pin still earns its place: it keeps every OTHER reading of local time —
 * `toString`, `getHours`, `Intl` formatting, a future `new Date(y, m, d)` — from
 * silently meaning something different on a developer's Buenos Aires machine
 * than on Vercel's UTC hosts, which is how a suite passes locally and fails in
 * CI. Set by the pnpm scripts (`TZ=UTC next dev`, `TZ=UTC next build`,
 * `TZ=UTC vitest run`).
 *
 * Note the `db:*` scripts do NOT set `TZ` and do not import this module, so
 * this assertion never runs for them. That is safe only because the round trip
 * above is timezone-independent — do not build a correctness argument on this
 * pin being present everywhere, because it is not.
 */
export function assertProcessTimezoneUtc(): void {
  const resolvedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offsetMinutes = new Date().getTimezoneOffset();

  if (resolvedTimeZone !== "UTC" || offsetMinutes !== 0) {
    throw new Error(
      `Process timezone must be UTC (set TZ=UTC). Resolved timezone: "${resolvedTimeZone}", offset: ${offsetMinutes} minutes.`,
    );
  }
}

assertProcessTimezoneUtc();

function requiredSessionSecret(): string {
  const value = required("SESSION_SECRET");
  if (Buffer.byteLength(value, "utf8") < 32) {
    throw new Error("SESSION_SECRET must be at least 32 bytes.");
  }
  return value;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  APP_PASSWORD: required("APP_PASSWORD"),
  SESSION_SECRET: requiredSessionSecret(),
  TZ: required("TZ"),
};
