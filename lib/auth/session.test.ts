import { describe, expect, it } from "vitest";

import {
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifySession,
} from "@/lib/auth/session";

const NOW = 1_800_000_000;

function tamperPayload(cookie: string): string {
  const [payload, signature] = cookie.split(".");
  const decoded = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as Record<string, number>;
  // Extend the session by a year while keeping the original signature.
  decoded.exp += 60 * 60 * 24 * 365;
  const forged = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");
  return `${forged}.${signature}`;
}

describe("signSession / verifySession", () => {
  it("accepts a freshly signed cookie", async () => {
    const cookie = await signSession(NOW);
    const payload = await verifySession(cookie, NOW);

    expect(payload).not.toBeNull();
    expect(payload?.iat).toBe(NOW);
    expect(payload?.exp).toBe(NOW + SESSION_MAX_AGE_SECONDS);
  });

  it("rejects a tampered payload that keeps the original signature", async () => {
    const forged = tamperPayload(await signSession(NOW));
    expect(await verifySession(forged, NOW)).toBeNull();
  });

  it("rejects an expired cookie even though its signature is valid", async () => {
    const cookie = await signSession(NOW);
    const afterExpiry = NOW + SESSION_MAX_AGE_SECONDS + 1;

    expect(await verifySession(cookie, NOW + 1)).not.toBeNull();
    expect(await verifySession(cookie, afterExpiry)).toBeNull();
  });

  it("rejects a cookie exactly at its expiry instant", async () => {
    const cookie = await signSession(NOW);
    expect(await verifySession(cookie, NOW + SESSION_MAX_AGE_SECONDS)).toBeNull();
  });

  it.each([
    ["absent", undefined],
    ["null", null],
    ["empty", ""],
    ["no separator", "notacookie"],
    ["payload only", "eyJ2IjoxfQ."],
    ["signature only", ".c2ln"],
    ["unsigned", "eyJ2IjoxLCJpYXQiOjAsImV4cCI6OTk5OTk5OTk5OX0"],
    ["garbage signature", "eyJ2IjoxLCJpYXQiOjAsImV4cCI6OTk5OTk5OTk5OX0.bm90YXNpZw"],
  ])("rejects a %s cookie", async (_label, cookie) => {
    expect(await verifySession(cookie, NOW)).toBeNull();
  });

  it("rejects a cookie signed with a different secret", async () => {
    const original = process.env.SESSION_SECRET;
    const cookie = await signSession(NOW);
    process.env.SESSION_SECRET = "a-completely-different-secret-of-32-bytes";
    try {
      expect(await verifySession(cookie, NOW)).toBeNull();
    } finally {
      process.env.SESSION_SECRET = original;
    }
  });

  it("fails closed when SESSION_SECRET is unset", async () => {
    const original = process.env.SESSION_SECRET;
    const previouslyValid = await signSession(NOW);
    delete process.env.SESSION_SECRET;
    try {
      await expect(signSession(NOW)).rejects.toThrow(/SESSION_SECRET/);

      // Deny, never admit: throwing and returning null are both closed;
      // returning a payload would be failing OPEN.
      const outcome = await verifySession(previouslyValid, NOW).catch(
        (error: unknown) => error,
      );
      expect(outcome === null || outcome instanceof Error).toBe(true);
    } finally {
      process.env.SESSION_SECRET = original;
    }
  });
});
