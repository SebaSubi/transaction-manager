import { BudgetScreen } from "@/components/screens/BudgetScreen";
import { getBudgetsForMonth } from "@/lib/db/repositories/budgets.repository";
import {
  listActiveCategoriesByKind,
  resolveCategoryLabels,
} from "@/lib/db/repositories/categories.repository";
import { listTransactionsInRange } from "@/lib/db/repositories/transactions.repository";
import { spentForCategory } from "@/lib/domain/balance";
import { monthKeyOf, monthRange } from "@/lib/domain/month";
import { nowInBuenosAires } from "@/lib/domain/time";
import { toBudgetRowView, type BudgetRowView } from "@/lib/view/budgets";
import { parseBudgetMonth } from "@/lib/view/budgetQuery";
import type { RawSearchParams } from "@/lib/view/ledgerQuery";

/**
 * Presupuesto container. Reads the month's budgets, the month's transactions
 * (for the net spend per category) and the active expense categories, then
 * maps them to view models. Progress is computed by the domain, never by the
 * client.
 */
export default async function PresupuestoPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const month = parseBudgetMonth(await searchParams, monthKeyOf(nowInBuenosAires()));

  const [budgetRows, monthTransactions, activeExpense] = await Promise.all([
    getBudgetsForMonth(month),
    listTransactionsInRange(monthRange(month)),
    listActiveCategoriesByKind("expense"),
  ]);

  // Budget rows of archived categories are still labeled.
  const labels = await resolveCategoryLabels(budgetRows.map((row) => row.categoryId));
  const labelById = new Map(labels.map((label) => [label.id, label]));

  // Foreign keys guarantee the label exists; the guard only narrows the type.
  const rows = budgetRows
    .flatMap((row): BudgetRowView[] => {
      const category = labelById.get(row.categoryId);
      return category !== undefined
        ? [toBudgetRowView(row, category, spentForCategory(monthTransactions, row.categoryId))]
        : [];
    })
    .sort((a, b) => a.categoryId - b.categoryId);

  return (
    <BudgetScreen
      month={month}
      rows={rows}
      categories={activeExpense.map(({ id, name }) => ({ id, name }))}
    />
  );
}
