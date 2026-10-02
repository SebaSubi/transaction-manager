import { LedgerScreen } from "@/components/screens/LedgerScreen";
import {
  listActiveCategories,
  resolveCategoryLabels,
} from "@/lib/db/repositories/categories.repository";
import {
  listActiveMembers,
  resolveMemberLabels,
} from "@/lib/db/repositories/members.repository";
import { listTransactionsInRange } from "@/lib/db/repositories/transactions.repository";
import { monthKeyOf, monthRange } from "@/lib/domain/month";
import { nowInBuenosAires } from "@/lib/domain/time";
import { filterTransactions, sortTransactions } from "@/lib/domain/transactions";
import { toLedgerRowView, type LedgerRowView } from "@/lib/view/ledger";
import { buildLedgerFilterOptions } from "@/lib/view/ledgerFilterOptions";
import { parseLedgerQuery, type RawSearchParams } from "@/lib/view/ledgerQuery";

/**
 * Movimientos container. The URL is the source of truth: the query is parsed
 * from `searchParams` (a Promise in this Next.js version), the month is read
 * with a half-open range, and filtering and sorting are the pure domain
 * functions. Only finished view models reach the screen.
 */
export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseLedgerQuery(await searchParams, monthKeyOf(nowInBuenosAires()));

  const monthTransactions = await listTransactionsInRange(monthRange(query.month));
  const visible = sortTransactions(
    filterTransactions(monthTransactions, query.filters),
    query.sort,
  );

  // Labels cover the WHOLE month (archived entries included), not just the
  // visible rows, because they also feed the filter options.
  const [categoryLabels, memberLabels, activeCategories, activeMembers] = await Promise.all([
    resolveCategoryLabels(monthTransactions.map((tx) => tx.categoryId)),
    resolveMemberLabels(monthTransactions.map((tx) => tx.memberId)),
    listActiveCategories(),
    listActiveMembers(),
  ]);

  const categoryById = new Map(categoryLabels.map((label) => [label.id, label]));
  const memberById = new Map(memberLabels.map((label) => [label.id, label]));

  // Foreign keys guarantee both labels exist; the guard only narrows the type.
  const rows = visible.flatMap((tx): LedgerRowView[] => {
    const category = categoryById.get(tx.categoryId);
    const member = memberById.get(tx.memberId);
    return category !== undefined && member !== undefined
      ? [toLedgerRowView(tx, category, member)]
      : [];
  });

  const filterOptions = buildLedgerFilterOptions({
    activeCategories,
    activeMembers,
    monthCategoryLabels: categoryLabels,
    monthMemberLabels: memberLabels,
  });

  return (
    <LedgerScreen
      query={query}
      rows={rows}
      filterOptions={filterOptions}
      totalInMonth={monthTransactions.length}
    />
  );
}
