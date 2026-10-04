import { EmptyState } from "@/components/molecules/EmptyState";
import { MonthStepper } from "@/components/molecules/MonthStepper";
import { BudgetAddForm } from "@/components/organisms/BudgetAddForm";
import { BudgetCopyButton } from "@/components/organisms/BudgetCopyButton";
import { BudgetList } from "@/components/organisms/BudgetList";
import { BUDGET_COPY, budgetEmpty } from "@/lib/copy/es";
import { monthKeyLabel, prevMonthKey } from "@/lib/domain/month";
import type { MonthKey } from "@/lib/domain/types";
import type { BudgetRowView } from "@/lib/view/budgets";
import { budgetHref } from "@/lib/view/budgetQuery";

/**
 * Presupuesto layout. Composition only: the page is the container and hands
 * over finished view models.
 */
export function BudgetScreen({
  month,
  rows,
  categories,
}: {
  month: MonthKey;
  rows: readonly BudgetRowView[];
  /** Active expense categories, the candidates for a new budget row. */
  categories: readonly { id: number; name: string }[];
}) {
  return (
    <section className="screen">
      <h1 className="screen__title">{BUDGET_COPY.title}</h1>

      <MonthStepper month={month} hrefFor={budgetHref} />

      {/* Always rendered: an empty source month is reported by the action. */}
      <BudgetCopyButton
        month={month}
        previousMonthLabel={monthKeyLabel(prevMonthKey(month))}
      />

      {rows.length === 0 ? (
        <EmptyState message={budgetEmpty(monthKeyLabel(month))} />
      ) : (
        <BudgetList month={month} rows={rows} />
      )}

      <BudgetAddForm
        month={month}
        categories={categories}
        budgetedIds={rows.map((row) => row.categoryId)}
      />
    </section>
  );
}
