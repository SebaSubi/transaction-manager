import type { MonthKey } from "@/lib/domain/types";
import { parseMonthParam, type RawSearchParams } from "@/lib/view/ledgerQuery";

/** Presupuesto URL schema: only `month`, falling back to the current month. */
export function parseBudgetMonth(
  raw: RawSearchParams,
  currentMonth: MonthKey,
): MonthKey {
  return parseMonthParam(raw.month, currentMonth);
}

export function budgetHref(month: MonthKey): string {
  return `/presupuesto?month=${month}`;
}
