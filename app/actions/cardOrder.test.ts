import { beforeEach, describe, expect, it, vi } from "vitest";

import { expiredSession, tamperedSession } from "@/app/actions/sessionFixtures";
import { UnauthorizedError } from "@/lib/auth/requireSession";
import { signSession } from "@/lib/auth/session";
import { VALIDATION_MESSAGES } from "@/lib/domain/messages";

const jar = vi.hoisted(() => ({
  session: undefined as string | undefined,
  set: [] as Array<{ name: string; value: string }>,
}));
const revalidated = vi.hoisted(() => ({ paths: [] as string[] }));
const repo = vi.hoisted(() => ({
  listActiveCategoriesByKind: vi.fn(),
  getStoredCardOrder: vi.fn(),
  replaceCardOrder: vi.fn(),
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
  listActiveCategoriesByKind: repo.listActiveCategoriesByKind,
}));
vi.mock("@/lib/db/repositories/cardOrder.repository", () => ({
  getStoredCardOrder: repo.getStoredCardOrder,
  replaceCardOrder: repo.replaceCardOrder,
}));

const { reorderCardsAction } = await import("@/app/actions/cardOrder");

const M = VALIDATION_MESSAGES;

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
  // Active expense categories: 1, 2, 3. Archived 9 still sits in the stored order.
  repo.listActiveCategoriesByKind.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
  repo.getStoredCardOrder.mockResolvedValue([1, 9, 2, 3]);
  repo.replaceCardOrder.mockResolvedValue(undefined);
});

describe("reorderCardsAction session", () => {
  it.each([
    ["absent", async () => undefined],
    ["tampered", tamperedSession],
    ["expired", expiredSession],
  ])("rejects a %s session before any side effect", async (_label, make) => {
    jar.session = await make();

    await expect(reorderCardsAction([2, 1])).rejects.toBeInstanceOf(UnauthorizedError);

    expectNoSideEffects();
  });
});

describe("reorderCardsAction validation", () => {
  it.each([
    ["a string", "1,2"],
    ["a mixed array", [1, "x"]],
    ["a negative id", [-1]],
    ["a fractional id", [1.5]],
    ["an object", {}],
    ["an empty list", []],
    ["10000 ids", Array.from({ length: 10_000 }, (_, i) => i + 1)],
  ])("rejects %s with no repository call", async (_label, input) => {
    const result = await reorderCardsAction(input);

    expect(result).toEqual({ status: "error", message: M.cardOrderSaveFailed });
    expectNoSideEffects();
  });

  it.each([
    ["an archived id", [9, 1]],
    ["an unknown id", [1, 77]],
    ["an income category id", [1, 5]],
  ])("rejects %s and never writes", async (_label, ids) => {
    const result = await reorderCardsAction(ids);

    expect(result.status).toBe("error");
    expect(repo.replaceCardOrder).not.toHaveBeenCalled();
    expect(revalidated.paths).toHaveLength(0);
  });
});

describe("reorderCardsAction write", () => {
  it("merges the visible order with the stored one, keeping the archived position", async () => {
    const result = await reorderCardsAction([3, 1, 2]);

    expect(result).toEqual({ status: "ok" });
    expect(repo.replaceCardOrder).toHaveBeenCalledTimes(1);
    expect(repo.replaceCardOrder).toHaveBeenCalledWith([3, 1, 2, 9]);
  });

  it("dedupes ids before merging", async () => {
    await reorderCardsAction([2, 2, 1, 1]);

    expect(repo.replaceCardOrder).toHaveBeenCalledWith([2, 1, 9, 3]);
  });

  it("skips the write when the merged order equals the stored one", async () => {
    repo.getStoredCardOrder.mockResolvedValue([1, 2, 3, 9]);

    const result = await reorderCardsAction([1, 2, 3]);

    expect(result).toEqual({ status: "ok" });
    expect(repo.replaceCardOrder).not.toHaveBeenCalled();
  });

  it("revalidates only /inicio on success", async () => {
    await reorderCardsAction([3, 2, 1]);

    expect(revalidated.paths).toEqual(["/inicio"]);
  });

  it("maps a failing write to the save-failed message without revalidating", async () => {
    repo.replaceCardOrder.mockRejectedValue(new Error("boom"));

    const result = await reorderCardsAction([3, 2, 1]);

    expect(result).toEqual({ status: "error", message: M.cardOrderSaveFailed });
    expect(revalidated.paths).toHaveLength(0);
  });
});
