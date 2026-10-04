import Link from "next/link";

import { LEDGER_COPY } from "@/lib/copy/es";
import { nextSortMode } from "@/lib/domain/transactions";
import type { SortMode } from "@/lib/domain/types";
import { ledgerHref, withSort, type LedgerQuery } from "@/lib/view/ledgerQuery";

const SORT_LABELS: Record<SortMode, string> = {
  date: LEDGER_COPY.sortDate,
  amountDesc: LEDGER_COPY.sortAmountDesc,
  amountAsc: LEDGER_COPY.sortAmountAsc,
};

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
