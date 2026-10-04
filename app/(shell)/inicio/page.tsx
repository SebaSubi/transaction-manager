import { HomeScreen } from "@/components/screens/HomeScreen";
import { getBudgetsForMonth } from "@/lib/db/repositories/budgets.repository";
import { getCardOrder } from "@/lib/db/repositories/cardOrder.repository";
import {
  listActiveCategoriesByKind,
  resolveCategoryLabels,
} from "@/lib/db/repositories/categories.repository";
import { resolveMemberLabels } from "@/lib/db/repositories/members.repository";
import {
  listRecentTransactions,
  listTransactionsInRange,
} from "@/lib/db/repositories/transactions.repository";
import { monthBalance } from "@/lib/domain/balance";
import { monthKeyOf, monthNameOf, monthRange } from "@/lib/domain/month";
import { nowInBuenosAires } from "@/lib/domain/time";
import { buildHomeCards } from "@/lib/view/home";
import { toLedgerRowView, type LedgerRowView } from "@/lib/view/ledger";

const RECENT_LIMIT = 5;

/**
 * Inicio container. Reads the current month once and derives the balance and
 * the budget cards from it, plus the latest movements across all dates. All
 * arithmetic is in the domain; only finished view models reach the screen.
 */
export default async function InicioPage() {
  const month = monthKeyOf(nowInBuenosAires());

  const [monthTransactions, budgetRows, activeExpense, displayOrder, recentTransactions] =
    await Promise.all([
      listTransactionsInRange(monthRange(month)),
      getBudgetsForMonth(month),
      listActiveCategoriesByKind("expense"),
      getCardOrder(),
      listRecentTransactions(RECENT_LIMIT),
    ]);

  // Recent rows may belong to archived categories or members: labels still resolve.
  const [categoryLabels, memberLabels] = await Promise.all([
    resolveCategoryLabels(recentTransactions.map((tx) => tx.categoryId)),
    resolveMemberLabels(recentTransactions.map((tx) => tx.memberId)),
  ]);
  const categoryById = new Map(categoryLabels.map((label) => [label.id, label]));
  const memberById = new Map(memberLabels.map((label) => [label.id, label]));

  // Foreign keys guarantee both labels exist; the guard only narrows the type.
  const recent = recentTransactions.flatMap((tx): LedgerRowView[] => {
    const category = categoryById.get(tx.categoryId);
    const member = memberById.get(tx.memberId);
    return category !== undefined && member !== undefined
      ? [toLedgerRowView(tx, category, member)]
      : [];
  });

  return (
    <HomeScreen
      monthName={monthNameOf(month)}
      balance={monthBalance(monthTransactions, month)}
      cards={buildHomeCards({ budgetRows, activeExpense, monthTransactions, displayOrder })}
      recent={recent}
    />
  );
}
