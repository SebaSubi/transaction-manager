// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/app/actions/cardOrder", () => ({ reorderCardsAction: vi.fn() }));
vi.mock("@/app/actions/transactions", () => ({
  createTransactionAction: vi.fn(),
  updateTransactionAction: vi.fn(),
  deleteTransactionAction: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { HomeScreen } = await import("@/components/screens/HomeScreen");
const { EntrySheetProvider } = await import("@/components/organisms/EntrySheetProvider");

import type { HomeCardView } from "@/lib/view/home";
import type { LedgerRowView } from "@/lib/view/ledger";

const card: HomeCardView = {
  id: 1,
  name: "Super",
  icon: "shopping-cart",
  color: "var(--accent-0)",
  amountLabel: "$1.000",
  spentLabel: "$800",
  progress: {
    hasBudget: true,
    spent: 800,
    budgeted: 1000,
    remaining: 200,
    barPct: 80,
    labelPct: 80,
    overBudget: false,
  },
};

const row: LedgerRowView = {
  id: 9,
  type: "expense",
  amountLabel: "-$100",
  grossLabel: null,
  cashbackLabel: null,
  dateLabel: "14 oct · 21:00",
  category: { id: 1, name: "Super", icon: "tag", archived: false, color: "var(--accent-0)" },
  member: { id: 1, name: "Sofi", archived: false },
  edit: { gross: "100", cashback: "0", dateValue: "2026-10-14T21:00" },
};

function setup(props: { cards: HomeCardView[]; recent: LedgerRowView[]; balance?: number }) {
  render(
    <EntrySheetProvider members={[]} categories={[]} defaultMemberId={null}>
      <HomeScreen
        monthName="Octubre"
        balance={props.balance ?? 1500}
        cards={props.cards}
        recent={props.recent}
      />
    </EntrySheetProvider>,
  );
}

afterEach(cleanup);

describe("HomeScreen", () => {
  it("shows the greeting and the balance label without a month stepper", () => {
    setup({ cards: [card], recent: [row] });

    expect(screen.getByRole("heading", { name: "¡Buenas!" })).toBeDefined();
    expect(screen.getByText("Balance de octubre")).toBeDefined();
    expect(screen.queryByRole("link", { name: /mes anterior|mes siguiente/i })).toBeNull();
  });

  it("renders the grid cards and the recent movements", () => {
    setup({ cards: [card], recent: [row] });

    expect(screen.getByText("Presupuesto del mes")).toBeDefined();
    expect(screen.getByText("Super", { selector: ".home-card__name" })).toBeDefined();
    expect(screen.getByText("Últimos movimientos")).toBeDefined();
    expect(screen.queryByText("Todavía no hay movimientos.")).toBeNull();
  });

  it("shows only the empty grid state when there are no cards", () => {
    setup({ cards: [], recent: [row] });

    expect(screen.getByText("No hay categorías con presupuesto este mes.")).toBeDefined();
    expect(screen.getByRole("link", { name: "Ir a Presupuesto" }).getAttribute("href")).toBe(
      "/presupuesto",
    );
    expect(screen.queryByText("Todavía no hay movimientos.")).toBeNull();
  });

  it("shows only the empty recent state when there are no movements", () => {
    setup({ cards: [card], recent: [] });

    expect(screen.getByText("Todavía no hay movimientos.")).toBeDefined();
    expect(screen.queryByText("No hay categorías con presupuesto este mes.")).toBeNull();
  });
});
