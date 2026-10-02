import { monthRange } from "@/lib/domain/month";
import type {
  DomainTransaction,
  MonthKey,
  SortMode,
  TransactionFilters,
} from "@/lib/domain/types";

/**
 * Extracts the wall-clock date part ('YYYY-MM-DD'). Reads the UTC components:
 * under the `TZ=UTC` invariant they ARE the Buenos Aires wall clock.
 */
function datePart(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Filters by type, category, member and an inclusive date range.
 *
 * `'all'` and `null` impose no constraint on their dimension. `from`/`to`
 * compare the wall-clock date part only and are inclusive at both ends.
 * Non-mutating: always returns a new array.
 */
export function filterTransactions(
  transactions: readonly DomainTransaction[],
  filters: TransactionFilters,
): DomainTransaction[] {
  return transactions.filter((transaction) => {
    if (filters.type !== "all" && transaction.type !== filters.type) return false;
    if (filters.categoryId !== "all" && transaction.categoryId !== filters.categoryId) {
      return false;
    }
    if (filters.memberId !== "all" && transaction.memberId !== filters.memberId) {
      return false;
    }

    const day = datePart(transaction.date);
    if (filters.from !== null && day < filters.from) return false;
    if (filters.to !== null && day > filters.to) return false;

    return true;
  });
}

/**
 * Sorts a copy of `transactions` for the given mode.
 *
 * Every mode breaks ties on `id` DESCENDING, so equal dates or equal amounts
 * render in a deterministic order across renders and across server/client.
 */
export function sortTransactions(
  transactions: readonly DomainTransaction[],
  mode: SortMode,
): DomainTransaction[] {
  const primary =
    mode === "amountDesc"
      ? (a: DomainTransaction, b: DomainTransaction) => b.amount - a.amount
      : mode === "amountAsc"
        ? (a: DomainTransaction, b: DomainTransaction) => a.amount - b.amount
        : (a: DomainTransaction, b: DomainTransaction) =>
            b.date.getTime() - a.date.getTime();

  return [...transactions].sort((a, b) => primary(a, b) || b.id - a.id);
}

/** The 3-state cycle, exactly: date -> amountDesc -> amountAsc -> date. */
export function nextSortMode(mode: SortMode): SortMode {
  switch (mode) {
    case "date":
      return "amountDesc";
    case "amountDesc":
      return "amountAsc";
    case "amountAsc":
      return "date";
  }
}

/**
 * Clamps the optional date-from / date-to filters ('YYYY-MM-DD') to the
 * selected month's first and last day. An unset value stays unset. Each side
 * is clamped independently and an inverted range is NOT reordered: the result
 * feeds `filterTransactions` unchanged and simply matches nothing.
 */
export function clampDateFilters(
  month: MonthKey,
  from: string | null,
  to: string | null,
): { from: string | null; to: string | null } {
  const { start, endExclusive } = monthRange(month);
  const first = datePart(start);
  const last = datePart(new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000));

  const clamp = (value: string | null): string | null => {
    if (value === null) return null;
    if (value < first) return first;
    if (value > last) return last;
    return value;
  };

  return { from: clamp(from), to: clamp(to) };
}
