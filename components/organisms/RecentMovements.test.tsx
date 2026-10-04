// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/organisms/LedgerList", () => ({
  LedgerList: ({ rows }: { rows: readonly { id: number }[] }) => (
    <ul data-testid="ledger-list">{rows.length}</ul>
  ),
}));

import { RecentMovements } from "@/components/organisms/RecentMovements";
import type { LedgerRowView } from "@/lib/view/ledger";

afterEach(cleanup);

const row = {
  id: 1,
  type: "expense",
  amountLabel: "-$100",
  grossLabel: null,
  cashbackLabel: null,
  dateLabel: "1 oct",
  category: { id: 1, name: "Super", icon: "tag", archived: false, color: "var(--accent-0)" },
  member: { id: 1, name: "Ana", archived: false },
  edit: { gross: "100", cashback: "0", dateValue: "2026-10-01T10:00" },
} satisfies LedgerRowView;

describe("RecentMovements", () => {
  it("renders the title and the ledger list when there are rows", () => {
    render(<RecentMovements rows={[row]} />);

    expect(screen.getByText("Últimos movimientos")).toBeDefined();
    expect(screen.getByTestId("ledger-list").textContent).toBe("1");
  });

  it("renders the empty message when there are no rows", () => {
    render(<RecentMovements rows={[]} />);

    expect(screen.getByText("Todavía no hay movimientos.")).toBeDefined();
    expect(screen.queryByTestId("ledger-list")).toBeNull();
  });
});
