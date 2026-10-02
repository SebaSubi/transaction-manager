"use client";

import { startTransition, useActionState, useState } from "react";

import { upsertBudgetAction } from "@/app/actions/budgets";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { BUDGET_COPY } from "@/lib/copy/es";
import {
  INITIAL_BUDGET_FORM_STATE,
  type BudgetFormState,
} from "@/lib/actions/state";
import type { MonthKey } from "@/lib/domain/types";

/**
 * "+ Agregar categoría": a picker of the active expense categories that have no
 * budget this month, plus an amount. Hidden when none remain.
 */
export function BudgetAddForm({
  month,
  categories,
  budgetedIds,
}: {
  month: MonthKey;
  categories: readonly { id: number; name: string }[];
  budgetedIds: readonly number[];
}) {
  const [open, setOpen] = useState(false);
  const available = categories.filter((category) => !budgetedIds.includes(category.id));

  if (available.length === 0) return null;

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {BUDGET_COPY.addToggle}
      </Button>
    );
  }

  return (
    <AddFields
      month={month}
      available={available}
      onDone={() => setOpen(false)}
    />
  );
}

function AddFields({
  month,
  available,
  onDone,
}: {
  month: MonthKey;
  available: readonly { id: number; name: string }[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<BudgetFormState, FormData>(
    async (previous, formData) => {
      const result = await upsertBudgetAction(previous, formData);
      if (result.status === "saved") startTransition(onDone);
      return result;
    },
    INITIAL_BUDGET_FORM_STATE,
  );
  const errors = state.status === "error" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="budget-add">
      <input type="hidden" name="month" value={month} />

      <select name="categoryId" className="input" defaultValue="" aria-label={BUDGET_COPY.addPlaceholder}>
        <option value="">{BUDGET_COPY.addPlaceholder}</option>
        {available.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <FieldError message={errors.categoryId} />

      <input
        name="amount"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="input"
        aria-label={BUDGET_COPY.addAmount}
        placeholder={BUDGET_COPY.addAmount}
      />
      <FieldError message={errors.amount} />
      <FieldError message={state.status === "error" ? state.formError : null} />

      <div className="budget-add__actions">
        <Button type="button" variant="ghost" onClick={onDone}>
          {BUDGET_COPY.addCancel}
        </Button>
        <Button type="submit" disabled={pending}>
          {BUDGET_COPY.addSubmit}
        </Button>
      </div>
    </form>
  );
}
