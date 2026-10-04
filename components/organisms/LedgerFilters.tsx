"use client";

import { startTransition, useOptimistic } from "react";
import { useRouter } from "next/navigation";

import {
  SegmentedControl,
  type SegmentedOption,
} from "@/components/molecules/SegmentedControl";
import { LEDGER_COPY, SHEET_COPY } from "@/lib/copy/es";
import { monthRange } from "@/lib/domain/month";
import type { TransactionFilters } from "@/lib/domain/types";
import type { FilterOption, LedgerFilterOptions } from "@/lib/view/ledgerFilterOptions";
import { ledgerHref, type LedgerQuery } from "@/lib/view/ledgerQuery";

type TypeFilter = TransactionFilters["type"];

const TYPE_OPTIONS: readonly SegmentedOption<TypeFilter>[] = [
  { value: "all", label: LEDGER_COPY.chipAll },
  { value: "expense", label: LEDGER_COPY.chipExpenses },
  { value: "income", label: LEDGER_COPY.chipIncome },
];

/** 'YYYY-MM-01' and the last day of the month, as `YYYY-MM-DD` bounds. */
function monthBounds(month: string): { min: string; max: string } {
  const { start, endExclusive } = monthRange(month);
  const last = new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000);
  return { min: start.toISOString().slice(0, 10), max: last.toISOString().slice(0, 10) };
}

function optionLabel(option: FilterOption): string {
  return option.archived ? `${option.name} ${SHEET_COPY.archivedMarker}` : option.name;
}

/**
 * Filter controls for Movimientos. The URL is the source of truth: each change
 * calls `router.replace` inside a transition and the server re-parses it. The
 * parsed `LedgerQuery` arrives as a prop (no `useSearchParams`), so there is a
 * single interpretation of the URL. An optimistic copy highlights the choice
 * immediately and `data-pending` lets CSS dim the controls while it loads.
 */
export function LedgerFilters({
  query,
  options,
}: {
  query: LedgerQuery;
  options: LedgerFilterOptions;
}) {
  const router = useRouter();
  const [optimisticQuery, setOptimisticQuery] = useOptimistic(query);
  const [isPending, setIsPending] = useOptimistic(false);
  const bounds = monthBounds(query.month);
  const { filters } = optimisticQuery;

  function navigate(change: Partial<TransactionFilters>) {
    // Always derived from the server-parsed query so the URL stays canonical.
    const next: LedgerQuery = { ...query, filters: { ...query.filters, ...change } };
    startTransition(() => {
      setOptimisticQuery(next);
      setIsPending(true);
      router.replace(ledgerHref(next), { scroll: false });
    });
  }

  return (
    <div className="ledger-filters" data-pending={isPending ? "" : undefined}>
      <SegmentedControl
        options={TYPE_OPTIONS}
        value={filters.type}
        onChange={(type) => navigate({ type })}
        ariaLabel={LEDGER_COPY.title}
      />

      <div className="ledger-filters__row">
        <select
          className="input"
          aria-label={SHEET_COPY.categoryLabel}
          value={String(filters.categoryId)}
          onChange={(event) =>
            navigate({
              categoryId: event.target.value === "all" ? "all" : Number(event.target.value),
            })
          }
        >
          <option value="all">{LEDGER_COPY.allCategories}</option>
          {options.categories.map((option) => (
            <option key={option.id} value={option.id}>
              {optionLabel(option)}
            </option>
          ))}
        </select>

        <select
          className="input"
          aria-label={SHEET_COPY.memberLabel}
          value={String(filters.memberId)}
          onChange={(event) =>
            navigate({
              memberId: event.target.value === "all" ? "all" : Number(event.target.value),
            })
          }
        >
          <option value="all">{LEDGER_COPY.allMembers}</option>
          {options.members.map((option) => (
            <option key={option.id} value={option.id}>
              {optionLabel(option)}
            </option>
          ))}
        </select>
      </div>

      <div className="ledger-filters__row">
        <input
          type="date"
          className="input"
          aria-label={LEDGER_COPY.fromAriaLabel}
          min={bounds.min}
          max={bounds.max}
          value={filters.from ?? ""}
          onChange={(event) => navigate({ from: event.target.value || null })}
        />
        <input
          type="date"
          className="input"
          aria-label={LEDGER_COPY.toAriaLabel}
          min={bounds.min}
          max={bounds.max}
          value={filters.to ?? ""}
          onChange={(event) => navigate({ to: event.target.value || null })}
        />
      </div>
    </div>
  );
}
