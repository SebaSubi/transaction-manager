import { EmptyState } from "@/components/molecules/EmptyState";
import { BalanceCard } from "@/components/organisms/BalanceCard";
import { RecentMovements } from "@/components/organisms/RecentMovements";
import { SortableCategoryGrid } from "@/components/organisms/SortableCategoryGrid";
import { HOME_COPY } from "@/lib/copy/es";
import type { HomeCardView } from "@/lib/view/home";
import type { LedgerRowView } from "@/lib/view/ledger";

/**
 * Inicio layout. Composition only: the page is the container and hands over
 * finished view models. There is no month stepper; the screen is always the
 * current month.
 */
export function HomeScreen({
  monthName,
  balance,
  cards,
  recent,
}: {
  monthName: string;
  balance: number;
  cards: readonly HomeCardView[];
  recent: readonly LedgerRowView[];
}) {
  return (
    <section className="screen">
      <h1 className="screen__title">{HOME_COPY.greeting}</h1>

      <BalanceCard monthName={monthName} balance={balance} />

      <section className="home-section">
        <h2 className="section-title">{HOME_COPY.gridTitle}</h2>
        {cards.length === 0 ? (
          <EmptyState
            message={HOME_COPY.emptyGrid}
            action={{ label: HOME_COPY.emptyGridAction, href: "/presupuesto" }}
          />
        ) : (
          <SortableCategoryGrid cards={cards} />
        )}
      </section>

      <RecentMovements rows={recent} />
    </section>
  );
}
