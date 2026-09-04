import type { BudgetProgress } from "@/lib/domain/types";

/**
 * Derives budget progress from a month's net spend and its budgeted amount.
 *
 * `barPct` is clamped to 0..100 so the bar can never overflow its track, while
 * `labelPct` stays uncapped so the "150%" label tells the truth. `overBudget`
 * flips exactly at `spent > budgeted` and is what selects the expense colour;
 * `hasBudget` false selects the neutral state (no budget configured).
 */
export function budgetProgress(spent: number, budgeted: number): BudgetProgress {
  if (budgeted <= 0) {
    return {
      spent,
      budgeted,
      remaining: budgeted - spent,
      barPct: 0,
      labelPct: 0,
      overBudget: false,
      hasBudget: false,
    };
  }

  const labelPct = Math.round((spent / budgeted) * 100);

  return {
    spent,
    budgeted,
    remaining: budgeted - spent,
    barPct: Math.min(100, Math.max(0, labelPct)),
    labelPct,
    overBudget: spent > budgeted,
    hasBudget: true,
  };
}
