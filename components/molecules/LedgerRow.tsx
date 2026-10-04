import { ArchivedTag } from "@/components/ui/ArchivedTag";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import type { LedgerRowView } from "@/lib/view/ledger";

/**
 * One ledger row as a button. Presentational: it renders a view model and
 * reports a selection; it never computes a label.
 */
export function LedgerRow({
  row,
  pending = false,
  onSelect,
}: {
  row: LedgerRowView;
  pending?: boolean;
  onSelect: (row: LedgerRowView) => void;
}) {
  return (
    <button
      type="button"
      className="ledger-row"
      data-pending={pending ? "" : undefined}
      onClick={() => onSelect(row)}
    >
      <span className="ledger-row__icon" style={{ color: row.category.color }}>
        <CategoryIcon name={row.category.icon} color={row.category.color} />
      </span>
      <span className="ledger-row__body">
        <span className="ledger-row__title">
          {row.category.name}
          {row.category.archived ? <ArchivedTag /> : null}
        </span>
        <span className="ledger-row__meta">
          {row.member.name}
          {row.member.archived ? <ArchivedTag /> : null}
          {" · "}
          {row.dateLabel}
        </span>
      </span>
      <span className="ledger-row__amounts">
        <span className={`ledger-row__amount ledger-row__amount--${row.type}`}>
          {row.amountLabel}
        </span>
        {row.grossLabel !== null && row.cashbackLabel !== null ? (
          <span className="ledger-row__gross">
            {row.grossLabel}
            {` · ${row.cashbackLabel}`}
          </span>
        ) : null}
      </span>
    </button>
  );
}
