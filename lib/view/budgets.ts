import type { BudgetRow } from "@/lib/db/repositories/budgets.repository";
import type { CategoryLabel } from "@/lib/db/repositories/categories.repository";
import { budgetProgress } from "@/lib/domain/budget";
import { categoryColor } from "@/lib/domain/categories";
import { formatArs } from "@/lib/domain/format";
import type { BudgetProgress } from "@/lib/domain/types";

export interface BudgetRowView {
  categoryId: number;
  name: string;
  icon: string;
  color: string;
  archived: boolean;
  amount: number;
  amountLabel: string;
  /** 'gastado $800' */
  spentLabel: string;
  progress: BudgetProgress;
}

/**
 * Maps a budget row, its category label and the month's net spend to a
 * render-ready view. The color is derived here, as in `toLedgerRowView`.
 */
export function toBudgetRowView(
  row: BudgetRow,
  category: CategoryLabel,
  spent: number,
): BudgetRowView {
  return {
    categoryId: row.categoryId,
    name: category.name,
    icon: category.icon,
    color: categoryColor(category.colorIndex),
    archived: category.archived,
    amount: row.amount,
    amountLabel: formatArs(row.amount),
    spentLabel: `gastado ${formatArs(spent)}`,
    progress: budgetProgress(spent, row.amount),
  };
}
