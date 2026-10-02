import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DomainTransaction } from "@/lib/domain/types";

const repos = vi.hoisted(() => ({
  listTransactionsInRange: vi.fn(),
  resolveCategoryLabels: vi.fn(),
  resolveMemberLabels: vi.fn(),
  listActiveCategories: vi.fn(),
  listActiveMembers: vi.fn(),
}));

vi.mock("@/lib/db/repositories/transactions.repository", () => ({
  listTransactionsInRange: repos.listTransactionsInRange,
}));
vi.mock("@/lib/db/repositories/categories.repository", () => ({
  resolveCategoryLabels: repos.resolveCategoryLabels,
  listActiveCategories: repos.listActiveCategories,
}));
vi.mock("@/lib/db/repositories/members.repository", () => ({
  resolveMemberLabels: repos.resolveMemberLabels,
  listActiveMembers: repos.listActiveMembers,
}));
// The screen is covered by its own test; the page is only the container.
vi.mock("@/components/screens/LedgerScreen", () => ({ LedgerScreen: () => null }));

const { default: MovimientosPage } = await import("@/app/(shell)/movimientos/page");

function tx(id: number, overrides: Partial<DomainTransaction> = {}): DomainTransaction {
  return {
    id,
    type: "expense",
    amount: 1000,
    gross: 1000,
    cashbackBps: 0,
    categoryId: 1,
    memberId: 10,
    date: new Date(`2026-08-${String(10 + id).padStart(2, "0")}T12:00:00Z`),
    ...overrides,
  };
}

async function render(params: Record<string, string | string[] | undefined>) {
  const element = (await MovimientosPage({
    searchParams: Promise.resolve(params),
  })) as ReactElement<Record<string, unknown>>;
  return element.props as {
    query: { month: string; sort: string };
    rows: { id: number; category: { archived: boolean } }[];
    filterOptions: { categories: { id: number; archived: boolean }[]; members: { id: number }[] };
    totalInMonth: number;
  };
}

beforeEach(() => {
  for (const mock of Object.values(repos)) mock.mockReset();
  repos.listTransactionsInRange.mockResolvedValue([
    tx(1),
    tx(2, { categoryId: 2, amount: 5000, gross: 5000 }),
    tx(3, { type: "income", categoryId: 3, memberId: 11, amount: 9000, gross: 9000 }),
  ]);
  repos.resolveCategoryLabels.mockResolvedValue([
    { id: 1, name: "Super", kind: "expense", icon: "shopping-cart", colorIndex: 0, archived: false },
    { id: 2, name: "Vieja", kind: "expense", icon: "tag", colorIndex: 1, archived: true },
    { id: 3, name: "Sueldo", kind: "income", icon: "banknote", colorIndex: 2, archived: false },
  ]);
  repos.resolveMemberLabels.mockResolvedValue([
    { id: 10, name: "Sofi", archived: false },
    { id: 11, name: "Mati", archived: false },
  ]);
  repos.listActiveCategories.mockResolvedValue([
    { id: 1, name: "Super", kind: "expense", icon: "shopping-cart", colorIndex: 0 },
    { id: 3, name: "Sueldo", kind: "income", icon: "banknote", colorIndex: 2 },
  ]);
  repos.listActiveMembers.mockResolvedValue([
    { id: 10, name: "Sofi" },
    { id: 11, name: "Mati" },
  ]);
});

describe("movimientos page", () => {
  it("reads the half-open range of the month from the URL and sorts newest first", async () => {
    const props = await render({ month: "2026-08" });

    const range = repos.listTransactionsInRange.mock.calls[0][0] as { start: Date; endExclusive: Date };
    expect(range.start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(range.endExclusive.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(props.query.month).toBe("2026-08");
    expect(props.rows.map((row) => row.id)).toEqual([3, 2, 1]);
    expect(props.totalInMonth).toBe(3);
  });

  it("applies the type filter and sort from the URL but keeps the month total", async () => {
    const props = await render({ month: "2026-08", type: "expense", sort: "amount-desc" });

    expect(props.rows.map((row) => row.id)).toEqual([2, 1]);
    expect(props.totalInMonth).toBe(3);
  });

  it("falls back to the current month on an invalid month param", async () => {
    const props = await render({ month: "2026-13" });
    expect(props.query.month).toMatch(/^\d{4}-\d{2}$/);
    expect(props.query.month).not.toBe("2026-13");
  });

  it("labels rows of archived categories and offers them as filter options", async () => {
    const props = await render({ month: "2026-08" });

    expect(props.rows.find((row) => row.id === 2)?.category.archived).toBe(true);
    expect(props.filterOptions.categories).toEqual([
      { id: 1, name: "Super", archived: false },
      { id: 3, name: "Sueldo", archived: false },
      { id: 2, name: "Vieja", archived: true },
    ]);
  });

  it("resolves labels for the whole month, not only the filtered rows", async () => {
    await render({ month: "2026-08", type: "income" });

    expect(repos.resolveCategoryLabels).toHaveBeenCalledWith([1, 2, 3]);
    expect(repos.resolveMemberLabels).toHaveBeenCalledWith([10, 10, 11]);
  });

  it("returns an empty list for a month without transactions", async () => {
    repos.listTransactionsInRange.mockResolvedValue([]);
    const props = await render({ month: "2026-08" });

    expect(props.rows).toEqual([]);
    expect(props.totalInMonth).toBe(0);
  });
});
