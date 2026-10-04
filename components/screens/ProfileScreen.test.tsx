// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/members", () => ({
  createMemberAction: vi.fn(),
  archiveMemberAction: vi.fn(),
  restoreMemberAction: vi.fn(),
}));
vi.mock("@/app/actions/categories", () => ({
  createCategoryAction: vi.fn(),
  renameCategoryAction: vi.fn(),
  archiveCategoryAction: vi.fn(),
  restoreCategoryAction: vi.fn(),
}));
vi.mock("@/app/actions/setTheme", () => ({ setTheme: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { ProfileScreen } from "@/components/screens/ProfileScreen";

afterEach(cleanup);

describe("ProfileScreen", () => {
  it("renders every section with the stored data", () => {
    render(
      <ProfileScreen
        members={[{ id: 1, name: "Sofi" }]}
        categories={[{ id: 1, name: "Super", icon: "shopping-cart", color: "var(--accent-0)" }]}
        archivedMembers={[{ id: 2, name: "Ana" }]}
        archivedCategories={[]}
        themePreference="dark"
      />,
    );

    expect(screen.getByRole("heading", { name: "Perfil" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Personas", level: 2 })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Categorías de gastos" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Archivadas" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Tema" })).toBeDefined();
    expect(screen.getByText("Sofi")).toBeDefined();
    expect(screen.getByText("Ana")).toBeDefined();
    expect(screen.getByRole("radio", { name: "Oscuro" }).getAttribute("aria-checked")).toBe("true");
  });
});
