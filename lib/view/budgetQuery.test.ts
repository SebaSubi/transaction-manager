import { describe, expect, it } from "vitest";

import { budgetHref, parseBudgetMonth } from "@/lib/view/budgetQuery";

describe("parseBudgetMonth", () => {
  it("reads a valid month", () => {
    expect(parseBudgetMonth({ month: "2026-05" }, "2026-08")).toBe("2026-05");
  });

  it.each([
    ["missing", {}],
    ["invalid", { month: "2026-13" }],
    ["garbage", { month: "latest" }],
    ["empty", { month: "" }],
  ])("falls back to the current month when %s", (_label, raw) => {
    expect(parseBudgetMonth(raw, "2026-08")).toBe("2026-08");
  });

  it("takes the first element of an array value", () => {
    expect(parseBudgetMonth({ month: ["2026-03", "2026-04"] }, "2026-08")).toBe(
      "2026-03",
    );
  });
});

describe("budgetHref", () => {
  it("builds the budget URL for a month", () => {
    expect(budgetHref("2026-08")).toBe("/presupuesto?month=2026-08");
  });

  it("round-trips through parseBudgetMonth", () => {
    const search = Object.fromEntries(
      new URL(budgetHref("2027-01"), "https://x.test").searchParams,
    );

    expect(parseBudgetMonth(search, "2026-08")).toBe("2027-01");
  });
});
