import { describe, expect, it } from "vitest";

import { VALIDATION_MESSAGES as M } from "@/lib/domain/messages";
import { checkManagedCategory, checkMemberArchivable } from "@/lib/domain/settings";

describe("checkManagedCategory", () => {
  it("rejects a missing category", () => {
    expect(checkManagedCategory(null, "any")).toBe(M.categoryMissing);
  });

  it("rejects income categories", () => {
    expect(checkManagedCategory({ kind: "income", archived: false }, "any")).toBe(
      M.categoryNotManaged,
    );
  });

  it("rejects an archived category only when active is needed", () => {
    expect(checkManagedCategory({ kind: "expense", archived: true }, "active")).toBe(
      M.categoryUnavailable,
    );
    expect(checkManagedCategory({ kind: "expense", archived: true }, "any")).toBeNull();
  });

  it("accepts an active expense category", () => {
    expect(checkManagedCategory({ kind: "expense", archived: false }, "active")).toBeNull();
  });
});

describe("checkMemberArchivable", () => {
  it("archives an active member when others remain", () => {
    expect(checkMemberArchivable({ archived: false }, 2)).toBe("archive");
  });

  it("is a noop for an already archived member", () => {
    expect(checkMemberArchivable({ archived: true }, 1)).toBe("noop");
  });

  it("rejects a missing member", () => {
    expect(checkMemberArchivable(null, 2)).toBe(M.memberMissing);
  });

  it("rejects archiving the last active member", () => {
    expect(checkMemberArchivable({ archived: false }, 1)).toBe(M.lastActiveMember);
    expect(checkMemberArchivable({ archived: false }, 0)).toBe(M.lastActiveMember);
  });
});
