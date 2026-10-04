import { describe, expect, it } from "vitest";

import { resolveDefaultMemberId } from "@/lib/domain/members";

describe("resolveDefaultMemberId", () => {
  it("returns the cookie id when it is an active member", () => {
    expect(resolveDefaultMemberId("2", [1, 2, 3])).toBe(2);
  });

  it("falls back to the first active member when the cookie id is archived or missing", () => {
    expect(resolveDefaultMemberId("9", [1, 2, 3])).toBe(1);
  });

  it("falls back to the first active member when the cookie is absent", () => {
    expect(resolveDefaultMemberId(undefined, [4, 5])).toBe(4);
  });

  it.each(["abc", "", "1.5", "-1", "0", "2; DROP"])(
    "falls back to the first active member for the non-numeric cookie %j",
    (cookie) => {
      expect(resolveDefaultMemberId(cookie, [7, 8])).toBe(7);
    },
  );

  it("returns null when there are no active members", () => {
    expect(resolveDefaultMemberId("1", [])).toBeNull();
    expect(resolveDefaultMemberId(undefined, [])).toBeNull();
  });
});
