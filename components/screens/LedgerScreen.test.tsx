// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
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

const { LedgerScreen } = await import("@/components/screens/LedgerScreen");
const { EntrySheetProvider } = await import("@/components/organisms/EntrySheetProvider");

import type { LedgerRowView } from "@/lib/view/ledger";
import type { LedgerQuery } from "@/lib/view/ledgerQuery";

const query: LedgerQuery = {
  month: "2026-08",
  filters: { type: "all", categoryId: "all", memberId: "all", from: null, to: null },
  sort: "date",
};

function makeRow(id: number): LedgerRowView {
  return {
    id,
    type: "expense",
    amountLabel: "-$100",
    grossLabel: null,
    cashbackLabel: null,
    dateLabel: "14 ago · 21:00",
    category: { id, name: `Cat ${id}`, icon: "tag", archived: false, color: "var(--accent-0)" },
    member: { id: 1, name: "Sofi", archived: false },
    edit: { gross: "100", cashback: "0", dateValue: "2026-08-14T21:00" },
  };
}

function setup(props: { rows: LedgerRowView[]; totalInMonth: number; query?: LedgerQuery }) {
  render(
    <EntrySheetProvider categories={[]} members={[]} defaultMemberId={null}>
      <LedgerScreen
        query={props.query ?? query}
        rows={props.rows}
        filterOptions={{ categories: [], members: [] }}
        totalInMonth={props.totalInMonth}
      />
    </EntrySheetProvider>,
  );
}

afterEach(cleanup);

describe("LedgerScreen", () => {
  it("shows the title, the month stepper, the sort toggle, the singular count and the rows", () => {
    setup({ rows: [makeRow(1)], totalInMonth: 1 });

    expect(screen.getByRole("heading", { name: "Movimientos" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Mes anterior" }).getAttribute("href")).toBe(
      "/movimientos?month=2026-07",
    );
    expect(screen.getByRole("link", { name: "Cambiar orden" })).toBeDefined();
    expect(screen.getByText("1 movimiento")).toBeDefined();
    expect(screen.getByText("Cat 1")).toBeDefined();
  });

  it("uses the plural count for several rows", () => {
    setup({ rows: [makeRow(1), makeRow(2)], totalInMonth: 2 });
    expect(screen.getByText("2 movimientos")).toBeDefined();
  });

  it("changing the month clears the date range but keeps the other filters", () => {
    setup({
      rows: [makeRow(1)],
      totalInMonth: 1,
      query: { ...query, filters: { ...query.filters, type: "expense", from: "2026-08-03" } },
    });

    expect(screen.getByRole("link", { name: "Mes siguiente" }).getAttribute("href")).toBe(
      "/movimientos?month=2026-09&type=expense",
    );
  });

  it("shows the empty-month message when the month has no transactions", () => {
    setup({ rows: [], totalInMonth: 0 });
    expect(screen.getByText(/^No hay movimientos en .*2026\.$/)).toBeDefined();
  });

  it("shows the filtered-empty message with a clear-filters link that keeps month and sort", () => {
    setup({
      rows: [],
      totalInMonth: 4,
      query: { ...query, sort: "amountDesc", filters: { ...query.filters, type: "income" } },
    });

    expect(screen.getByText("Ningún movimiento coincide con los filtros.")).toBeDefined();
    expect(screen.getByRole("link", { name: "Limpiar filtros" }).getAttribute("href")).toBe(
      "/movimientos?month=2026-08&sort=amount-desc",
    );
  });
});
