// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { LedgerFilters } from "@/components/organisms/LedgerFilters";
import type { LedgerFilterOptions } from "@/lib/view/ledgerFilterOptions";
import type { LedgerQuery } from "@/lib/view/ledgerQuery";

const query: LedgerQuery = {
  month: "2026-08",
  filters: { type: "all", categoryId: "all", memberId: "all", from: null, to: null },
  sort: "date",
};

const options: LedgerFilterOptions = {
  categories: [
    { id: 1, name: "Super", archived: false },
    { id: 9, name: "Vieja", archived: true },
  ],
  members: [
    { id: 10, name: "Sofi", archived: false },
    { id: 11, name: "Ex", archived: true },
  ],
};

function setup(overrides: Partial<LedgerQuery> = {}) {
  render(<LedgerFilters query={{ ...query, ...overrides }} options={options} />);
}

afterEach(() => {
  cleanup();
  router.replace.mockReset();
});

describe("LedgerFilters", () => {
  it("renders the type chips with the current type selected", () => {
    setup({ filters: { ...query.filters, type: "expense" } });

    expect(screen.getByRole("radio", { name: "Gastos" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Todos" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("radio", { name: "Ingresos" })).toBeDefined();
  });

  it("suffixes archived category and member options with (en archivo)", () => {
    setup();

    expect(screen.getByRole("option", { name: "Toda categoría" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Vieja (en archivo)" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Super" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Toda persona" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Ex (en archivo)" })).toBeDefined();
  });

  it("limits the date inputs to the month bounds", () => {
    setup();

    for (const label of ["Desde", "Hasta"]) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      expect(input.min).toBe("2026-08-01");
      expect(input.max).toBe("2026-08-31");
    }
  });

  it("shows the applied date range", () => {
    setup({ filters: { ...query.filters, from: "2026-08-05", to: "2026-08-10" } });

    expect((screen.getByLabelText("Desde") as HTMLInputElement).value).toBe("2026-08-05");
    expect((screen.getByLabelText("Hasta") as HTMLInputElement).value).toBe("2026-08-10");
  });

  it("replaces the URL without scrolling when a type chip is chosen", () => {
    setup();

    fireEvent.click(screen.getByRole("radio", { name: "Gastos" }));

    expect(router.replace).toHaveBeenCalledExactlyOnceWith(
      "/movimientos?month=2026-08&type=expense",
      { scroll: false },
    );
  });

  it("replaces the URL when a category, a member or a date changes", () => {
    setup();

    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText("Quién"), { target: { value: "11" } });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-08-03" } });

    expect(router.replace.mock.calls.map((call) => call[0])).toEqual([
      "/movimientos?month=2026-08&category=9",
      "/movimientos?month=2026-08&member=11",
      "/movimientos?month=2026-08&from=2026-08-03",
    ]);
  });

  it("drops a filter from the URL when set back to all or cleared", () => {
    setup({ filters: { ...query.filters, categoryId: 1, from: "2026-08-03" } });

    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "" } });

    expect(router.replace.mock.calls.map((call) => call[0])).toEqual([
      "/movimientos?month=2026-08&from=2026-08-03",
      "/movimientos?month=2026-08&category=1",
    ]);
  });
});
