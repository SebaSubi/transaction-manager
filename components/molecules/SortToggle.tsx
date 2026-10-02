import Link from "next/link";

import { LEDGER_COPY } from "@/lib/copy/es";
import type { SortMode } from "@/lib/domain/types";
import { ledgerHref, withSort, type LedgerQuery } from "@/lib/view/ledgerQuery";

const SORT_ORDER: readonly SortMode[] = ["date", "amountDesc", "amountAsc"];

const SORT_LABELS: Record<SortMode, string> = {
  date: LEDGER_COPY.sortDate,
  amountDesc: LEDGER_COPY.sortAmountDesc,
  amountAsc: LEDGER_COPY.sortAmountAsc,
};

/** date -> amount desc -> amount asc -> date. */
export function nextSortMode(sort: SortMode): SortMode {
  return SORT_ORDER[(SORT_ORDER.indexOf(sort) + 1) % SORT_ORDER.length];
}

/** A link that cycles the sort mode; the current mode is its label. */
export function SortToggle({ query }: { query: LedgerQuery }) {
  return (
    <Link
      href={ledgerHref(withSort(query, nextSortMode(query.sort)))}
      aria-label={LEDGER_COPY.sortAriaLabel}
      className="sort-toggle"
    >
      {SORT_LABELS[query.sort]}
    </Link>
  );
}
