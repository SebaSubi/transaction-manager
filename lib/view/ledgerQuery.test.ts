import { describe, expect, it } from "vitest";

import {
  clearFilters,
  ledgerHref,
  parseLedgerQuery,
  withMonth,
  withSort,
  type LedgerQuery,
} from "@/lib/view/ledgerQuery";

const CURRENT = "2026-08";

function query(overrides: Partial<LedgerQuery> = {}): LedgerQuery {
  return {
    month: "2026-08",
    filters: { type: "all", categoryId: "all", memberId: "all", from: null, to: null },
    sort: "date",
    ...overrides,
  };
}

describe("parseLedgerQuery", () => {
  it("falls back to defaults for an empty query", () => {
    expect(parseLedgerQuery({}, CURRENT)).toEqual(query());
  });

  it("reads every parameter", () => {
    const parsed = parseLedgerQuery(
      {
        month: "2026-07",
        type: "expense",
        category: "4",
        member: "2",
        from: "2026-07-05",
        to: "2026-07-20",
        sort: "amount-desc",
      },
      CURRENT,
    );

    expect(parsed).toEqual({
      month: "2026-07",
      filters: {
        type: "expense",
        categoryId: 4,
        memberId: 2,
        from: "2026-07-05",
        to: "2026-07-20",
      },
      sort: "amountDesc",
    });
  });

  it("maps kebab sort values to the domain modes", () => {
    expect(parseLedgerQuery({ sort: "amount-asc" }, CURRENT).sort).toBe("amountAsc");
    expect(parseLedgerQuery({ sort: "amount-desc" }, CURRENT).sort).toBe("amountDesc");
    expect(parseLedgerQuery({ sort: "date" }, CURRENT).sort).toBe("date");
  });

  it("falls back to defaults for garbage values", () => {
    const parsed = parseLedgerQuery(
      {
        month: "2026-13",
        type: "other",
        category: "1; DROP",
        member: "-3",
        from: "yesterday",
        to: "2026-02-30",
        sort: "amountDesc",
      },
      CURRENT,
    );

    expect(parsed).toEqual(query());
  });

  it("takes the first element of an array value", () => {
    const parsed = parseLedgerQuery(
      { type: ["income", "expense"], month: ["2026-06", "2026-05"] },
      CURRENT,
    );

    expect(parsed.filters.type).toBe("income");
    expect(parsed.month).toBe("2026-06");
  });

  it("clamps dates to the selected month", () => {
    const parsed = parseLedgerQuery(
      { month: "2026-02", from: "2026-01-10", to: "2026-03-15" },
      CURRENT,
    );

    expect(parsed.filters.from).toBe("2026-02-01");
    expect(parsed.filters.to).toBe("2026-02-28");
  });
});

describe("ledgerHref", () => {
  it("omits every default except the month", () => {
    expect(ledgerHref(query())).toBe("/movimientos?month=2026-08");
  });

  it("serializes non-default values in a stable order with kebab sort", () => {
    const href = ledgerHref(
      query({
        filters: {
          type: "income",
          categoryId: 4,
          memberId: 2,
          from: "2026-08-05",
          to: "2026-08-20",
        },
        sort: "amountAsc",
      }),
    );

    expect(href).toBe(
      "/movimientos?month=2026-08&type=income&category=4&member=2&from=2026-08-05&to=2026-08-20&sort=amount-asc",
    );
  });

  it("round-trips through parseLedgerQuery", () => {
    const original = query({
      month: "2026-07",
      filters: {
        type: "expense",
        categoryId: 9,
        memberId: "all",
        from: "2026-07-01",
        to: null,
      },
      sort: "amountDesc",
    });
    const search = Object.fromEntries(
      new URL(ledgerHref(original), "https://x.test").searchParams,
    );

    expect(parseLedgerQuery(search, CURRENT)).toEqual(original);
  });
});

describe("query transforms", () => {
  const filtered = query({
    filters: {
      type: "expense",
      categoryId: 4,
      memberId: 2,
      from: "2026-08-05",
      to: "2026-08-20",
    },
    sort: "amountDesc",
  });

  it("withMonth clears from/to and keeps type, category, member and sort", () => {
    const next = withMonth(filtered, "2026-09");

    expect(next.month).toBe("2026-09");
    expect(next.filters).toEqual({
      type: "expense",
      categoryId: 4,
      memberId: 2,
      from: null,
      to: null,
    });
    expect(next.sort).toBe("amountDesc");
  });

  it("withSort changes only the sort", () => {
    expect(withSort(filtered, "amountAsc")).toEqual({ ...filtered, sort: "amountAsc" });
  });

  it("clearFilters keeps the month and the sort", () => {
    expect(clearFilters(filtered)).toEqual(query({ sort: "amountDesc" }));
  });

  it("does not mutate its input", () => {
    withMonth(filtered, "2026-09");
    clearFilters(filtered);

    expect(filtered.filters.type).toBe("expense");
    expect(filtered.filters.from).toBe("2026-08-05");
  });
});
