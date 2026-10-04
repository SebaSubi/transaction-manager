import type { BudgetRow } from "@/lib/db/repositories/budgets.repository";
import type { CategoryRow } from "@/lib/db/repositories/categories.repository";
import { spentForCategory } from "@/lib/domain/balance";
import { budgetProgress } from "@/lib/domain/budget";
import { categoryColor, orderCategories } from "@/lib/domain/categories";
import { formatArs } from "@/lib/domain/format";
import type { BudgetProgress, DomainTransaction } from "@/lib/domain/types";

export interface HomeCardView {
  id: number;
  name: string;
  icon: string;
  color: string;
  /** Formatted budgeted amount, e.g. '$1.000'. */
  amountLabel: string;
  /** Formatted net spend, e.g. '$800'. */
  spentLabel: string;
  progress: BudgetProgress;
}

/**
 * Builds the Inicio grid cards. Only budgeted ACTIVE expense categories get a
 * card (income, unbudgeted and archived ones are excluded). The base order is
 * by category id; the stored display order is then applied on top, with unknown
 * ids kept after the known ones.
 */
export function buildHomeCards(input: {
  budgetRows: readonly BudgetRow[];
  activeExpense: readonly CategoryRow[];
  monthTransactions: readonly DomainTransaction[];
  displayOrder: readonly number[];
}): HomeCardView[] {
  const active = new Map(
    input.activeExpense
      .filter((category) => category.kind === "expense")
      .map((category) => [category.id, category]),
  );

  const cards: HomeCardView[] = [];
  for (const row of input.budgetRows) {
    const category = active.get(row.categoryId);
    if (category === undefined) continue;
    const spent = spentForCategory(input.monthTransactions, category.id);
    cards.push({
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: categoryColor(category.colorIndex),
      amountLabel: formatArs(row.amount),
      spentLabel: formatArs(spent),
      progress: budgetProgress(spent, row.amount),
    });
  }

  cards.sort((a, b) => a.id - b.id);
  return orderCategories(cards, input.displayOrder);
}

/** Moves `activeId` to the position of `overId` (arrayMove semantics). */
export function moveId(
  ids: readonly number[],
  activeId: number,
  overId: number,
): number[] {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  const next = [...ids];
  if (from === -1 || to === -1 || from === to) return next;
  next.splice(from, 1);
  next.splice(to, 0, activeId);
  return next;
}
