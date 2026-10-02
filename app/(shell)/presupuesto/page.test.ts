import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DomainTransaction } from "@/lib/domain/types";

const repos = vi.hoisted(() => ({
  getBudgetsForMonth: vi.fn(),
  listTransactionsInRange: vi.fn(),
  listActiveCategoriesByKind: vi.fn(),
  resolveCategoryLabels: vi.fn(),
}));

vi.mock("@/lib/db/repositories/budgets.repository", () => ({
  getBudgetsForMonth: repos.getBudgetsForMonth,
}));
vi.mock("@/lib/db/repositories/transactions.repository", () => ({
  listTransactionsInRange: repos.listTransactionsInRange,
}));
vi.mock("@/lib/db/repositories/categories.repository", () => ({
  listActiveCategoriesByKind: repos.listActiveCategoriesByKind,
  resolveCategoryLabels: repos.resolveCategoryLabels,
}));
vi.mock("@/components/screens/BudgetScreen", () => ({ BudgetScreen: () => null }));

const { default: PresupuestoPage } = await import("@/app/(shell)/presupuesto/page");

function expense(id: number, categoryId: number, amount: number): DomainTransaction {
  return {
    id,
    type: "expense",
    amount,
    gross: amount,
    cashbackBps: 0,
    categoryId,
    memberId: 10,
    date: new Date("2026-08-10T12:00:00Z"),
  };
}

async function render(params: Record<string, string | string[] | undefined>) {
  const element = (await PresupuestoPage({
    searchParams: Promise.resolve(params),
  })) as ReactElement<Record<string, unknown>>;
  return element.props as {
    month: string;
    rows: { categoryId: number; archived: boolean; spentLabel: string; progress: { barPct: number } }[];
    categories: { id: number; name: string }[];
  };
}

beforeEach(() => {
  for (const mock of Object.values(repos)) mock.mockReset();
  repos.getBudgetsForMonth.mockResolvedValue([
    { categoryId: 2, amount: 500 },
    { categoryId: 1, amount: 1000 },
  ]);
  repos.listTransactionsInRange.mockResolvedValue([
    expense(1, 1, 300),
    expense(2, 1, 500),
    expense(3, 2, 100),
    expense(4, 9, 7000),
  ]);
  repos.listActiveCategoriesByKind.mockResolvedValue([
    { id: 1, name: "Super", kind: "expense", icon: "shopping-cart", colorIndex: 0 },
  ]);
  repos.resolveCategoryLabels.mockResolvedValue([
    { id: 1, name: "Super", kind: "expense", icon: "shopping-cart", colorIndex: 0, archived: false },
    { id: 2, name: "Vieja", kind: "expense", icon: "tag", colorIndex: 1, archived: true },
  ]);
});

describe("presupuesto page", () => {
  it("reads the budgets of the month from the URL", async () => {
    const props = await render({ month: "2026-08" });

    expect(repos.getBudgetsForMonth).toHaveBeenCalledWith("2026-08");
    expect(props.month).toBe("2026-08");
  });

  it("falls back to the current month on an invalid month param", async () => {
    const props = await render({ month: "nope" });
    expect(props.month).toMatch(/^\d{4}-\d{2}$/);
  });

  it("maps each budget to spent and progress, ordered by category, labeling archived rows", async () => {
    const props = await render({ month: "2026-08" });

    expect(props.rows.map((row) => row.categoryId)).toEqual([1, 2]);
    expect(props.rows[0].spentLabel).toBe("gastado $800");
    expect(props.rows[0].progress.barPct).toBe(80);
    expect(props.rows[1].archived).toBe(true);
    expect(props.rows[1].spentLabel).toBe("gastado $100");
  });

  it("resolves labels for the budgeted category ids only", async () => {
    await render({ month: "2026-08" });
    expect(repos.resolveCategoryLabels).toHaveBeenCalledWith([2, 1]);
  });

  it("offers the active expense categories for new rows", async () => {
    const props = await render({ month: "2026-08" });
    expect(props.categories).toEqual([{ id: 1, name: "Super" }]);
    expect(repos.listActiveCategoriesByKind).toHaveBeenCalledWith("expense");
  });

  it("renders an empty list for a month without budgets", async () => {
    repos.getBudgetsForMonth.mockResolvedValue([]);
    const props = await render({ month: "2026-08" });
    expect(props.rows).toEqual([]);
  });
});
