// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LedgerRow } from "@/components/molecules/LedgerRow";
import type { LedgerRowView } from "@/lib/view/ledger";

const base: LedgerRowView = {
  id: 1,
  type: "expense",
  amountLabel: "-$31.000",
  grossLabel: "$33.333",
  cashbackLabel: "7% cashback",
  dateLabel: "14 ago · 21:00",
  category: { id: 1, name: "Super", icon: "shopping-cart", archived: false, color: "var(--accent-0)" },
  member: { id: 2, name: "Sofi", archived: false },
  edit: { gross: "33333", cashback: "7", dateValue: "2026-08-14T21:00" },
};

afterEach(cleanup);

describe("LedgerRow", () => {
  it("renders the formatted labels, gross and the cashback tag for an expense with cashback", () => {
    render(<LedgerRow row={base} onSelect={() => {}} />);

    expect(screen.getByText("-$31.000")).toBeDefined();
    expect(screen.getByText("$33.333 · 7% cashback")).toBeDefined();
    expect(screen.getByText("Super")).toBeDefined();
    expect(screen.getByText(/Sofi/)).toBeDefined();
    expect(screen.getByText(/14 ago · 21:00/)).toBeDefined();
  });

  it("omits the gross line when the view has no cashback (income or no cashback)", () => {
    render(
      <LedgerRow
        row={{ ...base, type: "income", amountLabel: "+$50.000", grossLabel: null, cashbackLabel: null }}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("+$50.000")).toBeDefined();
    expect(screen.queryByText(/cashback/)).toBeNull();
  });

  it("marks an archived category and member with (en archivo)", () => {
    render(
      <LedgerRow
        row={{
          ...base,
          category: { ...base.category, archived: true },
          member: { ...base.member, archived: true },
        }}
        onSelect={() => {}}
      />,
    );

    expect(screen.getAllByText("(en archivo)")).toHaveLength(2);
  });

  it("shows no archived tag for active entries", () => {
    render(<LedgerRow row={base} onSelect={() => {}} />);
    expect(screen.queryByText("(en archivo)")).toBeNull();
  });

  it("dims the row while pending", () => {
    render(<LedgerRow row={base} pending onSelect={() => {}} />);
    expect(screen.getByRole("button").hasAttribute("data-pending")).toBe(true);
  });

  it("is not dimmed when not pending", () => {
    render(<LedgerRow row={base} onSelect={() => {}} />);
    expect(screen.getByRole("button").hasAttribute("data-pending")).toBe(false);
  });

  it("calls onSelect with its row on click", () => {
    const onSelect = vi.fn();
    render(<LedgerRow row={base} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button"));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(base);
  });
});
