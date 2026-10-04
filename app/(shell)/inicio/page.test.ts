import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DomainTransaction } from "@/lib/domain/types";

const repos = vi.hoisted(() => ({
  getBudgetsForMonth: vi.fn(),
  listTransactionsInRange: vi.fn(),
  listRecentTransactions: vi.fn(),
  listActiveCategoriesByKind: vi.fn(),
  resolveCategoryLabels: vi.fn(),
  resolveMemberLabels: vi.fn(),
  getCardOrder: vi.fn(),
}));

vi.mock("@/lib/db/repositories/budgets.repository", () => ({
  getBudgetsForMonth: repos.getBudgetsForMonth,
}));
vi.mock("@/lib/db/repositories/transactions.repository", () => ({
  listTransactionsInRange: repos.listTransactionsInRange,
  listRecentTransactions: repos.listRecentTransactions,
}));
vi.mock("@/lib/db/repositories/categories.repository", () => ({
  listActiveCategoriesByKind: repos.listActiveCategoriesByKind,
  resolveCategoryLabels: repos.resolveCategoryLabels,
}));
vi.mock("@/lib/db/repositories/members.repository", () => ({
  resolveMemberLabels: repos.resolveMemberLabels,
}));
vi.mock("@/lib/db/repositories/cardOrder.repository", () => ({
  getCardOrder: repos.getCardOrder,
}));
vi.mock("@/components/screens/HomeScreen", () => ({ HomeScreen: () => null }));

const { default: InicioPage } = await import("@/app/(shell)/inicio/page");

function tx(
  id: number,
  type: "income" | "expense",
  amount: number,
  categoryId: number,
  date: Date,
): DomainTransaction {
  return { id, type, amount, gross: amount, cashbackBps: 0, categoryId, memberId: 10, date };
}

const NOW = new Date("2026-08-15T15:00:00Z");

async function render() {
  const element = (await InicioPage()) as ReactElement<Record<string, unknown>>;
  return element.props as {
    monthName: string;
    balance: number;
    cards: { id: number; name: string; spentLabel: string }[];
    recent: { id: number; category: { name: string }; member: { name: string } }[];
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  for (const mock of Object.values(repos)) mock.mockReset();

  const monthTxs = [
    tx(3, "income", 5000, 9, new Date("2026-08-10T12:00:00Z")),
    tx(2, "expense", 800, 1, new Date("2026-08-09T12:00:00Z")),
    tx(1, "expense", 200, 2, new Date("2026-08-02T12:00:00Z")),
  ];
  repos.listTransactionsInRange.mockResolvedValue(monthTxs);
  repos.getBudgetsForMonth.mockResolvedValue([
    { categoryId: 1, amount: 1000 },
    { categoryId: 2, amount: 500 },
    { categoryId: 5, amount: 300 },
  ]);
  repos.listActiveCategoriesByKind.mockResolvedValue([
    { id: 1, name: "Super", kind: "expense", icon: "shopping-cart", colorIndex: 0 },
    { id: 2, name: "Luz", kind: "expense", icon: "lightbulb", colorIndex: 1 },
  ]);
  repos.getCardOrder.mockResolvedValue([2, 1]);
  repos.listRecentTransactions.mockResolvedValue([monthTxs[0], monthTxs[1]]);
  repos.resolveCategoryLabels.mockResolvedValue([
    { id: 9, name: "Sueldo", kind: "income", icon: "banknote", colorIndex: 0, archived: false },
    { id: 1, name: "Super", kind: "expense", icon: "shopping-cart", colorIndex: 0, archived: false },
  ]);
  repos.resolveMemberLabels.mockResolvedValue([{ id: 10, name: "Sofi", archived: false }]);
});

describe("inicio page", () => {
  it("reads the current Buenos Aires month once and the 5 latest movements", async () => {
    await render();

    expect(repos.listTransactionsInRange).toHaveBeenCalledTimes(1);
    expect(repos.getBudgetsForMonth).toHaveBeenCalledWith("2026-08");
    expect(repos.listActiveCategoriesByKind).toHaveBeenCalledWith("expense");
    expect(repos.listRecentTransactions).toHaveBeenCalledWith(5);
  });

  it("passes the month name and income minus expense for the month", async () => {
    const props = await render();

    expect(props.monthName).toBe("Agosto");
    expect(props.balance).toBe(4000);
  });

  it("builds cards for budgeted active expense categories in the stored order", async () => {
    const props = await render();

    expect(props.cards.map((card) => card.id)).toEqual([2, 1]);
    expect(props.cards[1].spentLabel).toBe("$800");
  });

  it("maps recent movements to ledger rows with resolved labels", async () => {
    const props = await render();

    expect(repos.resolveCategoryLabels).toHaveBeenCalledWith([9, 1]);
    expect(repos.resolveMemberLabels).toHaveBeenCalledWith([10, 10]);
    expect(props.recent.map((row) => row.id)).toEqual([3, 2]);
    expect(props.recent[0].category.name).toBe("Sueldo");
    expect(props.recent[0].member.name).toBe("Sofi");
  });

  it("renders empty cards and recent lists", async () => {
    repos.getBudgetsForMonth.mockResolvedValue([]);
    repos.listRecentTransactions.mockResolvedValue([]);
    repos.listTransactionsInRange.mockResolvedValue([]);
    repos.resolveCategoryLabels.mockResolvedValue([]);
    repos.resolveMemberLabels.mockResolvedValue([]);

    const props = await render();

    expect(props.cards).toEqual([]);
    expect(props.recent).toEqual([]);
    expect(props.balance).toBe(0);
  });
});
