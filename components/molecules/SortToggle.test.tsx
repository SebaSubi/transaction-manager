// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LedgerQuery } from "@/lib/view/ledgerQuery";

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

const { SortToggle } = await import("@/components/molecules/SortToggle");

const base: LedgerQuery = {
  month: "2026-08",
  filters: { type: "all", categoryId: "all", memberId: "all", from: null, to: null },
  sort: "date",
};

afterEach(cleanup);

describe("SortToggle", () => {
  it("links the last mode back to the date sort, which is omitted from the URL", () => {
    render(<SortToggle query={{ ...base, sort: "amountAsc" }} />);
    const link = screen.getByRole("link", { name: "Cambiar orden" });

    expect(link.textContent).toBe("Monto ↑");
    expect(link.getAttribute("href")).toBe("/movimientos?month=2026-08");
  });

  it("labels the current mode and links to the next one, keeping the filters", () => {
    render(
      <SortToggle query={{ ...base, filters: { ...base.filters, type: "expense" } }} />,
    );
    const link = screen.getByRole("link", { name: "Cambiar orden" });

    expect(link.textContent).toBe("Fecha ↓");
    expect(link.getAttribute("href")).toBe(
      "/movimientos?month=2026-08&type=expense&sort=amount-desc",
    );
  });
});
