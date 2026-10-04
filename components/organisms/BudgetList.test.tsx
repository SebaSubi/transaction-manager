// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  upsert: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/app/actions/budgets", () => ({
  upsertBudgetAction: actions.upsert,
  removeBudgetAction: actions.remove,
  copyBudgetsAction: vi.fn(),
}));

import { BudgetList } from "@/components/organisms/BudgetList";
import type { BudgetRowView } from "@/lib/view/budgets";

function makeRow(categoryId: number, name: string): BudgetRowView {
  return {
    categoryId,
    name,
    icon: "tag",
    color: "var(--accent-0)",
    archived: false,
    amount: 1000,
    amountLabel: "$1.000",
    spentLabel: "gastado $800",
    progress: { spent: 800, budgeted: 1000, remaining: 200, barPct: 80, labelPct: 80, overBudget: false, hasBudget: true },
  };
}

const rows = [makeRow(4, "Super"), makeRow(5, "Luz")];

beforeEach(() => {
  actions.upsert.mockReset();
  actions.remove.mockReset();
});

afterEach(cleanup);

describe("BudgetList", () => {
  it("renders one row per budget", () => {
    render(<BudgetList month="2026-08" rows={rows} />);
    expect(screen.getByLabelText("Monto de Super")).toBeDefined();
    expect(screen.getByLabelText("Monto de Luz")).toBeDefined();
  });

  it("removes a row optimistically while the action is pending, then calls it with month and id", async () => {
    let finish!: (value: { status: "ok" }) => void;
    actions.remove.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<BudgetList month="2026-08" rows={rows} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Quitar Super" }));
    });

    expect(actions.remove).toHaveBeenCalledExactlyOnceWith("2026-08", 4);
    expect(screen.queryByLabelText("Monto de Super")).toBeNull();
    expect(screen.getByLabelText("Monto de Luz")).toBeDefined();
    await act(async () => finish({ status: "ok" }));
  });

  it("brings the row back and shows the message when the remove fails", async () => {
    actions.remove.mockResolvedValue({ status: "error", message: "No se pudo quitar la categoría." });
    render(<BudgetList month="2026-08" rows={rows} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Quitar Super" }));
    });

    expect(screen.getByLabelText("Monto de Super")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toBe("No se pudo quitar la categoría.");
  });

  it("submits a changed amount through upsertBudgetAction with month, category and amount", async () => {
    actions.upsert.mockResolvedValue({ status: "saved", categoryId: 4, amount: 1500 });
    render(<BudgetList month="2026-08" rows={rows} />);

    const input = screen.getByLabelText("Monto de Super") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1500" } });
    await act(async () => {
      fireEvent.submit(input.form!);
    });

    expect(actions.upsert).toHaveBeenCalledTimes(1);
    const form = actions.upsert.mock.calls[0][1] as FormData;
    expect(form.get("month")).toBe("2026-08");
    expect(form.get("categoryId")).toBe("4");
    expect(form.get("amount")).toBe("1.500");
  });

  it("shows the server's amount error and does not trust the typed value", async () => {
    actions.upsert.mockResolvedValue({
      status: "error",
      fieldErrors: { amount: "El monto debe ser un número entero mayor que cero." },
      formError: null,
    });
    render(<BudgetList month="2026-08" rows={rows} />);

    const input = screen.getByLabelText("Monto de Super") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1.5" } });
    await act(async () => {
      fireEvent.submit(input.form!);
    });

    expect(screen.getByRole("alert").textContent).toBe(
      "El monto debe ser un número entero mayor que cero.",
    );
  });
});
