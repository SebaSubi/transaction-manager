import { describe, expect, it } from "vitest";

import { spentForCategory, totalBalance } from "@/lib/domain/balance";
import type { DomainTransaction } from "@/lib/domain/types";

function tx(overrides: Partial<DomainTransaction> & { id: number }): DomainTransaction {
  return {
    type: "expense",
    amount: 0,
    gross: 0,
    cashbackBps: 0,
    categoryId: 1,
    memberId: 1,
    date: new Date(Date.UTC(2026, 7, 15)),
    ...overrides,
  };
}

describe("spentForCategory", () => {
  it("sums NET amounts, never gross", () => {
    const transactions = [
      tx({ id: 1, gross: 1000, amount: 930, cashbackBps: 700, categoryId: 4 }),
      tx({ id: 2, gross: 2000, amount: 1860, cashbackBps: 700, categoryId: 4 }),
    ];
    expect(spentForCategory(transactions, 4)).toBe(2790);
  });

  it("ignores other categories and income rows", () => {
    const transactions = [
      tx({ id: 1, amount: 500, gross: 500, categoryId: 4 }),
      tx({ id: 2, amount: 900, gross: 900, categoryId: 9 }),
      tx({ id: 3, type: "income", amount: 7000, gross: 7000, categoryId: 4 }),
    ];
    expect(spentForCategory(transactions, 4)).toBe(500);
  });

  it("returns 0 for a category with no expenses", () => {
    expect(spentForCategory([], 4)).toBe(0);
  });
});

describe("totalBalance", () => {
  it("spans all history, including months other than the one being viewed", () => {
    // The UI's selected month is 2026-08; the January row MUST still count.
    const transactions = [
      tx({
        id: 1,
        type: "income",
        amount: 10000,
        gross: 10000,
        date: new Date(Date.UTC(2026, 0, 10)),
      }),
      tx({
        id: 2,
        type: "income",
        amount: 5000,
        gross: 5000,
        date: new Date(Date.UTC(2026, 7, 10)),
      }),
    ];
    expect(totalBalance(transactions)).toBe(15000);
  });

  it("nets income against expense", () => {
    const transactions = [
      tx({ id: 1, type: "income", amount: 100000, gross: 100000 }),
      tx({ id: 2, type: "expense", amount: 40000, gross: 40000 }),
    ];
    expect(totalBalance(transactions)).toBe(60000);
  });

  it("returns 0 for an empty history", () => {
    expect(totalBalance([])).toBe(0);
  });

  it("can go negative when expenses exceed income", () => {
    expect(
      totalBalance([tx({ id: 1, type: "expense", amount: 100, gross: 100 })]),
    ).toBe(-100);
  });
});
