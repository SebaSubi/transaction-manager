// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/budgets", () => ({
  upsertBudgetAction: vi.fn(),
  removeBudgetAction: vi.fn(),
  copyBudgetsAction: vi.fn(),
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

const { BudgetScreen } = await import("@/components/screens/BudgetScreen");

import type { BudgetRowView } from "@/lib/view/budgets";

const row: BudgetRowView = {
  categoryId: 1,
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

describe("BudgetScreen", () => {
  it("renders the title, the stepper, the copy control for the previous month and the rows", () => {
    render(<BudgetScreen month="2026-08" rows={[row]} categories={[{ id: 1, name: "Super" }, { id: 2, name: "Luz" }]} />);

    expect(screen.getByRole("heading", { name: "Presupuesto" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Mes anterior" }).getAttribute("href")).toBe(
      "/presupuesto?month=2026-07",
    );
    expect(screen.getByRole("button", { name: /^Copiar presupuesto de .*2026$/ })).toBeDefined();
    expect(screen.getByLabelText("Monto de Super")).toBeDefined();
    expect(screen.getByRole("button", { name: "+ Agregar categoría" })).toBeDefined();
  });

  it("shows the empty message and still offers the copy control when the month has no budget", () => {
    render(<BudgetScreen month="2027-01" rows={[]} categories={[{ id: 1, name: "Super" }]} />);

    expect(screen.getByText(/^Sin presupuesto para .*2027\.$/)).toBeDefined();
    expect(screen.getByRole("button", { name: /^Copiar presupuesto de .*2026$/ })).toBeDefined();
  });

  it("hides the add control when every expense category already has a budget", () => {
    render(<BudgetScreen month="2026-08" rows={[row]} categories={[{ id: 1, name: "Super" }]} />);
    expect(screen.queryByRole("button", { name: "+ Agregar categoría" })).toBeNull();
  });
});
