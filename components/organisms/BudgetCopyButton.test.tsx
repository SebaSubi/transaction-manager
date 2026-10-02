// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ copy: vi.fn() }));

vi.mock("@/app/actions/budgets", () => ({
  upsertBudgetAction: vi.fn(),
  removeBudgetAction: vi.fn(),
  copyBudgetsAction: actions.copy,
}));

import { BudgetCopyButton } from "@/components/organisms/BudgetCopyButton";

beforeEach(() => actions.copy.mockReset());
afterEach(cleanup);

async function press(result: unknown) {
  actions.copy.mockResolvedValue(result);
  render(<BudgetCopyButton month="2026-08" previousMonthLabel="Julio 2026" />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copiar presupuesto de Julio 2026" }));
  });
}

describe("BudgetCopyButton", () => {
  it("is rendered even before anything was copied", () => {
    render(<BudgetCopyButton month="2026-08" previousMonthLabel="Julio 2026" />);
    expect(screen.getByRole("button", { name: "Copiar presupuesto de Julio 2026" })).toBeDefined();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("calls the action with the month and reports the nothing-to-copy message for an empty previous month", async () => {
    await press({ status: "nothing" });

    expect(actions.copy).toHaveBeenCalledExactlyOnceWith("2026-08");
    expect(screen.getByRole("status").textContent).toBe("No hay categorías para copiar.");
  });

  it("reports one copied category in the singular", async () => {
    await press({ status: "copied", count: 1 });
    expect(screen.getByRole("status").textContent).toBe("Se copió 1 categoría.");
  });

  it("reports several copied categories in the plural", async () => {
    await press({ status: "copied", count: 3 });
    expect(screen.getByRole("status").textContent).toBe("Se copiaron 3 categorías.");
  });

  it("shows the server error message", async () => {
    await press({ status: "error", message: "No se pudo copiar el presupuesto." });
    expect(screen.getByRole("alert").textContent).toBe("No se pudo copiar el presupuesto.");
  });
});
