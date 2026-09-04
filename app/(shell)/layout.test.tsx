// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installMatchMedia, type MatchMediaStub } from "@/test/stubs/matchMedia";

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
});

afterEach(() => {
  cleanup();
  matchMedia.restore();
});

describe("shell layout", () => {
  it("wraps the page content of every tab route", () => {
    render(<ShellLayout>{<p>contenido de la pestaña</p>}</ShellLayout>);

    const content = screen.getByText("contenido de la pestaña");
    expect(content.closest(".shell__content")).not.toBeNull();
    expect(content.closest(".shell")).not.toBeNull();
  });

  it("renders the bottom nav alongside the page content", () => {
    render(<ShellLayout>{<p>contenido</p>}</ShellLayout>);

    const nav = screen.getByRole("navigation");
    expect(nav.closest(".shell")).not.toBeNull();
    for (const label of ["Inicio", "Presupuesto", "Movimientos", "Perfil"]) {
      expect(screen.getByRole("link", { name: label })).toBeDefined();
    }
  });

  it("puts the page content before the bottom nav in the shell", () => {
    const { container } = render(<ShellLayout>{<p>contenido</p>}</ShellLayout>);
    const shell = container.querySelector(".shell");

    expect(shell).not.toBeNull();
    const children = Array.from(shell!.children);
    const main = children.findIndex((node) => node.tagName === "MAIN");
    const nav = children.findIndex((node) => node.tagName === "NAV");
    expect(main).toBeGreaterThanOrEqual(0);
    expect(nav).toBeGreaterThan(main);
  });

  it("constrains the shell to a 430px maximum width", () => {
    // The width is one CSS declaration rather than an inline style, so the
    // rendered class and the stylesheet rule are asserted as a pair: either
    // half alone could pass while the shell rendered at full width.
    render(<ShellLayout>{<p>contenido</p>}</ShellLayout>);
    expect(document.querySelector(".shell")).not.toBeNull();

    const shellRule = /\.shell\s*\{[^}]*\}/.exec(GLOBALS_CSS);
    expect(shellRule).not.toBeNull();
    expect(shellRule![0]).toMatch(/max-width:\s*430px/);
  });
});
