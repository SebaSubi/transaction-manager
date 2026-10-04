// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ upsert: vi.fn() }));

vi.mock("@/app/actions/budgets", () => ({
  upsertBudgetAction: actions.upsert,
  removeBudgetAction: vi.fn(),
  copyBudgetsAction: vi.fn(),
}));

import { BudgetAddForm } from "@/components/organisms/BudgetAddForm";

const categories = [
  { id: 1, name: "Super" },
  { id: 2, name: "Luz" },
  { id: 3, name: "Gas" },
];

beforeEach(() => actions.upsert.mockReset());
afterEach(cleanup);

describe("BudgetAddForm", () => {
  it("offers only categories not budgeted this month", () => {
    render(<BudgetAddForm month="2026-08" categories={categories} budgetedIds={[1, 3]} />);

    fireEvent.click(screen.getByRole("button", { name: "+ Agregar categoría" }));

    expect(screen.getByRole("option", { name: "Elegir categoría…" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Luz" })).toBeDefined();
    expect(screen.queryByRole("option", { name: "Super" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Gas" })).toBeNull();
  });

  it("groups digits in the amount as the user types and leaves commas alone", () => {
    render(<BudgetAddForm month="2026-08" categories={categories} budgetedIds={[1]} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Agregar categoría" }));
    const amount = screen.getByLabelText("Monto") as HTMLInputElement;

    fireEvent.change(amount, { target: { value: "12000000" } });
    expect(amount.value).toBe("12.000.000");

    fireEvent.change(amount, { target: { value: "1500,50" } });
    expect(amount.value).toBe("1500,50");
  });

  it("is hidden when every category already has a budget", () => {
    const { container } = render(
      <BudgetAddForm month="2026-08" categories={categories} budgetedIds={[1, 2, 3]} />,
    );
    expect(container.textContent).toBe("");
  });

  it("submits month, category and amount, then collapses on success", async () => {
    actions.upsert.mockResolvedValue({ status: "saved", categoryId: 2, amount: 500 });
    render(<BudgetAddForm month="2026-08" categories={categories} budgetedIds={[1]} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Agregar categoría" }));

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "500" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    });

    const form = actions.upsert.mock.calls[0][1] as FormData;
    expect(form.get("month")).toBe("2026-08");
    expect(form.get("categoryId")).toBe("2");
    expect(form.get("amount")).toBe("500");
    expect(screen.queryByLabelText("Monto")).toBeNull();
    expect(screen.getByRole("button", { name: "+ Agregar categoría" })).toBeDefined();
  });

  it("keeps the form open and shows server errors", async () => {
    actions.upsert.mockResolvedValue({
      status: "error",
      fieldErrors: { amount: "El monto debe ser un número entero mayor que cero." },
      formError: null,
    });
    render(<BudgetAddForm month="2026-08" categories={categories} budgetedIds={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Agregar categoría" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    });

    expect(screen.getByRole("alert").textContent).toBe(
      "El monto debe ser un número entero mayor que cero.",
    );
    expect(screen.getByLabelText("Monto")).toBeDefined();
  });

  it("cancel collapses the form without calling the action", () => {
    render(<BudgetAddForm month="2026-08" categories={categories} budgetedIds={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Agregar categoría" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(actions.upsert).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Monto")).toBeNull();
  });
});
