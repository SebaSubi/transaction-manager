// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installMatchMedia, type MatchMediaStub } from "@/test/stubs/matchMedia";

const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));

const repos = vi.hoisted(() => ({
  listActiveCategories: vi.fn(),
  listActiveMembers: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "tm_last_member" && cookieValue.current !== undefined
        ? { name, value: cookieValue.current }
        : undefined,
  }),
}));

vi.mock("@/lib/db/repositories/categories.repository", () => ({
  listActiveCategories: repos.listActiveCategories,
}));

vi.mock("@/lib/db/repositories/members.repository", () => ({
  listActiveMembers: repos.listActiveMembers,
}));

vi.mock("@/app/actions/transactions", () => ({
  createTransactionAction: vi.fn(),
  updateTransactionAction: vi.fn(),
  deleteTransactionAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/inicio",
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

const { default: ShellLayout } = await import("@/app/(shell)/layout");

const GLOBALS_CSS = readFileSync(
  path.resolve(__dirname, "../globals.css"),
  "utf8",
);

let matchMedia: MatchMediaStub;

// The shell mounts SystemThemeWatcher, which calls `window.matchMedia`; jsdom
// ships none. Its own behaviour is covered by SystemThemeWatcher.test.tsx.
beforeEach(() => {
  matchMedia = installMatchMedia(true);
  cookieValue.current = undefined;
  repos.listActiveCategories.mockReset();
  repos.listActiveMembers.mockReset();
  repos.listActiveCategories.mockResolvedValue([
    { id: 1, name: "Super", kind: "expense", icon: "shopping-cart", colorIndex: 0 },
    { id: 3, name: "Sueldo", kind: "income", icon: "banknote", colorIndex: 2 },
  ]);
  repos.listActiveMembers.mockResolvedValue([
    { id: 10, name: "Sofi" },
    { id: 11, name: "Mati" },
  ]);
});

afterEach(() => {
  cleanup();
  matchMedia.restore();
});

async function renderLayout(children: React.ReactNode = <p>contenido</p>) {
  return render(await ShellLayout({ children }));
}

describe("shell layout", () => {
  it("wraps the page content of every tab route", async () => {
    await renderLayout(<p>contenido de la pestaña</p>);

    const content = screen.getByText("contenido de la pestaña");
    expect(content.closest(".shell__content")).not.toBeNull();
    expect(content.closest(".shell")).not.toBeNull();
  });

  it("renders the bottom nav alongside the page content", async () => {
    await renderLayout();

    const nav = screen.getByRole("navigation");
    expect(nav.closest(".shell")).not.toBeNull();
    for (const label of ["Inicio", "Presupuesto", "Movimientos", "Perfil"]) {
      expect(screen.getByRole("link", { name: label })).toBeDefined();
    }
  });

  it("puts the page content before the bottom nav in the shell", async () => {
    const { container } = await renderLayout();
    const shell = container.querySelector(".shell");

    expect(shell).not.toBeNull();
    const children = Array.from(shell!.children);
    const main = children.findIndex((node) => node.tagName === "MAIN");
    const nav = children.findIndex((node) => node.tagName === "NAV");
    expect(main).toBeGreaterThanOrEqual(0);
    expect(nav).toBeGreaterThan(main);
  });

  it("constrains the shell to a 430px maximum width", async () => {
    // The width is one CSS declaration rather than an inline style, so the
    // rendered class and the stylesheet rule are asserted as a pair: either
    // half alone could pass while the shell rendered at full width.
    await renderLayout();
    expect(document.querySelector(".shell")).not.toBeNull();

    const shellRule = /\.shell\s*\{[^}]*\}/.exec(GLOBALS_CSS);
    expect(shellRule).not.toBeNull();
    expect(shellRule![0]).toMatch(/max-width:\s*430px/);
  });

  it("reads the pickers once, in parallel, from the active repositories", async () => {
    await renderLayout();

    expect(repos.listActiveCategories).toHaveBeenCalledTimes(1);
    expect(repos.listActiveMembers).toHaveBeenCalledTimes(1);
  });

  it("opens the add sheet from the FAB with the picker data inside the provider", async () => {
    await renderLayout();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Agregar movimiento" }));

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByRole("radio", { name: "Super" })).toBeDefined();
    expect(screen.getByRole("radio", { name: "Sofi" })).toBeDefined();
    expect(screen.getByRole("radio", { name: "Mati" })).toBeDefined();
  });

  it.each([
    ["a valid active member cookie", "11", "Mati"],
    ["an archived or unknown member cookie", "99", "Sofi"],
    ["a garbage cookie", "abc", "Sofi"],
    ["no cookie", undefined, "Sofi"],
  ])("preselects the member from %s", async (_label, cookie, expected) => {
    cookieValue.current = cookie;
    await renderLayout();

    fireEvent.click(screen.getByRole("button", { name: "Agregar movimiento" }));

    expect(screen.getByRole("radio", { name: expected }).getAttribute("aria-checked")).toBe("true");
  });
});
