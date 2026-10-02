import { describe, expect, it } from "vitest";

import type { CategoryLabel } from "@/lib/db/repositories/categories.repository";
import { budgetProgress } from "@/lib/domain/budget";
import { categoryColor } from "@/lib/domain/categories";
import { toBudgetRowView } from "@/lib/view/budgets";

const CATEGORY: CategoryLabel = {
  id: 3,
  name: "Supermercado",
  kind: "expense",
  icon: "shopping-cart",
  colorIndex: 2,
  archived: false,
};

describe("toBudgetRowView", () => {
  it("renders labels, progress and the derived color", () => {
    const view = toBudgetRowView({ categoryId: 3, amount: 1000 }, CATEGORY, 800);

    expect(view).toMatchObject({
      categoryId: 3,
      name: "Supermercado",
      icon: "shopping-cart",
      archived: false,
      amount: 1000,
      amountLabel: "$1.000",
      spentLabel: "gastado $800",
    });
    expect(view.color).toBe(categoryColor(2));
    expect(view.progress).toEqual(budgetProgress(800, 1000));
    expect(view).not.toHaveProperty("colorIndex");
  });

  it("flags an archived category", () => {
    const view = toBudgetRowView(
      { categoryId: 3, amount: 1000 },
      { ...CATEGORY, archived: true },
      0,
    );

    expect(view.archived).toBe(true);
    expect(view.spentLabel).toBe("gastado $0");
  });

  it("reports overspending through the shared progress calculation", () => {
    const view = toBudgetRowView({ categoryId: 3, amount: 1000 }, CATEGORY, 1270);

    expect(view.progress.overBudget).toBe(true);
    expect(view.progress.labelPct).toBe(127);
    expect(view.progress.barPct).toBe(100);
  });
});
