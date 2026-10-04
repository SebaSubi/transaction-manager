// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ current: "/inicio" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

// `next/link` needs the App Router's client context, which only exists inside a
// real Next.js render. The nav's contract is the href it hands to Link, so Link
// is replaced by the anchor it ultimately renders. Everything asserted below —
// labels, order, hrefs, the active marker — is still the nav's own output.
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

const { BottomNav } = await import("@/components/organisms/BottomNav");
const { EntrySheetProvider, useEntrySheet } = await import(
  "@/components/organisms/EntrySheetProvider"
);

/** Exposes the sheet state so the FAB's effect is observable without the sheet. */
function SheetProbe() {
  const { open, mode } = useEntrySheet();
  return <output data-testid="sheet-state">{open ? `open:${mode}` : "closed"}</output>;
}

/** Spec: exactly these four labels, verbatim Spanish product copy, in order. */
const EXPECTED_TABS = [
  { label: "Inicio", href: "/inicio" },
  { label: "Presupuesto", href: "/presupuesto" },
  { label: "Movimientos", href: "/movimientos" },
  { label: "Perfil", href: "/perfil" },
] as const;

function renderAt(path: string) {
  pathname.current = path;
  return render(
    <EntrySheetProvider categories={[]} members={[]} defaultMemberId={null}>
      <BottomNav />
      <SheetProbe />
    </EntrySheetProvider>,
  );
}

afterEach(() => {
  cleanup();
  pathname.current = "/inicio";
});

describe("BottomNav", () => {
  it("renders exactly the four Spanish tab labels, verbatim", () => {
    renderAt("/inicio");
    const nav = screen.getByRole("navigation");

    for (const { label } of EXPECTED_TABS) {
      expect(within(nav).getByText(label)).toBeDefined();
    }

    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(EXPECTED_TABS.length);
  });

  it("renders the four tabs in the specified order", () => {
    renderAt("/inicio");
    const labels = within(screen.getByRole("navigation"))
      .getAllByRole("link")
      .map((link) => link.textContent);

    expect(labels).toEqual(EXPECTED_TABS.map((tab) => tab.label));
  });

  it("points each tab at its own route", () => {
    renderAt("/inicio");
    const hrefs = within(screen.getByRole("navigation"))
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(hrefs).toEqual(EXPECTED_TABS.map((tab) => tab.href));
  });

  it("renders a centre FAB between the second and third tab", () => {
    renderAt("/inicio");
    const nav = screen.getByRole("navigation");
    const fab = within(nav).getByRole("button", { name: "Agregar movimiento" });

    // The centre slot: two tabs before it, two after.
    const slots = Array.from(nav.children);
    expect(slots).toHaveLength(EXPECTED_TABS.length + 1);
    expect(slots.indexOf(fab)).toBe(2);
    expect(slots[1].textContent).toBe("Presupuesto");
    expect(slots[3].textContent).toBe("Movimientos");
  });

  it("opens the create sheet from the FAB through openCreate()", () => {
    renderAt("/inicio");
    expect(screen.getByTestId("sheet-state").textContent).toBe("closed");

    fireEvent.click(screen.getByRole("button", { name: "Agregar movimiento" }));

    expect(screen.getByTestId("sheet-state").textContent).toBe("open:create");
  });

  it.each(EXPECTED_TABS.map((tab) => [tab.href, tab.label] as const))(
    "marks %s as the active tab when it is the current route",
    (href, label) => {
      renderAt(href);
      const active = screen.getByRole("link", { name: label });

      expect(active.getAttribute("aria-current")).toBe("page");
      expect(active.className).toContain("bottom-nav__tab--active");

      for (const other of EXPECTED_TABS.filter((tab) => tab.href !== href)) {
        const link = screen.getByRole("link", { name: other.label });
        expect(link.getAttribute("aria-current")).toBeNull();
        expect(link.className).not.toContain("bottom-nav__tab--active");
      }
    },
  );

  it("keeps the tab active on a nested route below it", () => {
    renderAt("/movimientos/2026-08");
    expect(
      screen.getByRole("link", { name: "Movimientos" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("marks no tab active on a route outside the shell", () => {
    renderAt("/login");
    for (const { label } of EXPECTED_TABS) {
      expect(
        screen.getByRole("link", { name: label }).getAttribute("aria-current"),
      ).toBeNull();
    }
  });
});
