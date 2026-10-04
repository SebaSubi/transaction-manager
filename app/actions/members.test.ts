import { beforeEach, describe, expect, it, vi } from "vitest";

import { expiredSession, tamperedSession } from "@/app/actions/sessionFixtures";
import { UnauthorizedError } from "@/lib/auth/requireSession";
import { signSession } from "@/lib/auth/session";
import { MEMBERS_ACTIVE_NAME_UQ } from "@/lib/db/errors";
import { VALIDATION_MESSAGES } from "@/lib/domain/messages";

const jar = vi.hoisted(() => ({
  session: undefined as string | undefined,
  set: [] as Array<{ name: string; value: string }>,
}));
const revalidated = vi.hoisted(() => ({ paths: [] as string[] }));
const repo = vi.hoisted(() => ({
  createMember: vi.fn(),
  archiveMember: vi.fn(),
  unarchiveMember: vi.fn(),
  getMemberById: vi.fn(),
  listActiveMembers: vi.fn(),
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
vi.mock("@/lib/db/repositories/members.repository", () => ({
  createMember: repo.createMember,
  archiveMember: repo.archiveMember,
  unarchiveMember: repo.unarchiveMember,
  getMemberById: repo.getMemberById,
  listActiveMembers: repo.listActiveMembers,
}));

const { archiveMemberAction, createMemberAction, restoreMemberAction } = await import(
  "@/app/actions/members"
);

const M = VALIDATION_MESSAGES;
const IDLE = { status: "idle" } as const;
const SHELL_TABS = ["/perfil", "/inicio", "/presupuesto", "/movimientos"];

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** The shape Drizzle produces on neon-http: DrizzleQueryError with the driver error as cause. */
function duplicateError(constraint: string = MEMBERS_ACTIVE_NAME_UQ): Error {
  return Object.assign(new Error("Failed query"), {
    cause: Object.assign(new Error("duplicate key"), { code: "23505", constraint }),
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
  repo.createMember.mockResolvedValue({ id: 4, name: "Lucía" });
  repo.archiveMember.mockResolvedValue(undefined);
  repo.unarchiveMember.mockResolvedValue({ id: 2, name: "Mati" });
  repo.getMemberById.mockResolvedValue({ id: 2, name: "Mati", archived: false });
  repo.listActiveMembers.mockResolvedValue([
    { id: 1, name: "Ana" },
    { id: 2, name: "Mati" },
  ]);
});

describe("assertSession in every member action", () => {
  const invocations: Array<[string, () => Promise<unknown>]> = [
    ["createMemberAction", () => createMemberAction(IDLE, form({ name: "Lucía" }))],
    ["archiveMemberAction", () => archiveMemberAction(2)],
    ["restoreMemberAction", () => restoreMemberAction(2)],
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

describe("createMemberAction", () => {
  it.each([[""], ["   "], ["x".repeat(41)]])(
    "rejects the name %j before the database",
    async (name) => {
      const state = await createMemberAction(IDLE, form({ name }));

      expect(state.status).toBe("error");
      expectNoSideEffects();
    },
  );

  it("creates the member and revalidates every shell tab", async () => {
    const state = await createMemberAction(IDLE, form({ name: "  Lucía " }));

    expect(repo.createMember).toHaveBeenCalledWith("Lucía");
    expect(state).toEqual({ status: "saved", id: 4, name: "Lucía" });
    expect(revalidated.paths).toEqual(SHELL_TABS);
  });

  it("maps the members 23505 to memberNameTaken without revalidating", async () => {
    repo.createMember.mockRejectedValue(duplicateError());

    const state = await createMemberAction(IDLE, form({ name: "Ana" }));

    expect(state).toEqual({
      status: "error",
      fieldErrors: { name: M.memberNameTaken },
      formError: null,
    });
    expect(revalidated.paths).toHaveLength(0);
  });

  it("does not mislabel an unrelated unique violation", async () => {
    repo.createMember.mockRejectedValue(duplicateError("budgets_month_category_uq"));

    const state = await createMemberAction(IDLE, form({ name: "Ana" }));

    expect(state).toMatchObject({ status: "error", formError: M.saveFailed });
    expect(revalidated.paths).toHaveLength(0);
  });
});

describe("archiveMemberAction", () => {
  it.each([["abc"], [-1], [1.5], [{}]])("rejects the id %j without a read", async (id) => {
    const result = await archiveMemberAction(id);

    expect(result).toEqual({ status: "error", message: M.archiveFailed });
    expectNoSideEffects();
  });

  it("archives an active member and revalidates every shell tab", async () => {
    const result = await archiveMemberAction(2);

    expect(result).toEqual({ status: "ok" });
    expect(repo.archiveMember).toHaveBeenCalledWith(2, expect.any(Date));
    expect(revalidated.paths).toEqual(SHELL_TABS);
  });

  it("rejects the last active member on the pure path with no write", async () => {
    repo.listActiveMembers.mockResolvedValue([{ id: 2, name: "Mati" }]);

    const result = await archiveMemberAction(2);

    expect(result).toEqual({ status: "error", message: M.lastActiveMember });
    expect(repo.archiveMember).not.toHaveBeenCalled();
    expect(revalidated.paths).toHaveLength(0);
  });

  it("maps a concurrent last-member race to lastActiveMember", async () => {
    repo.archiveMember.mockRejectedValue(new Error("Cannot archive member 2"));

    const result = await archiveMemberAction(2);

    expect(result).toEqual({ status: "error", message: M.lastActiveMember });
    expect(revalidated.paths).toHaveLength(0);
  });

  it("reports a missing member", async () => {
    repo.getMemberById.mockResolvedValue(null);

    const result = await archiveMemberAction(2);

    expect(result).toEqual({ status: "error", message: M.memberMissing });
    expect(repo.archiveMember).not.toHaveBeenCalled();
  });

  it("is idempotent for an already archived member", async () => {
    repo.getMemberById.mockResolvedValue({ id: 2, name: "Mati", archived: true });

    const result = await archiveMemberAction(2);

    expect(result).toEqual({ status: "ok" });
    expect(repo.archiveMember).not.toHaveBeenCalled();
  });
});

describe("restoreMemberAction", () => {
  beforeEach(() => {
    repo.getMemberById.mockResolvedValue({ id: 2, name: "Mati", archived: true });
  });

  it("restores an archived member and revalidates every shell tab", async () => {
    const result = await restoreMemberAction(2);

    expect(result).toEqual({ status: "ok" });
    expect(repo.unarchiveMember).toHaveBeenCalledWith(2);
    expect(revalidated.paths).toEqual(SHELL_TABS);
  });

  it("is idempotent for an already active member", async () => {
    repo.getMemberById.mockResolvedValue({ id: 2, name: "Mati", archived: false });

    const result = await restoreMemberAction(2);

    expect(result).toEqual({ status: "ok" });
    expect(repo.unarchiveMember).not.toHaveBeenCalled();
  });

  it("maps a 23505 to memberRestoreNameTaken without revalidating", async () => {
    repo.unarchiveMember.mockRejectedValue(duplicateError());

    const result = await restoreMemberAction(2);

    expect(result).toEqual({ status: "error", message: M.memberRestoreNameTaken });
    expect(revalidated.paths).toHaveLength(0);
  });

  it("reports a missing member", async () => {
    repo.getMemberById.mockResolvedValue(null);

    const result = await restoreMemberAction(2);

    expect(result).toEqual({ status: "error", message: M.memberMissing });
  });

  it("maps a null update (row vanished) to restoreFailed", async () => {
    repo.unarchiveMember.mockResolvedValue(null);

    const result = await restoreMemberAction(2);

    expect(result).toEqual({ status: "error", message: M.restoreFailed });
    expect(revalidated.paths).toHaveLength(0);
  });
});
