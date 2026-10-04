import { beforeEach, describe, expect, it, vi } from "vitest";

import { expiredSession, tamperedSession } from "@/app/actions/sessionFixtures";
import { UnauthorizedError } from "@/lib/auth/requireSession";
import { signSession } from "@/lib/auth/session";
import { CATEGORIES_ACTIVE_NAME_UQ } from "@/lib/db/errors";
import { VALIDATION_MESSAGES } from "@/lib/domain/messages";

const jar = vi.hoisted(() => ({
  session: undefined as string | undefined,
  set: [] as Array<{ name: string; value: string }>,
}));
const revalidated = vi.hoisted(() => ({ paths: [] as string[] }));
const repo = vi.hoisted(() => ({
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  archiveCategory: vi.fn(),
  unarchiveCategory: vi.fn(),
  getCategoryById: vi.fn(),
  listActiveCategories: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "tm_session" && jar.session !== undefined
        ? { name, value: jar.session }
        : undefined,
    set: (name: string, value: string) => {
      jar.set.push({ name, value });
    },
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    revalidated.paths.push(path);
  },
}));
vi.mock("@/lib/db/repositories/categories.repository", () => ({
  createCategory: repo.createCategory,
  renameCategory: repo.renameCategory,
  archiveCategory: repo.archiveCategory,
  unarchiveCategory: repo.unarchiveCategory,
  getCategoryById: repo.getCategoryById,
  listActiveCategories: repo.listActiveCategories,
}));

const {
  archiveCategoryAction,
  createCategoryAction,
  renameCategoryAction,
  restoreCategoryAction,
} = await import("@/app/actions/categories");

const M = VALIDATION_MESSAGES;
const IDLE = { status: "idle" } as const;
const SHELL_TABS = ["/perfil", "/inicio", "/presupuesto", "/movimientos"];

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function label(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    name: "Supermercado",
    kind: "expense",
    icon: "shopping-cart",
    colorIndex: 1,
    archived: false,
    ...overrides,
  };
}

function duplicateError(): Error {
  return Object.assign(new Error("Failed query"), {
    cause: Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint: CATEGORIES_ACTIVE_NAME_UQ,
    }),
  });
}

function expectNoSideEffects() {
  for (const mock of Object.values(repo)) expect(mock).not.toHaveBeenCalled();
  expect(jar.set).toHaveLength(0);
  expect(revalidated.paths).toHaveLength(0);
}

beforeEach(async () => {
  vi.clearAllMocks();
  jar.session = await signSession();
  jar.set = [];
  revalidated.paths = [];
  repo.createCategory.mockResolvedValue({ id: 10, name: "Mascotas" });
  repo.renameCategory.mockResolvedValue({ id: 3, name: "Almacén" });
  repo.archiveCategory.mockResolvedValue(undefined);
  repo.unarchiveCategory.mockResolvedValue({ id: 3, name: "Supermercado" });
  repo.getCategoryById.mockResolvedValue(label());
  repo.listActiveCategories.mockResolvedValue(Array.from({ length: 8 }, (_, i) => ({ id: i + 1 })));
});

describe("assertSession in every category action", () => {
  const invocations: Array<[string, () => Promise<unknown>]> = [
    [
      "createCategoryAction",
      () => createCategoryAction(IDLE, form({ name: "Mascotas", icon: "gift" })),
    ],
    ["renameCategoryAction", () => renameCategoryAction(IDLE, form({ id: "3", name: "Almacén" }))],
    ["archiveCategoryAction", () => archiveCategoryAction(3)],
    ["restoreCategoryAction", () => restoreCategoryAction(3)],
  ];
  const sessions: Array<[string, () => Promise<string | undefined>]> = [
    ["absent", async () => undefined],
    ["tampered", tamperedSession],
    ["expired", expiredSession],
  ];

  describe.each(invocations)("%s", (_name, invoke) => {
    it.each(sessions)("rejects a %s session before any side effect", async (_label, make) => {
      jar.session = await make();

      await expect(invoke()).rejects.toBeInstanceOf(UnauthorizedError);

      expectNoSideEffects();
    });
  });
});

