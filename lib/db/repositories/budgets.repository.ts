import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { budgets } from "@/lib/db/schema";
import type { PlannedBudgetRow } from "@/lib/domain/budget";
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

/**
 * Removes one month/category budget row. Returns `false` when it was already
 * gone (not an error). Never touches `transactions`.
 */
export async function deleteBudget(
  month: MonthKey,
  categoryId: number,
  userId: string = HOUSEHOLD,
): Promise<boolean> {
  const deleted = await db
    .delete(budgets)
    .where(
      and(
        eq(budgets.userId, userId),
        eq(budgets.month, month),
        eq(budgets.categoryId, categoryId),
      ),
    )
    .returning({ categoryId: budgets.categoryId });
  return deleted.length > 0;
}

/**
 * Inserts a domain-planned budget copy as ONE multi-row statement, so it is
 * atomic on `neon-http` without a transaction. Rows that already exist
 * conflict on `budgets_month_category_uq` and are skipped, never overwritten.
 * Returns the number of rows actually inserted; issues no SQL for an empty
 * plan.
 */
export async function copyMissingBudgets(
  rows: readonly PlannedBudgetRow[],
  toMonth: MonthKey,
  updatedAt: Date,
  userId: string = HOUSEHOLD,
): Promise<number> {
  if (rows.length === 0) return 0;

  const inserted = await db
    .insert(budgets)
    .values(rows.map((row) => ({ userId, month: toMonth, ...row, updatedAt })))
    .onConflictDoNothing({
      target: [budgets.userId, budgets.month, budgets.categoryId],
    })
    .returning({ categoryId: budgets.categoryId });
  return inserted.length;
}
