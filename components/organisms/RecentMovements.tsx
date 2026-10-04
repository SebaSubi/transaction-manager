import { EmptyState } from "@/components/molecules/EmptyState";
import { LedgerList } from "@/components/organisms/LedgerList";
import { HOME_COPY } from "@/lib/copy/es";
import type { LedgerRowView } from "@/lib/view/ledger";

/** Latest movements. Rows open the existing edit sheet through `LedgerList`. */
export function RecentMovements({ rows }: { rows: readonly LedgerRowView[] }) {
  return (
    <section className="recent-movements">
      <h2 className="section-title">{HOME_COPY.recentTitle}</h2>
      {rows.length === 0 ? (
        <EmptyState message={HOME_COPY.recentEmpty} />
      ) : (
        <LedgerList rows={rows} />
      )}
    </section>
  );
}
