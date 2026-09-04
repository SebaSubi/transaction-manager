import type { TransactionType } from "@/lib/domain/types";

/**
 * Applies cashback to expense transactions only, rounding to whole pesos
 * exactly once, on the server write path. Never re-round at render.
 *
 * `net = max(0, round(gross * (1 - cashbackBps / 10_000)))`.
 *
 * Throws `RangeError` when `gross` is not a non-negative integer or
 * `cashbackBps` is outside `0..10000`.
 */
export function computeNetAmount(input: {
  type: TransactionType;
  gross: number;
  cashbackBps: number;
}): number {
  const { type, gross, cashbackBps } = input;

  if (!Number.isInteger(gross) || gross < 0) {
    throw new RangeError(`gross must be a non-negative integer, got ${gross}`);
  }
  if (!Number.isInteger(cashbackBps) || cashbackBps < 0 || cashbackBps > 10000) {
    throw new RangeError(`cashbackBps must be an integer in 0..10000, got ${cashbackBps}`);
  }

  if (type === "income") {
    return gross;
  }

  return Math.max(0, Math.round(gross * (1 - cashbackBps / 10_000)));
}

/**
 * Converts a UI percent input (e.g. "7.5") to the stored integer basis-point
 * rate, rounding to the nearest bp and clamping to `0..10000`.
 */
export function percentToBps(percent: number): number {
  const bps = Math.round(percent * 100);
  return Math.min(10000, Math.max(0, bps));
}

/** Converts a stored integer basis-point rate back to a UI percent. */
export function bpsToPercent(bps: number): number {
  return bps / 100;
}
