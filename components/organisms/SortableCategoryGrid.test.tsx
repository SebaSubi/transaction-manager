// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ reorder: vi.fn() }));

vi.mock("@/app/actions/cardOrder", () => ({
  reorderCardsAction: actions.reorder,
}));

import { SortableCategoryGrid } from "@/components/organisms/SortableCategoryGrid";
import { HOME_COPY } from "@/lib/copy/es";
import { budgetProgress } from "@/lib/domain/budget";
import type { HomeCardView } from "@/lib/view/home";

function makeCard(id: number, name: string): HomeCardView {
  return {
    id,
    name,
    icon: "gift",
    color: "var(--accent-0)",
    amountLabel: "$1.000",
    spentLabel: "$100",
    progress: budgetProgress(100, 1000),
  };
}

const cards = [makeCard(3, "Tres"), makeCard(1, "Uno"), makeCard(2, "Dos")];

beforeEach(() => actions.reorder.mockReset());
afterEach(cleanup);

describe("SortableCategoryGrid", () => {
  it("renders the cards in the given order", () => {
    render(<SortableCategoryGrid cards={cards} />);

    const names = screen.getAllByText(/^(Tres|Uno|Dos)$/).map((el) => el.textContent);
    expect(names).toEqual(["Tres", "Uno", "Dos"]);
  });

  it("exposes the Spanish role description on every card", () => {
    render(<SortableCategoryGrid cards={cards} />);

    const reorderable = document.querySelectorAll(
      `[aria-roledescription="${HOME_COPY.cardRoleDescription}"]`,
    );
    expect(reorderable).toHaveLength(3);
  });

  it("puts the Spanish drag instructions in the DOM", () => {
    render(<SortableCategoryGrid cards={cards} />);

    expect(screen.getByText(HOME_COPY.dragInstructions)).toBeDefined();
  });

  it("server markup carries the stable aria-describedby id", () => {
    const html = renderToString(<SortableCategoryGrid cards={cards} />);

    expect(html).toContain('aria-describedby="home-card-grid"');
  });

  it("calls no action and shows no alert before any drag", async () => {
    await act(async () => {
      render(<SortableCategoryGrid cards={cards} />);
    });

    expect(actions.reorder).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
