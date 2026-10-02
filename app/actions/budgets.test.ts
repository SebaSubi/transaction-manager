import { beforeEach, describe, expect, it, vi } from "vitest";

import { UnauthorizedError } from "@/lib/auth/requireSession";
import {
  SESSION_MAX_AGE_SECONDS,
  signSession,
} from "@/lib/auth/session";
import type { CategoryLabel } from "@/lib/db/repositories/categories.repository";
import { VALIDATION_MESSAGES } from "@/lib/domain/messages";

interface RecordedCookie {
  name: string;
  value: string;
}

const jar = vi.hoisted(() => ({
  session: undefined as string | undefined,
  set: [] as RecordedCookie[],
}));
const revalidated = vi.hoisted(() => ({ paths: [] as string[] }));

const repo = vi.hoisted(() => ({
  getBudgetsForMonth: vi.fn(),
  upsertBudget: vi.fn(),
  deleteBudget: vi.fn(),
  copyMissingBudgets: vi.fn(),
  getCategoryById: vi.fn(),
  listActiveCategoriesByKind: vi.fn(),
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

vi.mock("@/lib/db/repositories/budgets.repository", () => ({
  getBudgetsForMonth: repo.getBudgetsForMonth,
  upsertBudget: repo.upsertBudget,
  deleteBudget: repo.deleteBudget,
  copyMissingBudgets: repo.copyMissingBudgets,
}));
vi.mock("@/lib/db/repositories/categories.repository", () => ({
  getCategoryById: repo.getCategoryById,
  listActiveCategoriesByKind: repo.listActiveCategoriesByKind,
}));
vi.mock("@/lib/db/repositories/transactions.repository", () => {
  throw new Error("budget actions must never touch the transactions repository");
});

const { copyBudgetsAction, removeBudgetAction, upsertBudgetAction } = await import(
  "@/app/actions/budgets"
);

const M = VALIDATION_MESSAGES;
const IDLE = { status: "idle" } as const;

function category(overrides: Partial<CategoryLabel> = {}): CategoryLabel {
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

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const VALID_FIELDS = { month: "2026-08", categoryId: "3", amount: "50000" };

function expectNoSideEffects() {
  for (const mock of Object.values(repo)) expect(mock).not.toHaveBeenCalled();
  expect(jar.set).toHaveLength(0);
  expect(revalidated.paths).toHaveLength(0);
}

async function expiredSession(): Promise<string> {
  return signSession(Math.floor(Date.now() / 1000) - SESSION_MAX_AGE_SECONDS - 10);
}

async function tamperedSession(): Promise<string> {
  const [payload, signature] = (await signSession()).split(".");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  decoded.exp += 60 * 60 * 24 * 365;
  const forged = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");
  return `${forged}.${signature}`;
}

beforeEach(async () => {
  vi.clearAllMocks();
  jar.session = await signSession();
  jar.set = [];
  revalidated.paths = [];
  repo.getCategoryById.mockResolvedValue(category());
  repo.getBudgetsForMonth.mockResolvedValue([]);
  repo.listActiveCategoriesByKind.mockResolvedValue([]);
  repo.upsertBudget.mockImplementation(async (input) => ({
    categoryId: input.categoryId,
    amount: input.amount,
  }));
  repo.deleteBudget.mockResolvedValue(true);
  repo.copyMissingBudgets.mockResolvedValue(0);
});

describe("assertSession in every mutating action", () => {
  const invocations: Array<[string, () => Promise<unknown>]> = [
    ["upsertBudgetAction", () => upsertBudgetAction(IDLE, form(VALID_FIELDS))],
    ["removeBudgetAction", () => removeBudgetAction("2026-08", 3)],
    ["copyBudgetsAction", () => copyBudgetsAction("2026-08")],
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

describe("upsertBudgetAction", () => {
  it.each([["0"], ["-3"], ["1.5"], [""], ["abc"]])(
    "rejects the amount %j without a write",
    async (amount) => {
      const state = await upsertBudgetAction(IDLE, form({ ...VALID_FIELDS, amount }));

      expect(state).toMatchObject({
        status: "error",
        fieldErrors: { amount: M.budgetAmountInvalid },
      });
      expect(repo.upsertBudget).not.toHaveBeenCalled();
      expect(revalidated.paths).toHaveLength(0);
    },
  );

  it("rejects an income category", async () => {
    repo.getCategoryById.mockResolvedValue(category({ kind: "income" }));

    const state = await upsertBudgetAction(IDLE, form(VALID_FIELDS));

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { categoryId: M.budgetCategoryNotExpense },
    });
    expect(repo.upsertBudget).not.toHaveBeenCalled();
  });

  it("rejects a missing category", async () => {
    repo.getCategoryById.mockResolvedValue(null);

    const state = await upsertBudgetAction(IDLE, form(VALID_FIELDS));

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { categoryId: M.categoryMissing },
    });
  });

  it("rejects an invalid month or category id without reading", async () => {
    const badMonth = await upsertBudgetAction(
      IDLE,
      form({ ...VALID_FIELDS, month: "2026-13" }),
    );
    const badCategory = await upsertBudgetAction(
      IDLE,
      form({ ...VALID_FIELDS, categoryId: "x" }),
    );

    expect(badMonth.status).toBe("error");
    expect(badCategory).toMatchObject({
      status: "error",
      fieldErrors: { categoryId: M.categoryRequired },
    });
    expect(repo.getCategoryById).not.toHaveBeenCalled();
    expect(repo.upsertBudget).not.toHaveBeenCalled();
  });

  it("requires an active category for a new row", async () => {
    repo.getCategoryById.mockResolvedValue(category({ archived: true }));
    repo.getBudgetsForMonth.mockResolvedValue([]);

    const state = await upsertBudgetAction(IDLE, form(VALID_FIELDS));

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { categoryId: M.categoryUnavailable },
    });
    expect(repo.upsertBudget).not.toHaveBeenCalled();
  });

  it("allows editing an existing row whose category is archived", async () => {
    repo.getCategoryById.mockResolvedValue(category({ archived: true }));
    repo.getBudgetsForMonth.mockResolvedValue([{ categoryId: 3, amount: 100 }]);

    const state = await upsertBudgetAction(IDLE, form(VALID_FIELDS));

    expect(state).toEqual({ status: "saved", categoryId: 3, amount: 50000 });
  });

  it("upserts, revalidates presupuesto and inicio, and returns the saved row", async () => {
    const state = await upsertBudgetAction(IDLE, form(VALID_FIELDS));

    expect(repo.upsertBudget).toHaveBeenCalledWith(
      { month: "2026-08", categoryId: 3, amount: 50000 },
      expect.any(Date),
    );
    expect(state).toEqual({ status: "saved", categoryId: 3, amount: 50000 });
    expect(revalidated.paths).toEqual(["/presupuesto", "/inicio"]);
  });

  it("maps a thrown repository error to the generic save failure", async () => {
    repo.upsertBudget.mockRejectedValue(new Error("boom"));

    const state = await upsertBudgetAction(IDLE, form(VALID_FIELDS));

    expect(state).toEqual({
      status: "error",
      fieldErrors: {},
      formError: M.budgetSaveFailed,
    });
    expect(revalidated.paths).toHaveLength(0);
  });
});

describe("removeBudgetAction", () => {
  it.each([
    ["x", 1],
    ["2026-13", 1],
    ["2026-08", "1; DROP"],
    ["2026-08", -1],
    ["2026-08", 1.5],
    [undefined, 1],
  ])("rejects (%j, %j) without any query", async (month, categoryId) => {
    const result = await removeBudgetAction(month, categoryId);

    expect(result).toEqual({ status: "error", message: M.budgetRemoveFailed });
    expect(repo.deleteBudget).not.toHaveBeenCalled();
    expect(revalidated.paths).toHaveLength(0);
  });

  it("removes the row and revalidates", async () => {
    const result = await removeBudgetAction("2026-08", 3);

    expect(result).toEqual({ status: "ok" });
    expect(repo.deleteBudget).toHaveBeenCalledWith("2026-08", 3);
    expect(revalidated.paths).toEqual(["/presupuesto", "/inicio"]);
  });

  it("treats an already-removed row as success", async () => {
    repo.deleteBudget.mockResolvedValue(false);

    await expect(removeBudgetAction("2026-08", 3)).resolves.toEqual({ status: "ok" });
  });

  it("maps a thrown repository error to the generic remove failure", async () => {
    repo.deleteBudget.mockRejectedValue(new Error("boom"));

    await expect(removeBudgetAction("2026-08", 3)).resolves.toEqual({
      status: "error",
      message: M.budgetRemoveFailed,
    });
  });
});

describe("copyBudgetsAction", () => {
  function seed(options: {
    previous: Array<{ categoryId: number; amount: number }>;
    current: Array<{ categoryId: number; amount: number }>;
    activeExpenseIds: number[];
  }) {
    repo.getBudgetsForMonth.mockImplementation(async (month: string) =>
      month === "2026-07" ? options.previous : options.current,
    );
    repo.listActiveCategoriesByKind.mockResolvedValue(
      options.activeExpenseIds.map((id) => category({ id })),
    );
  }

  it.each(["2026-13", "x", undefined, 202608])(
    "rejects the month %j without any query",
    async (month) => {
      const result = await copyBudgetsAction(month);

      expect(result).toEqual({ status: "error", message: M.budgetCopyFailed });
      for (const mock of Object.values(repo)) expect(mock).not.toHaveBeenCalled();
    },
  );

  it("reports nothing to copy for an empty plan and never calls the repository write", async () => {
    seed({ previous: [], current: [], activeExpenseIds: [1, 2] });

    const result = await copyBudgetsAction("2026-08");

    expect(result).toEqual({ status: "nothing" });
    expect(repo.copyMissingBudgets).not.toHaveBeenCalled();
    expect(revalidated.paths).toHaveLength(0);
  });

  it("copies exactly the planned rows and maps the inserted count", async () => {
    seed({
      previous: [
        { categoryId: 1, amount: 100 },
        { categoryId: 2, amount: 200 },
        { categoryId: 3, amount: 300 },
        { categoryId: 9, amount: 900 },
      ],
      current: [{ categoryId: 2, amount: 999 }],
      // 3 is archived or income (not in the active-expense set); 9 likewise.
      activeExpenseIds: [1, 2],
    });
    repo.copyMissingBudgets.mockResolvedValue(1);

    const result = await copyBudgetsAction("2026-08");

    expect(repo.copyMissingBudgets).toHaveBeenCalledTimes(1);
    expect(repo.copyMissingBudgets).toHaveBeenCalledWith(
      [{ categoryId: 1, amount: 100 }],
      "2026-08",
      expect.any(Date),
    );
    expect(result).toEqual({ status: "copied", count: 1 });
    expect(revalidated.paths).toEqual(["/presupuesto", "/inicio"]);
  });

  it("reads the previous month relative to the selected one across a year boundary", async () => {
    seed({ previous: [], current: [], activeExpenseIds: [] });

    await copyBudgetsAction("2027-01");

    expect(repo.getBudgetsForMonth.mock.calls.map((c) => c[0]).sort()).toEqual([
      "2026-12",
      "2027-01",
    ]);
  });

  it("maps a thrown repository error to the generic copy failure", async () => {
    seed({
      previous: [{ categoryId: 1, amount: 100 }],
      current: [],
      activeExpenseIds: [1],
    });
    repo.copyMissingBudgets.mockRejectedValue(new Error("boom"));

    await expect(copyBudgetsAction("2026-08")).resolves.toEqual({
      status: "error",
      message: M.budgetCopyFailed,
    });
    expect(revalidated.paths).toHaveLength(0);
  });
});
