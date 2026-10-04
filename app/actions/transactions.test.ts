import { beforeEach, describe, expect, it, vi } from "vitest";

import { UnauthorizedError } from "@/lib/auth/requireSession";
import {
  SESSION_MAX_AGE_SECONDS,
  signSession,
} from "@/lib/auth/session";
import type { CategoryLabel } from "@/lib/db/repositories/categories.repository";
import type { MemberLabel } from "@/lib/db/repositories/members.repository";
import { VALIDATION_MESSAGES } from "@/lib/domain/messages";
import type { DomainTransaction } from "@/lib/domain/types";
import { LAST_MEMBER_COOKIE, LAST_MEMBER_MAX_AGE_SECONDS } from "@/lib/members/cookies";
import { toLedgerRowView } from "@/lib/view/ledger";

interface RecordedCookie {
  name: string;
  value: string;
  options: Record<string, unknown>;
}

const jar = vi.hoisted(() => ({
  session: undefined as string | undefined,
  set: [] as RecordedCookie[],
}));
const revalidated = vi.hoisted(() => ({ paths: [] as string[] }));

const repo = vi.hoisted(() => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  getTransactionById: vi.fn(),
  getCategoryById: vi.fn(),
  getMemberById: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "tm_session" && jar.session !== undefined
        ? { name, value: jar.session }
        : undefined,
    set: (name: string, value: string, options: Record<string, unknown>) => {
      jar.set.push({ name, value, options });
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    revalidated.paths.push(path);
  },
}));

vi.mock("@/lib/db/repositories/transactions.repository", () => ({
  createTransaction: repo.createTransaction,
  updateTransaction: repo.updateTransaction,
  deleteTransaction: repo.deleteTransaction,
  getTransactionById: repo.getTransactionById,
}));
vi.mock("@/lib/db/repositories/categories.repository", () => ({
  getCategoryById: repo.getCategoryById,
}));
vi.mock("@/lib/db/repositories/members.repository", () => ({
  getMemberById: repo.getMemberById,
}));

const {
  createTransactionAction,
  deleteTransactionAction,
  updateTransactionAction,
} = await import("@/app/actions/transactions");

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

function member(overrides: Partial<MemberLabel> = {}): MemberLabel {
  return { id: 2, name: "Ana", archived: false, ...overrides };
}

