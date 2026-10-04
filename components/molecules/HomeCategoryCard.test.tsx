// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HomeCategoryCard } from "@/components/molecules/HomeCategoryCard";
import { budgetProgress } from "@/lib/domain/budget";
import type { HomeCardView } from "@/lib/view/home";

const card: HomeCardView = {
  id: 1,
  name: "Supermercado",
  icon: "shopping-cart",
  color: "var(--accent-0)",
  amountLabel: "$1.000",
  spentLabel: "$800",
  progress: budgetProgress(800, 1000),
};

afterEach(cleanup);

describe("HomeCategoryCard", () => {
  it("renders the name, percentage, bar and spent line", () => {
    render(<HomeCategoryCard card={card} />);

    expect(screen.getByText("Supermercado")).toBeDefined();
    expect(screen.getByText("80%")).toBeDefined();
    expect(screen.getByText("gastado $800 de $1.000")).toBeDefined();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("80");
  });

  it("keeps the uncapped label and caps the bar when over budget", () => {
    render(<HomeCategoryCard card={{ ...card, progress: budgetProgress(1500, 1000) }} />);

    expect(screen.getByText("150%")).toBeDefined();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  });

  it("adds the dragging modifier and forwards extra attributes", () => {
    const { container } = render(
      <HomeCategoryCard card={card} dragging aria-roledescription="categoría reordenable" />,
    );
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain("home-card--dragging");
    expect(root.getAttribute("aria-roledescription")).toBe("categoría reordenable");
  });
});
