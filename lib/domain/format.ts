import { monthAbbrev } from "@/lib/domain/month";
import type { TransactionType } from "@/lib/domain/types";

/**
 * Groups digits with '.' manually. `toLocaleString` is deliberately avoided:
 * server and browser ICU data can disagree, which would cause a hydration
 * mismatch on every amount.
 */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 1234567 -> '$1.234.567'; -5000 -> '-$5.000'. Whole pesos, never rounded. */
export function formatArs(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${groupThousands(String(Math.abs(amount)))}`;
}

/** Expense -> '-$31.000', income -> '+$50.000'. */
export function formatSignedArs(type: TransactionType, amount: number): string {
  return `${type === "expense" ? "-" : "+"}${formatArs(Math.abs(amount))}`;
}

/**
 * '14 ago · 21:00' from the wall-clock UTC components (which ARE Buenos Aires
 * local time under the `TZ=UTC` invariant), so nothing is shifted.
 */
export function formatShortDate(wallClock: Date): string {
  const hours = String(wallClock.getUTCHours()).padStart(2, "0");
  const minutes = String(wallClock.getUTCMinutes()).padStart(2, "0");
  return `${wallClock.getUTCDate()} ${monthAbbrev(wallClock.getUTCMonth() + 1)} · ${hours}:${minutes}`;
}

/** Basis points -> percent with a comma decimal and trimmed zeros: 750 -> '7,5'. */
export function formatPercent(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const fraction = String(bps % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return fraction === "" ? String(whole) : `${whole},${fraction}`;
}
