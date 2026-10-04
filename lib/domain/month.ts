import type { MonthKey, MonthRange } from "@/lib/domain/types";

/**
 * One of the two sanctioned Spanish string tables in `lib/domain/` (the other
 * is `VALIDATION_MESSAGES` in `lib/domain/messages.ts`). This one exists
 * because the alternative is duplicating twelve month names across three
 * screens (design §5). `VALIDATION_MESSAGES` exists because the
 * `financial-domain-rules` spec requires the pure validation helpers to return
 * per-field Spanish messages themselves.
 */
const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Narrows an arbitrary string to the 'YYYY-MM' month-key shape. */
export function isMonthKey(value: string): value is MonthKey {
  return MONTH_KEY_PATTERN.test(value);
}

function assertMonthKey(value: string): void {
  if (!isMonthKey(value)) {
    throw new RangeError(`Invalid month key: "${value}" (expected 'YYYY-MM')`);
  }
}

function partsOf(key: MonthKey): { year: number; month: number } {
  assertMonthKey(key);
  return {
    year: Number(key.slice(0, 4)),
    month: Number(key.slice(5, 7)),
  };
}

function keyOf(year: number, month: number): MonthKey {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/**
 * Derives the month key of a wall-clock Date. Reads the UTC components: under
 * the `TZ=UTC` invariant they ARE the Buenos Aires wall clock.
 */
export function monthKeyOf(wallClock: Date): MonthKey {
  if (Number.isNaN(wallClock.getTime())) {
    throw new RangeError("monthKeyOf received an invalid Date");
  }
  return keyOf(wallClock.getUTCFullYear(), wallClock.getUTCMonth() + 1);
}

/** '2026-08' -> 'Agosto 2026'. */
export function monthKeyLabel(key: MonthKey): string {
  const { year, month } = partsOf(key);
  return `${MONTHS_ES[month - 1]} ${year}`;
}

/** '2026-01' -> '2025-12'. */
export function prevMonthKey(key: MonthKey): MonthKey {
  const { year, month } = partsOf(key);
  return month === 1 ? keyOf(year - 1, 12) : keyOf(year, month - 1);
}

/** '2026-12' -> '2027-01'. Symmetric to `prevMonthKey`; no fixed range. */
export function nextMonthKey(key: MonthKey): MonthKey {
  const { year, month } = partsOf(key);
  return month === 12 ? keyOf(year + 1, 1) : keyOf(year, month + 1);
}

/** 1-based month -> three-letter lowercase abbreviation (1 -> 'ene'). */
export function monthAbbrev(month: number): string {
  return MONTHS_ES[month - 1].slice(0, 3).toLowerCase();
}

/**
 * The ONLY producer of month bounds. Returns a half-open wall-clock range
 * `[start, endExclusive)`; the transactions repository consumes it verbatim as
 * `date >= start AND date < endExclusive`. No `LIKE`, no `startsWith`.
 */
export function monthRange(key: MonthKey): MonthRange {
  const { year, month } = partsOf(key);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    endExclusive: new Date(Date.UTC(year, month, 1)),
  };
}
