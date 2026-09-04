import { describe, expect, it } from "vitest";

import { passwordMatches } from "@/lib/auth/password";

describe("passwordMatches", () => {
  it("accepts the configured password", async () => {
    expect(await passwordMatches("correct horse", "correct horse")).toBe(true);
  });

  it.each([
    ["no shared prefix", "zzzzzzzzzzzzz"],
    ["long shared prefix", "correct hors_"],
    ["prefix of the real password", "correct"],
    ["superstring of the real password", "correct horse battery"],
    ["empty", ""],
  ])("denies a %s submission", async (_label, submitted) => {
    expect(await passwordMatches(submitted, "correct horse")).toBe(false);
  });

  it("compares fixed-width digests, so length never short-circuits", async () => {
    // Both operands hash to 32 bytes before comparison; a one-character
    // submission and a 10 000-character one take the same comparison path.
    expect(await passwordMatches("a", "correct horse")).toBe(false);
    expect(await passwordMatches("a".repeat(10_000), "correct horse")).toBe(false);
  });
});
