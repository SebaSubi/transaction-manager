import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
} from "@/lib/auth/session";

const jar = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "tm_session" && jar.value !== undefined
        ? { name, value: jar.value }
        : undefined,
  }),
}));

const { UnauthorizedError, assertSession } = await import(
  "@/lib/auth/requireSession"
);

async function expiredCookie(): Promise<string> {
  return signSession(Math.floor(Date.now() / 1000) - SESSION_MAX_AGE_SECONDS - 10);
}

async function tamperedCookie(): Promise<string> {
  const [payload, signature] = (await signSession()).split(".");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  decoded.exp += 60 * 60 * 24 * 365;
  const forged = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");
  return `${forged}.${signature}`;
}

beforeEach(() => {
  jar.value = undefined;
});

describe("assertSession", () => {
  it("uses the shared session cookie name", () => {
    expect(SESSION_COOKIE).toBe("tm_session");
  });

  it("resolves with a valid session cookie", async () => {
    jar.value = await signSession();
    await expect(assertSession()).resolves.toBeUndefined();
  });

  it("throws UnauthorizedError when the cookie is absent", async () => {
    await expect(assertSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws UnauthorizedError for a tampered signature", async () => {
    jar.value = await tamperedCookie();
    await expect(assertSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws UnauthorizedError for an expired session", async () => {
    jar.value = await expiredCookie();
    await expect(assertSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws UnauthorizedError for a malformed cookie", async () => {
    jar.value = "not-a-cookie";
    await expect(assertSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("performs no database access: the module imports no repository or db client", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("lib/auth/requireSession.ts", "utf8");
    expect(source).not.toMatch(/repositories|db\/client|drizzle/);
  });
});
