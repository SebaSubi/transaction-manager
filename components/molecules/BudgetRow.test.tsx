// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BudgetRow } from "@/components/molecules/BudgetRow";
import type { BudgetRowView } from "@/lib/view/budgets";

const row: BudgetRowView = {
  categoryId: 4,
  name: "Super",
  icon: "shopping-cart",
  color: "var(--accent-0)",
  archived: false,
  amount: 1000,
  amountLabel: "$1.000",
  spentLabel: "gastado $800",
  progress: { spent: 800, budgeted: 1000, remaining: 200, barPct: 80, labelPct: 80, overBudget: false, hasBudget: true },
};

afterEach(cleanup);

function setup(overrides: Partial<BudgetRowView> = {}) {
  const onAmountChange = vi.fn();
  const onRemove = vi.fn();
  render(
    <ul>
      <BudgetRow row={{ ...row, ...overrides }} onAmountChange={onAmountChange} onRemove={onRemove} />
    </ul>,
  );
  return { onAmountChange, onRemove, input: screen.getByLabelText("Monto de Super") as HTMLInputElement };
}

describe("BudgetRow", () => {
  it("renders the spent label, percentage and a progress bar", () => {
    setup();
    expect(screen.getByText("gastado $800")).toBeDefined();
    expect(screen.getByText("80%")).toBeDefined();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("80");
  });

  it("submits a changed amount on Enter", () => {
    const { input, onAmountChange } = setup();

    fireEvent.change(input, { target: { value: "1500" } });
    fireEvent.submit(input.form!);

    expect(onAmountChange).toHaveBeenCalledExactlyOnceWith(4, "1500");
  });

  it("submits a changed amount on blur", () => {
    const { input, onAmountChange } = setup();

    fireEvent.change(input, { target: { value: "2000" } });
    fireEvent.blur(input);

    expect(onAmountChange).toHaveBeenCalledExactlyOnceWith(4, "2000");
  });

  it("does not submit when the amount is unchanged", () => {
    const { input, onAmountChange } = setup();

    fireEvent.submit(input.form!);
    fireEvent.blur(input);

    expect(onAmountChange).not.toHaveBeenCalled();
  });

  it("removes with the Quitar aria label", () => {
    const { onRemove } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Quitar Super" }));

    expect(onRemove).toHaveBeenCalledExactlyOnceWith(4);
  });

  it("marks an archived category (en archivo)", () => {
    setup({ archived: true });
    expect(screen.getByText("(en archivo)")).toBeDefined();
  });
});
