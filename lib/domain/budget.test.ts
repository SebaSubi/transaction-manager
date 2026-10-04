import { describe, expect, it } from "vitest";

import { budgetProgress, planBudgetCopy } from "@/lib/domain/budget";

describe("budgetProgress", () => {
  it("caps the bar percentage at 100 when overspent", () => {
    expect(budgetProgress(1500, 1000).barPct).toBe(100);
  });

  it("leaves the label percentage uncapped when overspent", () => {
    expect(budgetProgress(1500, 1000).labelPct).toBe(150);
  });

  it("flags over-budget so the bar switches to the expense colour", () => {
    expect(budgetProgress(1500, 1000).overBudget).toBe(true);
  });

  it("stays within budget (income colour) when spent does not exceed budgeted", () => {
    expect(budgetProgress(800, 1000).overBudget).toBe(false);
  });

  it("flips overBudget exactly at spent > budgeted, not at equality", () => {
    expect(budgetProgress(1000, 1000).overBudget).toBe(false);
    expect(budgetProgress(1001, 1000).overBudget).toBe(true);
  });

  it("reports the neutral state when no budget is configured", () => {
    expect(budgetProgress(500, 0)).toEqual({
      spent: 500,
      budgeted: 0,
      remaining: -500,
      barPct: 0,
      labelPct: 0,
      overBudget: false,
      hasBudget: false,
    });
  });

  it("treats a negative budget as no budget", () => {
    expect(budgetProgress(500, -100).hasBudget).toBe(false);
  });

  it("computes remaining, which may be negative", () => {
    expect(budgetProgress(800, 1000).remaining).toBe(200);
    expect(budgetProgress(1500, 1000).remaining).toBe(-500);
  });
});

describe("planBudgetCopy", () => {
  const active = new Set([1, 2, 3]);

  it("plans only categories missing from the current month, keeping the source amount", () => {
    const plan = planBudgetCopy(
      [
        { categoryId: 1, amount: 100 },
        { categoryId: 2, amount: 200 },
      ],
      [{ categoryId: 1 }],
      active,
    );
    expect(plan).toEqual([{ categoryId: 2, amount: 200 }]);
  });

  it("skips archived and non-expense categories via the active-expense id set", () => {
    const plan = planBudgetCopy(
      [
        { categoryId: 1, amount: 100 },
        { categoryId: 9, amount: 900 },
      ],
      [],
      active,
    );
    expect(plan).toEqual([{ categoryId: 1, amount: 100 }]);
  });

  it("is idempotent: re-planning against the copied month yields nothing", () => {
    const previous = [
      { categoryId: 1, amount: 100 },
      { categoryId: 2, amount: 200 },
    ];
    const first = planBudgetCopy(previous, [], active);
    expect(planBudgetCopy(previous, first, active)).toEqual([]);
  });

  it("returns an empty plan for an empty source month", () => {
    expect(planBudgetCopy([], [{ categoryId: 1 }], active)).toEqual([]);
  });

  it("does not mutate its inputs", () => {
    const previous = [{ categoryId: 1, amount: 100 }];
    const frozen = Object.freeze([...previous]);
    expect(() => planBudgetCopy(frozen, Object.freeze([]), active)).not.toThrow();
  });
});
