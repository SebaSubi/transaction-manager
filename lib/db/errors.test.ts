import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CATEGORIES_ACTIVE_NAME_UQ,
  MEMBERS_ACTIVE_NAME_UQ,
  UNIQUE_VIOLATION,
  isUniqueViolation,
} from "@/lib/db/errors";

describe("isUniqueViolation", () => {
  it("matches a direct { code, constraint } error", () => {
    const error = { code: UNIQUE_VIOLATION, constraint: MEMBERS_ACTIVE_NAME_UQ };
    expect(isUniqueViolation(error, MEMBERS_ACTIVE_NAME_UQ)).toBe(true);
  });

  it("matches a DrizzleQueryError-shaped error through its cause", () => {
    const error = Object.assign(new Error("Failed query"), {
      cause: { code: UNIQUE_VIOLATION, constraint: CATEGORIES_ACTIVE_NAME_UQ },
    });
    expect(isUniqueViolation(error, CATEGORIES_ACTIVE_NAME_UQ)).toBe(true);
  });

  it("matches a cause nested several hops deep", () => {
    const error = {
      cause: { cause: { code: UNIQUE_VIOLATION, constraint: MEMBERS_ACTIVE_NAME_UQ } },
    };
    expect(isUniqueViolation(error, MEMBERS_ACTIVE_NAME_UQ)).toBe(true);
  });

  it("is false for a different constraint", () => {
    const error = { code: UNIQUE_VIOLATION, constraint: "budgets_month_category_uq" };
    expect(isUniqueViolation(error, MEMBERS_ACTIVE_NAME_UQ)).toBe(false);
  });

  it("is false for a different SQLSTATE", () => {
    const error = { code: "23503", constraint: MEMBERS_ACTIVE_NAME_UQ };
    expect(isUniqueViolation(error, MEMBERS_ACTIVE_NAME_UQ)).toBe(false);
  });

  it.each([null, undefined, "23505", 23505, true])(
    "is false for the non-object %s",
    (value) => {
      expect(isUniqueViolation(value, MEMBERS_ACTIVE_NAME_UQ)).toBe(false);
    },
  );

  it("terminates on a cyclic cause chain", () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(isUniqueViolation(error, MEMBERS_ACTIVE_NAME_UQ)).toBe(false);
  });
});

describe("constraint names", () => {
  const schema = readFileSync(
    path.resolve(__dirname, "schema.ts"),
    "utf8",
  );

  it.each([MEMBERS_ACTIVE_NAME_UQ, CATEGORIES_ACTIVE_NAME_UQ])(
    "%s exists in the schema",
    (name) => {
      expect(schema).toContain(`"${name}"`);
    },
  );
});