function stored(overrides: Partial<DomainTransaction> = {}): DomainTransaction {
  return {
    id: 10,
    type: "expense",
    amount: 31000,
    gross: 33333,
    cashbackBps: 700,
    categoryId: 3,
    memberId: 2,
    date: new Date("2026-08-14T21:00:30Z"),
    ...overrides,
  };
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const VALID_FIELDS = {
  type: "expense",
  gross: "33333",
  cashback: "7",
  categoryId: "3",
  memberId: "2",
  date: "2026-08-14T21:00",
};

function allRepositoryMocks() {
  return Object.values(repo);
}

function expectNoSideEffects() {
  for (const mock of allRepositoryMocks()) expect(mock).not.toHaveBeenCalled();
  expect(jar.set).toHaveLength(0);
  expect(revalidated.paths).toHaveLength(0);
}

beforeEach(async () => {
  vi.clearAllMocks();
  jar.session = await signSession();
  jar.set = [];
  revalidated.paths = [];
  repo.getCategoryById.mockResolvedValue(category());
  repo.getMemberById.mockResolvedValue(member());
  repo.getTransactionById.mockResolvedValue(stored());
  repo.createTransaction.mockImplementation(async (input) => ({ id: 10, ...input }));
  repo.updateTransaction.mockImplementation(async (id, input) => ({ id, ...input }));
  repo.deleteTransaction.mockResolvedValue(true);
});

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

describe("assertSession in every mutating action", () => {
  const invocations: Array<[string, () => Promise<unknown>]> = [
    [
      "createTransactionAction",
      () => createTransactionAction(IDLE, form(VALID_FIELDS)),
    ],
    [
      "updateTransactionAction",
      () => updateTransactionAction(IDLE, form({ ...VALID_FIELDS, id: "10" })),
    ],
    ["deleteTransactionAction", () => deleteTransactionAction(10)],
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

describe("createTransactionAction", () => {
  it("returns field errors for invalid input, with no write and no cookie", async () => {
    const state = await createTransactionAction(
      IDLE,
      form({ ...VALID_FIELDS, gross: "12.5", date: "" }),
    );

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { gross: M.grossNotWhole, date: M.dateInvalid },
    });
    expect(repo.createTransaction).not.toHaveBeenCalled();
    expect(jar.set).toHaveLength(0);
    expect(revalidated.paths).toHaveLength(0);
  });

  it("persists the computed net, gross and cashback bps", async () => {
    await createTransactionAction(IDLE, form(VALID_FIELDS));

    expect(repo.createTransaction).toHaveBeenCalledTimes(1);
    expect(repo.createTransaction).toHaveBeenCalledWith({
      type: "expense",
      amount: 31000,
      gross: 33333,
      cashbackBps: 700,
      categoryId: 3,
      memberId: 2,
      date: new Date("2026-08-14T21:00:00Z"),
    });
  });

  it("ignores a client-supplied amount", async () => {
    await createTransactionAction(IDLE, form({ ...VALID_FIELDS, amount: "1" }));

    expect(repo.createTransaction.mock.calls[0][0].amount).toBe(31000);
  });

  it("forces cashback to zero for an income", async () => {
    repo.getCategoryById.mockResolvedValue(category({ kind: "income" }));

    await createTransactionAction(
      IDLE,
      form({ ...VALID_FIELDS, type: "income", cashback: "9" }),
    );

    expect(repo.createTransaction.mock.calls[0][0]).toMatchObject({
      type: "income",
      amount: 33333,
      cashbackBps: 0,
    });
  });

  it("sets the last-member cookie only after a successful write", async () => {
    await createTransactionAction(IDLE, form(VALID_FIELDS));

    expect(jar.set).toHaveLength(1);
    expect(jar.set[0]).toMatchObject({
      name: LAST_MEMBER_COOKIE,
      value: "2",
      options: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: LAST_MEMBER_MAX_AGE_SECONDS,
      },
    });
  });

  it("revalidates movimientos, presupuesto and inicio", async () => {
    await createTransactionAction(IDLE, form(VALID_FIELDS));

    expect(revalidated.paths).toEqual(["/movimientos", "/presupuesto", "/inicio"]);
  });

  it("returns the mapped persisted row", async () => {
    const state = await createTransactionAction(IDLE, form(VALID_FIELDS));

    const persisted = repo.createTransaction.mock.results[0];
    expect(state).toEqual({
      status: "saved",
      memberId: 2,
      row: toLedgerRowView(
        await (persisted.value as Promise<DomainTransaction>),
        category(),
        member(),
      ),
    });
  });

  it("rejects an archived category, with no write", async () => {
    repo.getCategoryById.mockResolvedValue(category({ archived: true }));

    const state = await createTransactionAction(IDLE, form(VALID_FIELDS));

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { categoryId: M.categoryUnavailable },
    });
    expect(repo.createTransaction).not.toHaveBeenCalled();
    expect(jar.set).toHaveLength(0);
  });

  it("rejects a category of the wrong kind", async () => {
    repo.getCategoryById.mockResolvedValue(category({ kind: "income" }));

    const state = await createTransactionAction(IDLE, form(VALID_FIELDS));

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { categoryId: M.categoryKindMismatch },
    });
    expect(repo.createTransaction).not.toHaveBeenCalled();
  });

  it("rejects an archived or missing member, with no write", async () => {
    repo.getMemberById.mockResolvedValue(member({ archived: true }));
    const archived = await createTransactionAction(IDLE, form(VALID_FIELDS));

    repo.getMemberById.mockResolvedValue(null);
    const missing = await createTransactionAction(IDLE, form(VALID_FIELDS));

    for (const state of [archived, missing]) {
      expect(state).toMatchObject({
        status: "error",
        fieldErrors: { memberId: M.memberUnavailable },
      });
    }
    expect(repo.createTransaction).not.toHaveBeenCalled();
  });

  it("maps a thrown repository error to the generic save failure", async () => {
    repo.createTransaction.mockRejectedValue(new Error("connection reset"));

    const state = await createTransactionAction(IDLE, form(VALID_FIELDS));

    expect(state).toEqual({
      status: "error",
      fieldErrors: {},
      formError: M.saveFailed,
    });
    expect(jar.set).toHaveLength(0);
    expect(revalidated.paths).toHaveLength(0);
  });
});