describe("createCategoryAction", () => {
  it("rejects a blank name and a missing icon together, with no repository call", async () => {
    const state = await createCategoryAction(IDLE, form({ name: " ", icon: "nope" }));

    expect(state).toEqual({
      status: "error",
      fieldErrors: { name: M.nameRequired, icon: M.iconRequired },
      formError: null,
    });
    expectNoSideEffects();
  });

  it("rejects an overlong name", async () => {
    const state = await createCategoryAction(
      IDLE,
      form({ name: "x".repeat(41), icon: "gift" }),
    );

    expect(state).toMatchObject({ status: "error", fieldErrors: { name: M.nameTooLong } });
    expectNoSideEffects();
  });

  it("creates an expense category with the picked icon and the next colour index", async () => {
    const state = await createCategoryAction(IDLE, form({ name: " Mascotas ", icon: "gift" }));

    expect(repo.createCategory).toHaveBeenCalledWith({
      name: "Mascotas",
      kind: "expense",
      icon: "gift",
      colorIndex: 2, // nextColorIndex(8 active) = 8 % 6
    });
    expect(state).toEqual({ status: "saved", id: 10, name: "Mascotas" });
    expect(revalidated.paths).toEqual(SHELL_TABS);
  });

  it("maps 23505 to categoryNameTaken without revalidating", async () => {
    repo.createCategory.mockRejectedValue(duplicateError());

    const state = await createCategoryAction(IDLE, form({ name: "Mascotas", icon: "gift" }));

    expect(state).toEqual({
      status: "error",
      fieldErrors: { name: M.categoryNameTaken },
      formError: null,
    });
    expect(revalidated.paths).toHaveLength(0);
  });

  it("maps an unexpected throw to saveFailed", async () => {
    repo.createCategory.mockRejectedValue(new Error("boom"));

    const state = await createCategoryAction(IDLE, form({ name: "Mascotas", icon: "gift" }));

    expect(state).toMatchObject({ status: "error", formError: M.saveFailed });
    expect(revalidated.paths).toHaveLength(0);
  });
});

describe("renameCategoryAction", () => {
  it.each([
    ["a bad id", { id: "abc", name: "Almacén" }],
    ["a blank name", { id: "3", name: "  " }],
    ["an overlong name", { id: "3", name: "x".repeat(41) }],
  ])("rejects %s before the database", async (_label, fields) => {
    const state = await renameCategoryAction(IDLE, form(fields));

    expect(state.status).toBe("error");
    expectNoSideEffects();
  });

  it("renames an active expense category and revalidates every shell tab", async () => {
    const state = await renameCategoryAction(IDLE, form({ id: "3", name: " Almacén " }));

    expect(repo.renameCategory).toHaveBeenCalledWith(3, "expense", "Almacén");
    expect(state).toEqual({ status: "saved", id: 3, name: "Almacén" });
    expect(revalidated.paths).toEqual(SHELL_TABS);
  });

  it("answers categoryNotManaged for an income category with no write", async () => {
    repo.getCategoryById.mockResolvedValue(label({ kind: "income" }));

    const state = await renameCategoryAction(IDLE, form({ id: "3", name: "Almacén" }));

    expect(state).toMatchObject({ status: "error", formError: M.categoryNotManaged });
    expect(repo.renameCategory).not.toHaveBeenCalled();
  });

  it("answers categoryUnavailable for an archived category with no write", async () => {
    repo.getCategoryById.mockResolvedValue(label({ archived: true }));

    const state = await renameCategoryAction(IDLE, form({ id: "3", name: "Almacén" }));

    expect(state).toMatchObject({ status: "error", formError: M.categoryUnavailable });
    expect(repo.renameCategory).not.toHaveBeenCalled();
  });

  it("maps a null update to categoryUnavailable", async () => {
    repo.renameCategory.mockResolvedValue(null);

    const state = await renameCategoryAction(IDLE, form({ id: "3", name: "Almacén" }));

    expect(state).toMatchObject({ status: "error", formError: M.categoryUnavailable });
    expect(revalidated.paths).toHaveLength(0);
  });

  it("maps 23505 to categoryNameTaken without revalidating", async () => {
    repo.renameCategory.mockRejectedValue(duplicateError());

    const state = await renameCategoryAction(IDLE, form({ id: "3", name: "Almacén" }));

    expect(state).toMatchObject({ status: "error", fieldErrors: { name: M.categoryNameTaken } });
    expect(revalidated.paths).toHaveLength(0);
  });
});

