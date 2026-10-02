"use client";

import { startTransition, useOptimistic, useState } from "react";

import { removeBudgetAction, upsertBudgetAction } from "@/app/actions/budgets";
import { BudgetRow } from "@/components/molecules/BudgetRow";
import { INITIAL_BUDGET_FORM_STATE } from "@/lib/actions/state";
import { VALIDATION_MESSAGES } from "@/lib/domain/messages";
import type { MonthKey } from "@/lib/domain/types";
import type { BudgetRowView } from "@/lib/view/budgets";

type OptimisticChange =
  | { kind: "remove"; categoryId: number }
  | { kind: "amount"; categoryId: number; amount: number };

function applyChange(
  rows: readonly BudgetRowView[],
  change: OptimisticChange,
): readonly BudgetRowView[] {
  if (change.kind === "remove") {
    return rows.filter((row) => row.categoryId !== change.categoryId);
  }
  return rows.map((row) =>
    row.categoryId === change.categoryId ? { ...row, amount: change.amount } : row,
  );
}

/**
 * Budget rows with optimistic remove and amount edits. The only value applied
 * optimistically is the integer the user typed: progress bars and labels are
 * computed on the server and arrive with the revalidated rows.
 */
export function BudgetList({
  month,
  rows,
}: {
  month: MonthKey;
  rows: readonly BudgetRowView[];
}) {
  const [optimisticRows, applyOptimistic] = useOptimistic(rows, applyChange);
  const [errors, setErrors] = useState<Record<number, string>>({});

  function report(categoryId: number, message: string | null) {
    // Runs after an `await`, so it is wrapped to join the action transition.
    startTransition(() =>
      setErrors((current) => {
        const next = { ...current };
        if (message === null) delete next[categoryId];
        else next[categoryId] = message;
        return next;
      }),
    );
  }

  function handleRemove(categoryId: number) {
    startTransition(async () => {
      applyOptimistic({ kind: "remove", categoryId });
      const result = await removeBudgetAction(month, categoryId);
      report(categoryId, result.status === "error" ? result.message : null);
    });
  }

  function handleAmountChange(categoryId: number, raw: string) {
    startTransition(async () => {
      if (/^[1-9]\d*$/.test(raw)) {
        applyOptimistic({ kind: "amount", categoryId, amount: Number(raw) });
      }

      const form = new FormData();
      form.set("month", month);
      form.set("categoryId", String(categoryId));
      form.set("amount", raw);
      const result = await upsertBudgetAction(INITIAL_BUDGET_FORM_STATE, form);

      report(
        categoryId,
        result.status === "error"
          ? (result.fieldErrors.amount ??
              result.fieldErrors.categoryId ??
              result.formError ??
              VALIDATION_MESSAGES.budgetSaveFailed)
          : null,
      );
    });
  }

  return (
    <ul className="budget-list">
      {optimisticRows.map((row) => (
        <BudgetRow
          key={row.categoryId}
          row={row}
          error={errors[row.categoryId]}
          onAmountChange={handleAmountChange}
          onRemove={handleRemove}
        />
      ))}
    </ul>
  );
}
