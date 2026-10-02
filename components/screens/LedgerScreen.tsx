import { EmptyState } from "@/components/molecules/EmptyState";
import { MonthStepper } from "@/components/molecules/MonthStepper";
import { SortToggle } from "@/components/molecules/SortToggle";
import { LedgerFilters } from "@/components/organisms/LedgerFilters";
import { LedgerList } from "@/components/organisms/LedgerList";
import { LEDGER_COPY, ledgerCount, ledgerEmptyMonth } from "@/lib/copy/es";
import { monthKeyLabel } from "@/lib/domain/month";
import type { LedgerRowView } from "@/lib/view/ledger";
import type { LedgerFilterOptions } from "@/lib/view/ledgerFilterOptions";
import {
  clearFilters,
  ledgerHref,
  withMonth,
  type LedgerQuery,
} from "@/lib/view/ledgerQuery";

/**
 * Movimientos layout. Composition only: every value arrives through props, so
 * there is no data access here (the page is the container).
 */
export function LedgerScreen({
  query,
  rows,
  filterOptions,
  totalInMonth,
}: {
  query: LedgerQuery;
  rows: readonly LedgerRowView[];
  filterOptions: LedgerFilterOptions;
  /** Transactions in the month before filtering; 0 selects the empty-month state. */
  totalInMonth: number;
}) {
  return (
    <section className="screen">
      <header className="screen__header">
        <h1 className="screen__title">{LEDGER_COPY.title}</h1>
        <SortToggle query={query} />
      </header>

      <MonthStepper
        month={query.month}
        hrefFor={(month) => ledgerHref(withMonth(query, month))}
      />

      <LedgerFilters query={query} options={filterOptions} />

      <p className="screen__count">{ledgerCount(rows.length)}</p>

      {totalInMonth === 0 ? (
        <EmptyState message={ledgerEmptyMonth(monthKeyLabel(query.month))} />
      ) : rows.length === 0 ? (
        <EmptyState
          message={LEDGER_COPY.emptyFiltered}
          action={{
            label: LEDGER_COPY.clearFilters,
            href: ledgerHref(clearFilters(query)),
          }}
        />
      ) : (
        <LedgerList rows={rows} />
      )}
    </section>
  );
}
