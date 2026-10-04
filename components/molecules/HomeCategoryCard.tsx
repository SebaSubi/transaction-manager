import type { HTMLAttributes, Ref } from "react";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cardSpentLine } from "@/lib/copy/es";
import type { HomeCardView } from "@/lib/view/home";

/**
 * Pure markup for one Inicio budget card. Extra props and the ref land on the
 * root so the sortable wrapper can attach drag attributes and listeners.
 */
export function HomeCategoryCard({
  card,
  dragging = false,
  className = "",
  ref,
  ...rest
}: {
  card: HomeCardView;
  dragging?: boolean;
  ref?: Ref<HTMLDivElement>;
} & HTMLAttributes<HTMLDivElement>) {
  const classes = ["home-card", dragging ? "home-card--dragging" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className={classes} {...rest}>
      <div className="home-card__head">
        <span className="home-card__icon" style={{ color: card.color }}>
          <CategoryIcon name={card.icon} color={card.color} />
        </span>
        <span className="home-card__name">{card.name}</span>
        <span className="home-card__pct">{card.progress.labelPct}%</span>
      </div>
      <ProgressBar
        barPct={card.progress.barPct}
        overBudget={card.progress.overBudget}
        hasBudget={card.progress.hasBudget}
        label={card.name}
      />
      <span className="home-card__spent">
        {cardSpentLine(card.spentLabel, card.amountLabel)}
      </span>
    </div>
  );
}
