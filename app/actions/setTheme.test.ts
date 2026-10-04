import { beforeEach, describe, expect, it, vi } from "vitest";

import { expiredSession, tamperedSession } from "@/app/actions/sessionFixtures";
import { UnauthorizedError } from "@/lib/auth/requireSession";
import { signSession } from "@/lib/auth/session";

const jar = vi.hoisted(() => ({
  session: undefined as string | undefined,
  set: [] as Array<{ name: string; value: string }>,
}));
const revalidated = vi.hoisted(() => ({ paths: [] as string[] }));

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

const { setTheme } = await import("@/app/actions/setTheme");

beforeEach(async () => {
  jar.session = await signSession();
  jar.set = [];
  revalidated.paths = [];
});

describe("setTheme", () => {
  it.each([
    ["absent", async () => undefined],
    ["tampered", tamperedSession],
    ["expired", expiredSession],
  ])("rejects a %s session with no cookie write and no revalidation", async (_label, make) => {
    jar.session = await make();

    await expect(setTheme("dark")).rejects.toBeInstanceOf(UnauthorizedError);

    expect(jar.set).toHaveLength(0);
    expect(revalidated.paths).toHaveLength(0);
  });

  it("checks the session before validating the value", async () => {
    jar.session = undefined;
    await expect(setTheme("neon")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it.each(["dark", "light", "system"])("writes the %s preference", async (value) => {
    await setTheme(value);

    expect(jar.set).toEqual([{ name: "tm_theme", value }]);
    expect(revalidated.paths).toHaveLength(0);
  });

  it("rejects an invalid value without writing", async () => {
    await expect(setTheme("neon")).rejects.toThrow();
    expect(jar.set).toHaveLength(0);
  });
});
