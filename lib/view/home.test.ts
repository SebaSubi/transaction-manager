import { describe, expect, it } from "vitest";

import { budgetProgress } from "@/lib/domain/budget";
import { categoryColor } from "@/lib/domain/categories";
import type { DomainTransaction } from "@/lib/domain/types";
import { buildHomeCards, moveId } from "@/lib/view/home";

const cat = (id: number, kind: "expense" | "income" = "expense") => ({
  id,
  name: `Cat ${id}`,
  kind,
  icon: "gift",
  colorIndex: id,
});

const tx = (categoryId: number, amount: number): DomainTransaction => ({
  id: categoryId * 100 + amount,
  type: "expense",
  amount,
  gross: amount,
  cashbackBps: 0,
  categoryId,
  memberId: 1,
  date: new Date(Date.UTC(2026, 9, 5)),
});

const baseInput = {
  budgetRows: [
    { categoryId: 1, amount: 1000 },
    { categoryId: 2, amount: 500 },
    { categoryId: 3, amount: 200 },
  ],
  activeExpense: [cat(1), cat(2), cat(3)],
  monthTransactions: [] as DomainTransaction[],
  displayOrder: [] as number[],
};

describe("buildHomeCards", () => {
  it("builds a card with label, colour and progress", () => {
    const [card] = buildHomeCards({
      ...baseInput,
      budgetRows: [{ categoryId: 1, amount: 1000 }],
      monthTransactions: [tx(1, 800)],
    });
    expect(card).toMatchObject({
      id: 1,
      name: "Cat 1",
      icon: "gift",
      amountLabel: "$1.000",
      spentLabel: "$800",
    });
    expect(card.color).toBe(categoryColor(1));
    expect(card.progress).toEqual(budgetProgress(800, 1000));
  });

  it("excludes income categories and unbudgeted categories", () => {
    const cards = buildHomeCards({
      ...baseInput,
      budgetRows: [
        { categoryId: 1, amount: 1000 },
        { categoryId: 9, amount: 300 },
      ],
      activeExpense: [cat(1), cat(2), cat(9, "income")],
    });
    expect(cards.map((c) => c.id)).toEqual([1]);
  });

  it("excludes an archived category that still has a budget", () => {
    const cards = buildHomeCards({
      ...baseInput,
      activeExpense: [cat(1), cat(3)],
    });
    expect(cards.map((c) => c.id)).toEqual([1, 3]);
  });

  it("applies the stored order over the id-sorted base", () => {
    const cards = buildHomeCards({ ...baseInput, displayOrder: [3, 1] });
    expect(cards.map((c) => c.id)).toEqual([3, 1, 2]);
  });

  it("sorts unknown ids by category id when there is no stored order", () => {
    const cards = buildHomeCards({
      ...baseInput,
      budgetRows: [
        { categoryId: 3, amount: 1 },
        { categoryId: 1, amount: 1 },
      ],
    });
    expect(cards.map((c) => c.id)).toEqual([1, 3]);
  });

  it("caps the bar and keeps the uncapped label when over budget", () => {
    const [card] = buildHomeCards({
      ...baseInput,
      budgetRows: [{ categoryId: 2, amount: 500 }],
      monthTransactions: [tx(2, 750)],
    });
    expect(card.progress.barPct).toBe(100);
    expect(card.progress.labelPct).toBe(150);
    expect(card.progress.overBudget).toBe(true);
  });
});

describe("moveId", () => {
  it("moves an id to the position of the over id", () => {
    expect(moveId([1, 2, 3, 4], 1, 3)).toEqual([2, 3, 1, 4]);
    expect(moveId([1, 2, 3, 4], 4, 2)).toEqual([1, 4, 2, 3]);
  });

  it("returns a copy when an id is unknown or equal", () => {
    const ids = [1, 2, 3];
    expect(moveId(ids, 9, 1)).toEqual([1, 2, 3]);
    expect(moveId(ids, 1, 1)).toEqual([1, 2, 3]);
    expect(moveId(ids, 1, 1)).not.toBe(ids);
  });
});
