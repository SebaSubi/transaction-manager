import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Source-level guard for `copyMissingBudgets` (same technique as
 * `archiveReads.test.ts`; no database exists to execute the SQL against).
 *
 * The copy is "fill missing": the pure domain plans, the repository inserts
 * exactly that plan in ONE multi-row statement and skips conflicts. It must
 * never overwrite, remove or re-derive rows outside the plan.
 */

const source = readFileSync(path.resolve(__dirname, "budgets.repository.ts"), "utf8");

function functionBody(name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  if (start === -1) return "";
  const next = source.indexOf("export async function ", start + 1);
  const raw = source.slice(start, next === -1 ? source.length : next);
  // Strip comments: prose may NAME a forbidden call while explaining why.
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("copyMissingBudgets source guard", () => {
  const body = functionBody("copyMissingBudgets");

  it("exists", () => {
    expect(body).not.toBe("");
  });

  it("inserts the plan in one statement with .values(", () => {
    expect(body).toContain(".values(");
  });

  it("skips conflicts on the budgets_month_category_uq target", () => {
    expect(body).toContain("onConflictDoNothing");
    expect(body).toMatch(
      /target:\s*\[\s*budgets\.userId,\s*budgets\.month,\s*budgets\.categoryId\s*\]/,
    );
  });

  it("returns the inserted rows with .returning(", () => {
    expect(body).toContain(".returning(");
  });

  it.each(["onConflictDoUpdate", ".update(", ".delete(", ".select("])(
    "never calls %s",
    (forbidden) => {
      expect(body).not.toContain(forbidden);
    },
  );
});
