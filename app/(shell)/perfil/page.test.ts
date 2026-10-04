import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repos = vi.hoisted(() => ({
  listActiveMembers: vi.fn(),
  listArchivedMembers: vi.fn(),
  listActiveCategoriesByKind: vi.fn(),
  listArchivedCategories: vi.fn(),
}));
const cookieStore = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/db/repositories/members.repository", () => ({
  listActiveMembers: repos.listActiveMembers,
  listArchivedMembers: repos.listArchivedMembers,
}));
vi.mock("@/lib/db/repositories/categories.repository", () => ({
  listActiveCategoriesByKind: repos.listActiveCategoriesByKind,
  listArchivedCategories: repos.listArchivedCategories,
}));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@/components/screens/ProfileScreen", () => ({ ProfileScreen: () => null }));

const { default: PerfilPage } = await import("@/app/(shell)/perfil/page");

async function render() {
  const element = (await PerfilPage()) as ReactElement<Record<string, unknown>>;
  return element.props as {
    members: { id: number; name: string }[];
    categories: { id: number; name: string; icon: string; color: string }[];
    archivedMembers: { id: number; name: string }[];
    archivedCategories: { id: number; name: string }[];
    themePreference: string;
  };
}

beforeEach(() => {
  for (const mock of Object.values(repos)) mock.mockReset();
  cookieStore.get.mockReset();
  repos.listActiveMembers.mockResolvedValue([{ id: 1, name: "Sofi" }]);
  repos.listArchivedMembers.mockResolvedValue([{ id: 2, name: "Ana" }]);
  repos.listActiveCategoriesByKind.mockResolvedValue([
    { id: 1, name: "Super", kind: "expense", icon: "shopping-cart", colorIndex: 0 },
  ]);
  repos.listArchivedCategories.mockResolvedValue([
    { id: 7, name: "Vieja", kind: "expense", icon: "tag", colorIndex: 2 },
  ]);
  cookieStore.get.mockReturnValue(undefined);
});

describe("perfil page", () => {
  it("reads active and archived members and expense categories", async () => {
    const props = await render();

    expect(repos.listActiveCategoriesByKind).toHaveBeenCalledWith("expense");
    expect(repos.listArchivedCategories).toHaveBeenCalledWith("expense");
    expect(props.members).toEqual([{ id: 1, name: "Sofi" }]);
    expect(props.archivedMembers).toEqual([{ id: 2, name: "Ana" }]);
    expect(props.categories[0]).toMatchObject({ id: 1, name: "Super", icon: "shopping-cart" });
    expect(props.archivedCategories[0]).toMatchObject({ id: 7, name: "Vieja" });
  });

  it("does not leak extra row fields to the screen", async () => {
    const props = await render();
    expect(Object.keys(props.categories[0]).sort()).toEqual(["color", "icon", "id", "name"]);
  });

  it("uses the tm_theme cookie as the preference", async () => {
    cookieStore.get.mockReturnValue({ name: "tm_theme", value: "dark" });
    const props = await render();

    expect(cookieStore.get).toHaveBeenCalledWith("tm_theme");
    expect(props.themePreference).toBe("dark");
  });

  it("falls back to the default preference without a cookie", async () => {
    const props = await render();
    expect(props.themePreference).toBe("system");
  });

  it("falls back to the default preference on an invalid cookie value", async () => {
    cookieStore.get.mockReturnValue({ name: "tm_theme", value: "neon" });
    const props = await render();
    expect(props.themePreference).toBe("system");
  });
});
