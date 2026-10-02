import { describe, expect, it } from "vitest";

import {
  clampDateFilters,
  filterTransactions,
  nextSortMode,
  sortTransactions,
} from "@/lib/domain/transactions";
import type { DomainTransaction, TransactionFilters } from "@/lib/domain/types";

function tx(overrides: Partial<DomainTransaction> & { id: number }): DomainTransaction {
  return {
    type: "expense",
    amount: 100,
    gross: 100,
    cashbackBps: 0,
    categoryId: 1,
    memberId: 1,
    date: new Date(Date.UTC(2026, 7, 10)),
    ...overrides,
  };
}

const NO_FILTERS: TransactionFilters = {
  type: "all",
  categoryId: "all",
  memberId: "all",
  from: null,
  to: null,
};

const SAMPLE: DomainTransaction[] = [
  tx({ id: 1, type: "expense", categoryId: 4, memberId: 1, date: new Date(Date.UTC(2026, 7, 1)) }),
  tx({ id: 2, type: "income", categoryId: 9, memberId: 2, date: new Date(Date.UTC(2026, 7, 10)) }),
  tx({ id: 3, type: "expense", categoryId: 4, memberId: 2, date: new Date(Date.UTC(2026, 7, 15)) }),
  tx({ id: 4, type: "expense", categoryId: 7, memberId: 1, date: new Date(Date.UTC(2026, 7, 20)) }),
];

describe("filterTransactions", () => {
  it("returns every transaction when no filter is set", () => {
    expect(filterTransactions(SAMPLE, NO_FILTERS)).toHaveLength(SAMPLE.length);
  });

  it("narrows by type", () => {
    const result = filterTransactions(SAMPLE, { ...NO_FILTERS, type: "expense" });
    expect(result.map((t) => t.id)).toEqual([1, 3, 4]);
  });

  it("applies combined filters as AND", () => {
    const result = filterTransactions(SAMPLE, {
      ...NO_FILTERS,
      categoryId: 4,
      memberId: 2,
    });
    expect(result.map((t) => t.id)).toEqual([3]);
  });

  it("bounds inclusion by the date range, inclusive at both ends", () => {
    const result = filterTransactions(SAMPLE, {
      ...NO_FILTERS,
      from: "2026-08-01",
      to: "2026-08-15",
    });
    expect(result.map((t) => t.id)).toEqual([1, 2, 3]);
  });

  it("includes a transaction dated exactly on the `from` bound", () => {
    const result = filterTransactions(SAMPLE, { ...NO_FILTERS, from: "2026-08-20" });
    expect(result.map((t) => t.id)).toEqual([4]);
  });

  it("compares the date part only, ignoring the time of day", () => {
    const lateInTheDay = [tx({ id: 9, date: new Date(Date.UTC(2026, 7, 15, 23, 59)) })];
    const result = filterTransactions(lateInTheDay, { ...NO_FILTERS, to: "2026-08-15" });
    expect(result.map((t) => t.id)).toEqual([9]);
  });

  it("does not mutate the input array", () => {
    const input = [...SAMPLE];
    filterTransactions(input, { ...NO_FILTERS, type: "income" });
    expect(input).toEqual(SAMPLE);
  });
});

describe("nextSortMode", () => {
  it("cycles date -> amountDesc -> amountAsc -> date", () => {
    expect(nextSortMode("date")).toBe("amountDesc");
    expect(nextSortMode("amountDesc")).toBe("amountAsc");
    expect(nextSortMode("amountAsc")).toBe("date");
  });
});

describe("sortTransactions", () => {
  const amounts = [
    tx({ id: 1, amount: 300, date: new Date(Date.UTC(2026, 7, 1)) }),
    tx({ id: 2, amount: 100, date: new Date(Date.UTC(2026, 7, 20)) }),
    tx({ id: 3, amount: 200, date: new Date(Date.UTC(2026, 7, 10)) }),
  ];

  it("orders by date descending in 'date' mode", () => {
    expect(sortTransactions(amounts, "date").map((t) => t.id)).toEqual([2, 3, 1]);
  });

  it("orders by amount from highest to lowest in 'amountDesc' mode", () => {
    expect(sortTransactions(amounts, "amountDesc").map((t) => t.id)).toEqual([1, 3, 2]);
  });

  it("orders by amount from lowest to highest in 'amountAsc' mode", () => {
    expect(sortTransactions(amounts, "amountAsc").map((t) => t.id)).toEqual([2, 3, 1]);
  });

  it("breaks ties on id descending", () => {
    const tied = [
      tx({ id: 5, amount: 100, date: new Date(Date.UTC(2026, 7, 10)) }),
      tx({ id: 8, amount: 100, date: new Date(Date.UTC(2026, 7, 10)) }),
      tx({ id: 2, amount: 100, date: new Date(Date.UTC(2026, 7, 10)) }),
    ];
    expect(sortTransactions(tied, "date").map((t) => t.id)).toEqual([8, 5, 2]);
    expect(sortTransactions(tied, "amountAsc").map((t) => t.id)).toEqual([8, 5, 2]);
  });

  it("does not mutate the input array", () => {
    const input = [...amounts];
    sortTransactions(input, "amountDesc");
    expect(input.map((t) => t.id)).toEqual([1, 2, 3]);
  });
});

describe("clampDateFilters", () => {
  it("clamps values outside the month to the month bounds", () => {
    expect(clampDateFilters("2026-08", "2026-07-20", "2026-09-15")).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("passes in-range values through unchanged", () => {
    expect(clampDateFilters("2026-08", "2026-08-05", "2026-08-10")).toEqual({
      from: "2026-08-05",
      to: "2026-08-10",
    });
  });

  it("keeps unset values unset", () => {
    expect(clampDateFilters("2026-08", null, null)).toEqual({ from: null, to: null });
  });

  it("clamps each side independently", () => {
    expect(clampDateFilters("2026-02", null, "2026-03-05")).toEqual({
      from: null,
      to: "2026-02-28",
    });
    expect(clampDateFilters("2026-02", "2026-01-05", null)).toEqual({
      from: "2026-02-01",
      to: null,
    });
  });

  it("does not reorder an inverted range (the filter then matches nothing)", () => {
    const clamped = clampDateFilters("2026-08", "2026-08-20", "2026-08-10");
    expect(clamped).toEqual({ from: "2026-08-20", to: "2026-08-10" });

    const rows = filterTransactions(
      [tx({ id: 1, date: new Date("2026-08-15T10:00:00.000Z") })],
      {
        type: "all",
        categoryId: "all",
        memberId: "all",
        ...clamped,
      },
    );
    expect(rows).toEqual([]);
  });

  it("feeds filterTransactions unchanged", () => {
    const clamped = clampDateFilters("2026-08", "2026-07-20", "2026-09-15");
    const rows = filterTransactions(
      [
        tx({ id: 1, date: new Date("2026-08-01T00:00:00.000Z") }),
        tx({ id: 2, date: new Date("2026-08-31T23:59:00.000Z") }),
      ],
      { type: "all", categoryId: "all", memberId: "all", ...clamped },
    );
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
  });
});