describe("updateTransactionAction", () => {
  const UPDATE_FIELDS = { ...VALID_FIELDS, id: "10" };

  it("updates the row by id with the computed net and sets the cookie", async () => {
    const state = await updateTransactionAction(IDLE, form(UPDATE_FIELDS));

    expect(repo.updateTransaction).toHaveBeenCalledTimes(1);
    expect(repo.updateTransaction.mock.calls[0][0]).toBe(10);
    expect(repo.updateTransaction.mock.calls[0][1]).toMatchObject({
      amount: 31000,
      gross: 33333,
      cashbackBps: 700,
    });
    expect(state).toMatchObject({ status: "saved", memberId: 2 });
    expect(jar.set.map((c) => [c.name, c.value])).toEqual([[LAST_MEMBER_COOKIE, "2"]]);
    expect(revalidated.paths).toEqual(["/movimientos", "/presupuesto", "/inicio"]);
  });

  it("requires a valid id", async () => {
    const state = await updateTransactionAction(
      IDLE,
      form({ ...VALID_FIELDS, id: "1; DROP" }),
    );

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { id: M.transactionNotFound },
    });
    expect(repo.updateTransaction).not.toHaveBeenCalled();
  });

  it("keeps an unchanged archived category and member (Q7)", async () => {
    repo.getCategoryById.mockResolvedValue(category({ archived: true }));
    repo.getMemberById.mockResolvedValue(member({ archived: true }));

    const state = await updateTransactionAction(IDLE, form(UPDATE_FIELDS));

    expect(state).toMatchObject({ status: "saved" });
    expect(repo.updateTransaction).toHaveBeenCalledTimes(1);
  });

  it("rejects switching to a different archived category", async () => {
    repo.getCategoryById.mockResolvedValue(category({ id: 4, archived: true }));

    const state = await updateTransactionAction(
      IDLE,
      form({ ...UPDATE_FIELDS, categoryId: "4" }),
    );

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { categoryId: M.categoryUnavailable },
    });
    expect(repo.updateTransaction).not.toHaveBeenCalled();
  });

  it("keeps existing.date (seconds preserved) when the date is untouched", async () => {
    await updateTransactionAction(IDLE, form(UPDATE_FIELDS));

    expect(repo.updateTransaction.mock.calls[0][1].date).toEqual(
      new Date("2026-08-14T21:00:30Z"),
    );
  });

  it("uses the submitted date when it changed", async () => {
    await updateTransactionAction(
      IDLE,
      form({ ...UPDATE_FIELDS, date: "2026-08-15T09:30" }),
    );

    expect(repo.updateTransaction.mock.calls[0][1].date).toEqual(
      new Date("2026-08-15T09:30:00Z"),
    );
  });

  it("reports a vanished row as not found, with no cookie or revalidation", async () => {
    repo.getTransactionById.mockResolvedValue(null);

    const state = await updateTransactionAction(IDLE, form(UPDATE_FIELDS));

    expect(state).toEqual({
      status: "error",
      fieldErrors: {},
      formError: M.transactionNotFound,
    });
    expect(repo.updateTransaction).not.toHaveBeenCalled();
    expect(jar.set).toHaveLength(0);
    expect(revalidated.paths).toHaveLength(0);
  });

  it("reports a row deleted between the read and the write as not found", async () => {
    repo.updateTransaction.mockResolvedValue(null);

    const state = await updateTransactionAction(IDLE, form(UPDATE_FIELDS));

    expect(state).toEqual({
      status: "error",
      fieldErrors: {},
      formError: M.transactionNotFound,
    });
    expect(jar.set).toHaveLength(0);
    expect(revalidated.paths).toHaveLength(0);
  });

  it("maps a thrown repository error to the generic save failure", async () => {
    repo.updateTransaction.mockRejectedValue(new Error("boom"));

    const state = await updateTransactionAction(IDLE, form(UPDATE_FIELDS));

    expect(state).toEqual({
      status: "error",
      fieldErrors: {},
      formError: M.saveFailed,
    });
  });
});

describe("deleteTransactionAction", () => {
  it.each([["'1; DROP'", "1; DROP"], ["-1", -1], ["1.5", 1.5], ["{}", {}], ["undefined", undefined]])(
    "rejects the id %s without touching the repository",
    async (_label, id) => {
      const result = await deleteTransactionAction(id);

      expect(result).toEqual({ status: "error", message: M.deleteFailed });
      expect(repo.deleteTransaction).not.toHaveBeenCalled();
      expect(revalidated.paths).toHaveLength(0);
    },
  );

  it("deletes a valid id and revalidates", async () => {
    const result = await deleteTransactionAction(10);

    expect(result).toEqual({ status: "deleted", id: 10 });
    expect(repo.deleteTransaction).toHaveBeenCalledWith(10);
    expect(revalidated.paths).toEqual(["/movimientos", "/presupuesto", "/inicio"]);
  });

  it("accepts a numeric string id", async () => {
    await expect(deleteTransactionAction("10")).resolves.toEqual({
      status: "deleted",
      id: 10,
    });
  });

  it("treats an already-deleted id as success", async () => {
    repo.deleteTransaction.mockResolvedValue(false);

    await expect(deleteTransactionAction(10)).resolves.toEqual({
      status: "deleted",
      id: 10,
    });
  });

  it("maps a thrown repository error to the generic delete failure", async () => {
    repo.deleteTransaction.mockRejectedValue(new Error("boom"));

    await expect(deleteTransactionAction(10)).resolves.toEqual({
      status: "error",
      message: M.deleteFailed,
    });
  });
});