describe("archiveCategoryAction", () => {
  it("rejects a bad id without a read", async () => {
    const result = await archiveCategoryAction("abc");

    expect(result).toEqual({ status: "error", message: M.archiveFailed });
    expectNoSideEffects();
  });

  it("archives an expense category and revalidates every shell tab", async () => {
    const result = await archiveCategoryAction(3);

    expect(result).toEqual({ status: "ok" });
    expect(repo.archiveCategory).toHaveBeenCalledWith(3, expect.any(Date));
    expect(revalidated.paths).toEqual(SHELL_TABS);
  });

  it("answers categoryNotManaged for an income category with no write", async () => {
    repo.getCategoryById.mockResolvedValue(label({ kind: "income" }));

    const result = await archiveCategoryAction(3);

    expect(result).toEqual({ status: "error", message: M.categoryNotManaged });
    expect(repo.archiveCategory).not.toHaveBeenCalled();
  });

  it("is idempotent for an already archived category", async () => {
    repo.getCategoryById.mockResolvedValue(label({ archived: true }));

    const result = await archiveCategoryAction(3);

    expect(result).toEqual({ status: "ok" });
    expect(repo.archiveCategory).not.toHaveBeenCalled();
  });

  it("reports a missing category", async () => {
    repo.getCategoryById.mockResolvedValue(null);

    expect(await archiveCategoryAction(3)).toEqual({
      status: "error",
      message: M.categoryMissing,
    });
  });
});

describe("restoreCategoryAction", () => {
  beforeEach(() => {
    repo.getCategoryById.mockResolvedValue(label({ archived: true }));
  });

  it("restores an archived expense category and revalidates every shell tab", async () => {
    const result = await restoreCategoryAction(3);

    expect(result).toEqual({ status: "ok" });
    expect(repo.unarchiveCategory).toHaveBeenCalledWith(3, "expense");
    expect(revalidated.paths).toEqual(SHELL_TABS);
  });

  it("answers categoryNotManaged for an income category with no write", async () => {
    repo.getCategoryById.mockResolvedValue(label({ kind: "income", archived: true }));

    const result = await restoreCategoryAction(3);

    expect(result).toEqual({ status: "error", message: M.categoryNotManaged });
    expect(repo.unarchiveCategory).not.toHaveBeenCalled();
  });

  it("is idempotent for an already active category", async () => {
    repo.getCategoryById.mockResolvedValue(label());

    const result = await restoreCategoryAction(3);

    expect(result).toEqual({ status: "ok" });
    expect(repo.unarchiveCategory).not.toHaveBeenCalled();
  });

  it("maps 23505 to categoryRestoreNameTaken without revalidating", async () => {
    repo.unarchiveCategory.mockRejectedValue(duplicateError());

    const result = await restoreCategoryAction(3);

    expect(result).toEqual({ status: "error", message: M.categoryRestoreNameTaken });
    expect(revalidated.paths).toHaveLength(0);
  });

  it("maps a null update to restoreFailed", async () => {
    repo.unarchiveCategory.mockResolvedValue(null);

    expect(await restoreCategoryAction(3)).toEqual({
      status: "error",
      message: M.restoreFailed,
    });
  });
});
