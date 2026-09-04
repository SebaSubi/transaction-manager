import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GENERIC_LOGIN_ERROR } from "@/lib/auth/loginState";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  verifySession,
} from "@/lib/auth/session";

interface RecordedCookie {
  name: string;
  value: string;
  options: Record<string, unknown>;
}

const cookieStore = vi.hoisted(() => ({ set: [] as RecordedCookie[] }));
const redirects = vi.hoisted(() => ({ to: [] as string[] }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (name: string, value: string, options: Record<string, unknown>) => {
      cookieStore.set.push({ name, value, options });
    },
  }),
}));

vi.mock("next/navigation", () => ({
  // The real `redirect` throws a control-flow signal; the shape that matters
  // here is only that it is reached, and with which path.
  redirect: (path: string) => {
    redirects.to.push(path);
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

const { login } = await import("@/app/actions/login");

/** Set by vitest.config.ts `test.env`, mirroring a configured deployment. */
const CORRECT_PASSWORD = "vitest-fixture-password";

function form(password: unknown, next?: string): FormData {
  const data = new FormData();
  if (typeof password === "string") data.set("password", password);
  if (next !== undefined) data.set("next", next);
  return data;
}

/** `redirect()` throws by design; a successful login always ends that way. */
async function submit(data: FormData) {
  try {
    return await login({ error: null }, data);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT:")) {
      return null;
    }
    throw error;
  }
}

function onlySetCookie(): RecordedCookie {
  expect(cookieStore.set).toHaveLength(1);
  return cookieStore.set[0];
}

beforeEach(() => {
  cookieStore.set = [];
  redirects.to = [];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("login: session cookie attributes", () => {
  it("sets httpOnly, secure and sameSite on the session cookie", async () => {
    await submit(form(CORRECT_PASSWORD));
    const cookie = onlySetCookie();

    expect(cookie.name).toBe(SESSION_COOKIE);
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.secure).toBe(true);
    expect(cookie.options.sameSite).toBe("lax");
  });

  it.each(["development", "test", "production"])(
    "keeps secure=true under NODE_ENV=%s",
    async (nodeEnv) => {
      // Regression guard: `secure` was once `NODE_ENV === 'production'`, which
      // silently violated the spec everywhere except production.
      vi.stubEnv("NODE_ENV", nodeEnv as "development" | "test" | "production");

      await submit(form(CORRECT_PASSWORD));

      expect(onlySetCookie().options.secure).toBe(true);
    },
  );

  it("scopes the cookie to the whole site for the session lifetime", async () => {
    await submit(form(CORRECT_PASSWORD));
    const cookie = onlySetCookie();

    expect(cookie.options.path).toBe("/");
    expect(cookie.options.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
  });

  it("stores a cookie value that verifies as a real session", async () => {
    await submit(form(CORRECT_PASSWORD));

    expect(await verifySession(onlySetCookie().value)).not.toBeNull();
  });
});

describe("login: outcomes", () => {
  it("redirects to the sanitized next path on success", async () => {
    await submit(form(CORRECT_PASSWORD, "/movimientos"));
    expect(redirects.to).toEqual(["/movimientos"]);
  });

  it("refuses an off-origin next path", async () => {
    await submit(form(CORRECT_PASSWORD, "https://evil.example/steal"));
    expect(redirects.to).toEqual(["/inicio"]);
  });

  it.each([
    ["a wrong password", "definitely-not-the-password"],
    ["a prefix of the password", CORRECT_PASSWORD.slice(0, -1)],
    ["an empty submission", ""],
    ["a missing field", undefined],
  ])("sets no cookie and does not redirect for %s", async (_case, password) => {
    const state = await submit(form(password));

    expect(state).toEqual({ error: GENERIC_LOGIN_ERROR });
    expect(cookieStore.set).toHaveLength(0);
    expect(redirects.to).toHaveLength(0);
  });

  it("fails closed when APP_PASSWORD is unset", async () => {
    vi.stubEnv("APP_PASSWORD", "");

    const state = await submit(form(""));

    expect(state).toEqual({ error: GENERIC_LOGIN_ERROR });
    expect(cookieStore.set).toHaveLength(0);
  });
});
