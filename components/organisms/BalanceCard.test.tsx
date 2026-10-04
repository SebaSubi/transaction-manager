// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BalanceCard } from "@/components/organisms/BalanceCard";

afterEach(cleanup);

describe("BalanceCard", () => {
  it("shows the month label and the formatted balance", () => {
    render(<BalanceCard monthName="Octubre" balance={125000} />);

    expect(screen.getByText("Balance de octubre")).toBeDefined();
    expect(screen.getByText("$125.000")).toBeDefined();
  });

  it("marks a negative balance with the expense modifier", () => {
    const { container } = render(<BalanceCard monthName="Octubre" balance={-500} />);

    expect(container.querySelector(".balance-card__amount--negative")).not.toBeNull();
  });

  it("does not mark a positive balance as negative", () => {
    const { container } = render(<BalanceCard monthName="Octubre" balance={0} />);

    expect(container.querySelector(".balance-card__amount--negative")).toBeNull();
  });
});
