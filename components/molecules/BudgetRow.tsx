"use client";

import { useRef } from "react";
import { X } from "lucide-react";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ArchivedTag } from "@/components/ui/ArchivedTag";
import { FieldError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { budgetAmountAriaLabel, budgetRemoveAriaLabel } from "@/lib/copy/es";
import type { BudgetRowView } from "@/lib/view/budgets";

/**
 * One budget row. The amount submits on Enter or blur, and only when it
 * changed. It computes nothing: progress and labels arrive in the view model.
 */
export function BudgetRow({
  row,
  error,
  onAmountChange,
  onRemove,
}: {
  row: BudgetRowView;
  error?: string | null;
  onAmountChange: (categoryId: number, amount: string) => void;
  onRemove: (categoryId: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initial = String(row.amount);

  function commit() {
    const value = inputRef.current?.value.trim() ?? initial;
    if (value === initial) return;
    onAmountChange(row.categoryId, value);
  }

  return (
    <li className="budget-row">
      <div className="budget-row__head">
        <span className="budget-row__icon" style={{ color: row.color }}>
          <CategoryIcon name={row.icon} color={row.color} />
        </span>
        <span className="budget-row__name">
          {row.name}
          {row.archived ? <ArchivedTag /> : null}
        </span>
        <form
          className="budget-row__form"
          onSubmit={(event) => {
            event.preventDefault();
            commit();
          }}
        >
          <input
            ref={inputRef}
            key={initial}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            className="budget-row__amount"
            aria-label={budgetAmountAriaLabel(row.name)}
            defaultValue={initial}
            onBlur={commit}
          />
        </form>
        <button
          type="button"
          className="budget-row__remove"
          aria-label={budgetRemoveAriaLabel(row.name)}
          onClick={() => onRemove(row.categoryId)}
        >
          <Icon as={X} size={16} />
        </button>
      </div>
      <ProgressBar
        barPct={row.progress.barPct}
        overBudget={row.progress.overBudget}
        hasBudget={row.progress.hasBudget}
        label={row.name}
      />
      <div className="budget-row__foot">
        <span>{row.spentLabel}</span>
        <span>{row.progress.labelPct}%</span>
      </div>
      <FieldError message={error} />
    </li>
  );
}
