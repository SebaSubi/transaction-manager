import { isMonthKey } from "@/lib/domain/month";
import { clampDateFilters } from "@/lib/domain/transactions";
import type {
  MonthKey,
  SortMode,
  TransactionFilters,
} from "@/lib/domain/types";
import { parsePositiveId } from "@/lib/domain/validation";

/**
 * URL <-> state for Movimientos (design Decision 7). Search params are the
 * single source of truth; defaults are omitted so each state has one canonical
 * URL, and invalid values silently fall back to defaults.
 */

export interface LedgerQuery {
  month: MonthKey;
  filters: TransactionFilters;
  sort: SortMode;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

const SORT_FROM_URL: Record<string, SortMode> = {
  date: "date",
  "amount-desc": "amountDesc",
  "amount-asc": "amountAsc",
};

const SORT_TO_URL: Record<SortMode, string | null> = {
  date: null,
  amountDesc: "amount-desc",
  amountAsc: "amount-asc",
};

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** 'YYYY-MM-DD' that is a real calendar day, else null. */
function parseDay(value: string | undefined): string | null {
  if (value === undefined) return null;
  const match = DAY_PATTERN.exec(value);
  if (match === null) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const roundTrips =
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(m) - 1 &&
    date.getUTCDate() === Number(d);
  return roundTrips ? value : null;
}

export function parseMonthParam(
  value: string | string[] | undefined,
  currentMonth: MonthKey,
): MonthKey {
  const month = firstValue(value);
  return month !== undefined && isMonthKey(month) ? month : currentMonth;
}

export function parseLedgerQuery(
  raw: RawSearchParams,
  currentMonth: MonthKey,
): LedgerQuery {
  const month = parseMonthParam(raw.month, currentMonth);

  const rawType = firstValue(raw.type);
  const type = rawType === "expense" || rawType === "income" ? rawType : "all";

  const categoryId = parsePositiveId(firstValue(raw.category)) ?? "all";
  const memberId = parsePositiveId(firstValue(raw.member)) ?? "all";

  const { from, to } = clampDateFilters(
    month,
    parseDay(firstValue(raw.from)),
    parseDay(firstValue(raw.to)),
  );

  const rawSort = firstValue(raw.sort);
  const sort =
    rawSort !== undefined && Object.hasOwn(SORT_FROM_URL, rawSort)
      ? SORT_FROM_URL[rawSort]
      : "date";

  return { month, filters: { type, categoryId, memberId, from, to }, sort };
}

export function ledgerHref(query: LedgerQuery): string {
  const params = new URLSearchParams();
  params.set("month", query.month);
  if (query.filters.type !== "all") params.set("type", query.filters.type);
  if (query.filters.categoryId !== "all") {
    params.set("category", String(query.filters.categoryId));
  }
  if (query.filters.memberId !== "all") {
    params.set("member", String(query.filters.memberId));
  }
  if (query.filters.from !== null) params.set("from", query.filters.from);
  if (query.filters.to !== null) params.set("to", query.filters.to);
  const sort = SORT_TO_URL[query.sort];
  if (sort !== null) params.set("sort", sort);
  return `/movimientos?${params.toString()}`;
}

/** Changing the month clears the date range (Q13); everything else carries over. */
export function withMonth(query: LedgerQuery, month: MonthKey): LedgerQuery {
  return { ...query, month, filters: { ...query.filters, from: null, to: null } };
}

export function withSort(query: LedgerQuery, sort: SortMode): LedgerQuery {
  return { ...query, sort };
}

/** Keeps the month and the sort. */
export function clearFilters(query: LedgerQuery): LedgerQuery {
  return {
    ...query,
    filters: { type: "all", categoryId: "all", memberId: "all", from: null, to: null },
  };
}
