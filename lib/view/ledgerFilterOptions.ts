import type { CategoryLabel } from "@/lib/db/repositories/categories.repository";
import type { MemberLabel } from "@/lib/db/repositories/members.repository";

export interface FilterOption {
  id: number;
  name: string;
  archived: boolean;
}

export interface LedgerFilterOptions {
  categories: FilterOption[];
  members: FilterOption[];
}

function build(
  active: readonly { id: number; name: string }[],
  monthLabels: readonly { id: number; name: string; archived: boolean }[],
): FilterOption[] {
  const seen = new Set<number>();
  const options: FilterOption[] = [];

  for (const entry of active) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    options.push({ id: entry.id, name: entry.name, archived: false });
  }

  const archived: FilterOption[] = [];
  for (const label of monthLabels) {
    if (!label.archived || seen.has(label.id)) continue;
    seen.add(label.id);
    archived.push({ id: label.id, name: label.name, archived: true });
  }
  archived.sort((a, b) => a.name.localeCompare(b.name, "es"));

  return [...options, ...archived];
}

/**
 * Filter choices for Movimientos: the active entries (repository order) plus
 * every ARCHIVED entry the selected month actually references, by name.
 * Archived entries the month does not reference are not offered. A selected
 * URL id that matches no option is still applied by `filterTransactions` but is
 * deliberately NOT added here.
 */
export function buildLedgerFilterOptions(input: {
  activeCategories: readonly { id: number; name: string }[];
  activeMembers: readonly { id: number; name: string }[];
  monthCategoryLabels: readonly CategoryLabel[];
  monthMemberLabels: readonly MemberLabel[];
}): LedgerFilterOptions {
  return {
    categories: build(input.activeCategories, input.monthCategoryLabels),
    members: build(input.activeMembers, input.monthMemberLabels),
  };
}
