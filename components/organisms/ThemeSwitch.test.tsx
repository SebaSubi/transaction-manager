// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ setTheme: vi.fn() }));

vi.mock("@/app/actions/setTheme", () => ({ setTheme: actions.setTheme }));

import { ThemeSwitch, applyThemeToDocument } from "@/components/organisms/ThemeSwitch";

function stubMatchMedia(prefersDark: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: prefersDark,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  actions.setTheme.mockReset();
  stubMatchMedia(true);
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themePref;
});
afterEach(cleanup);

describe("ThemeSwitch", () => {
  it("renders three options with the stored preference selected", () => {
    render(<ThemeSwitch preference="light" />);

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Claro" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Oscuro" }).getAttribute("aria-checked")).toBe("false");
  });

  it("calls setTheme with the mapped value and updates the document", async () => {
    actions.setTheme.mockResolvedValue(undefined);
    render(<ThemeSwitch preference="light" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "Oscuro" }));
    });

    expect(actions.setTheme).toHaveBeenCalledTimes(1);
    expect(actions.setTheme).toHaveBeenCalledWith("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themePref).toBe("dark");
  });

  it("maps Sistema to system and resolves it through matchMedia", async () => {
    actions.setTheme.mockResolvedValue(undefined);
    stubMatchMedia(false);
    render(<ThemeSwitch preference="dark" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "Sistema" }));
    });

    expect(actions.setTheme).toHaveBeenCalledWith("system");
    expect(document.documentElement.dataset.themePref).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("reverts the selection and the document when the save is rejected", async () => {
    actions.setTheme.mockRejectedValue(new Error("unauthorized"));
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.themePref = "light";
    render(<ThemeSwitch preference="light" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "Oscuro" }));
    });

    expect(screen.getByRole("radio", { name: "Claro" }).getAttribute("aria-checked")).toBe("true");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.themePref).toBe("light");
  });
});

describe("applyThemeToDocument", () => {
  it("writes an explicit preference as both attributes", () => {
    applyThemeToDocument("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themePref).toBe("dark");
  });
});
