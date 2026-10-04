"use server";

import { revalidatePath } from "next/cache";

import type {
  BudgetFormState,
  BudgetMutationResult,
  CopyResult,
} from "@/lib/actions/state";
import { assertSession } from "@/lib/auth/requireSession";
import {
  copyMissingBudgets,
  deleteBudget,
  getBudgetsForMonth,
  upsertBudget,
} from "@/lib/db/repositories/budgets.repository";
import {
  getCategoryById,
  listActiveCategoriesByKind,
} from "@/lib/db/repositories/categories.repository";
import { planBudgetCopy } from "@/lib/domain/budget";
import { VALIDATION_MESSAGES } from "@/lib/domain/messages";
import { isMonthKey, prevMonthKey } from "@/lib/domain/month";
import { nowInBuenosAires } from "@/lib/domain/time";
import type { MonthKey } from "@/lib/domain/types";
import {
  checkBudgetCategory,
  parseBudgetAmount,
  parsePositiveId,
} from "@/lib/domain/validation";

const M = VALIDATION_MESSAGES;

function formString(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
}

/** Re-validates an `unknown` argument that arrived over a direct POST. */
function asMonth(value: unknown): MonthKey | null {
  return typeof value === "string" && isMonthKey(value) ? value : null;
}

function revalidateBudgetTabs(): void {
  revalidatePath("/presupuesto");
  revalidatePath("/inicio");
}

export async function upsertBudgetAction(
  _previous: BudgetFormState,
  form: FormData,
): Promise<BudgetFormState> {
  await assertSession();

  const month = asMonth(formString(form, "month"));
  if (month === null) {
    return { status: "error", fieldErrors: {}, formError: M.budgetSaveFailed };
  }

  const categoryId = parsePositiveId(formString(form, "categoryId"));
  if (categoryId === null) {
    return {
      status: "error",
      fieldErrors: { categoryId: M.categoryRequired },
      formError: null,
    };
  }

  const amount = parseBudgetAmount(formString(form, "amount"));
  if (!amount.ok) {
    return { status: "error", fieldErrors: amount.errors, formError: null };
  }

  try {
    const [category, monthRows] = await Promise.all([
      getCategoryById(categoryId),
      getBudgetsForMonth(month),
    ]);

    const categoryError = checkBudgetCategory(
      category,
      monthRows.some((row) => row.categoryId === categoryId),
    );
    if (categoryError !== null) {
      return {
        status: "error",
        fieldErrors: { categoryId: categoryError },
        formError: null,
      };
    }

    await upsertBudget(
      { month, categoryId, amount: amount.value },
      nowInBuenosAires(),
    );
  } catch {
    return { status: "error", fieldErrors: {}, formError: M.budgetSaveFailed };
  }

  revalidateBudgetTabs();
  return { status: "saved", categoryId, amount: amount.value };
}

/** Removing an already-removed row is a success; transactions are never touched. */
export async function removeBudgetAction(
  month: unknown,
  categoryId: unknown,
): Promise<BudgetMutationResult> {
  await assertSession();

  const validMonth = asMonth(month);
  const validCategoryId = parsePositiveId(categoryId);
  if (validMonth === null || validCategoryId === null) {
    return { status: "error", message: M.budgetRemoveFailed };
  }

  try {
    await deleteBudget(validMonth, validCategoryId);
  } catch {
    return { status: "error", message: M.budgetRemoveFailed };
  }

  revalidateBudgetTabs();
  return { status: "ok" };
}

/**
 * Fill-missing copy of the previous month's budget (Q5): the domain plans, the
 * repository inserts the plan in one statement and skips conflicts.
 */
export async function copyBudgetsAction(month: unknown): Promise<CopyResult> {
  await assertSession();

  const validMonth = asMonth(month);
  if (validMonth === null) {
    return { status: "error", message: M.budgetCopyFailed };
  }

  let count: number;
  try {
    const [previousRows, currentRows, activeExpense] = await Promise.all([
      getBudgetsForMonth(prevMonthKey(validMonth)),
      getBudgetsForMonth(validMonth),
      listActiveCategoriesByKind("expense"),
    ]);

    const plan = planBudgetCopy(
      previousRows,
      currentRows,
      new Set(activeExpense.map((category) => category.id)),
    );
    if (plan.length === 0) return { status: "nothing" };

    count = await copyMissingBudgets(plan, validMonth, nowInBuenosAires());
  } catch {
    return { status: "error", message: M.budgetCopyFailed };
  }

  revalidateBudgetTabs();
  return { status: "copied", count };
}
