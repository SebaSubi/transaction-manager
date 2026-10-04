"use client";

import { startTransition, useState, useTransition } from "react";

import { copyBudgetsAction } from "@/app/actions/budgets";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { BUDGET_COPY, budgetCopied, budgetCopyButton } from "@/lib/copy/es";
import type { CopyResult } from "@/lib/actions/state";
import type { MonthKey } from "@/lib/domain/types";

function describe(result: CopyResult): { message: string; isError: boolean } {
  switch (result.status) {
    case "copied":
      return { message: budgetCopied(result.count), isError: false };
    case "nothing":
      return { message: BUDGET_COPY.copyNothing, isError: false };
    case "error":
      return { message: result.message, isError: true };
  }
}

/**
 * Copies the previous month's budget into this one (fill-missing). Always
 * rendered: an empty source month is reported by the action's "nothing to
 * copy" result instead of hiding the control.
 */
export function BudgetCopyButton({
  month,
  previousMonthLabel,
}: {
  month: MonthKey;
  previousMonthLabel: string;
}) {
  const [result, setResult] = useState<CopyResult | null>(null);
  const [pending, startCopy] = useTransition();

  function copy() {
    startCopy(async () => {
      const outcome = await copyBudgetsAction(month);
      startTransition(() => setResult(outcome));
    });
  }

  const shown = result === null ? null : describe(result);

  return (
    <div className="budget-copy">
      <Button type="button" variant="secondary" disabled={pending} onClick={copy}>
        {budgetCopyButton(previousMonthLabel)}
      </Button>
      {shown === null ? null : shown.isError ? (
        <FieldError message={shown.message} />
      ) : (
        <p className="budget-copy__result" role="status">
          {shown.message}
        </p>
      )}
    </div>
  );
}
