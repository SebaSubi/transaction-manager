import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { budgets } from "@/lib/db/schema";
import type { MonthKey } from "@/lib/domain/types";

const HOUSEHOLD = "household";

export interface BudgetRow {
  categoryId: number;
  amount: number;
}

/**
 * Whole-month budget map: `WHERE user_id = :u AND month = :monthKey`.
 *
 * `month` is a fixed-width char(7) equality match, not a range and not a
 * prefix. Served by the (user_id, month) prefix of `budgets_month_category_uq`.
 */
export async function getBudgetsForMonth(
  monthKey: MonthKey,
  userId: string = HOUSEHOLD,
): Promise<BudgetRow[]> {
  return db
    .select({ categoryId: budgets.categoryId, amount: budgets.amount })
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.month, monthKey)));
}

/**
 * Upserts one month/category budget. Conflict target is
 * `budgets_month_category_uq` (user_id, month, category_id).
 */
export async function upsertBudget(
  input: { month: MonthKey; categoryId: number; amount: number },
  updatedAt: Date,
  userId: string = HOUSEHOLD,
): Promise<BudgetRow> {
  const [row] = await db
    .insert(budgets)
    .values({ userId, ...input, updatedAt })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.month, budgets.categoryId],
      set: { amount: input.amount, updatedAt },
    })
    .returning({ categoryId: budgets.categoryId, amount: budgets.amount });
  return row;
}
