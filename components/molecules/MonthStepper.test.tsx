// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

const { MonthStepper } = await import("@/components/molecules/MonthStepper");

const hrefFor = (month: string) => `/movimientos?month=${month}`;

afterEach(cleanup);

describe("MonthStepper", () => {
  it("links to the previous and next month across a year boundary (December)", () => {
    render(<MonthStepper month="2026-12" hrefFor={hrefFor} />);

    expect(screen.getByRole("link", { name: "Mes anterior" }).getAttribute("href")).toBe(
      "/movimientos?month=2026-11",
    );
    expect(screen.getByRole("link", { name: "Mes siguiente" }).getAttribute("href")).toBe(
      "/movimientos?month=2027-01",
    );
  });

  it("links to the previous month across a year boundary (January)", () => {
    render(<MonthStepper month="2027-01" hrefFor={hrefFor} />);

    expect(screen.getByRole("link", { name: "Mes anterior" }).getAttribute("href")).toBe(
      "/movimientos?month=2026-12",
    );
  });

  it("shows the Spanish month label", () => {
    render(<MonthStepper month="2026-08" hrefFor={hrefFor} />);
    expect(screen.getByText(/agosto/i)).toBeDefined();
  });
});
