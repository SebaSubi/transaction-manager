import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Archive read semantics, enforced at the SOURCE level.
 *
 * Every picker/list read of categories and members MUST filter
 * `archived_at IS NULL`; the label resolvers MUST NOT. Both halves matter and
 * they pull in opposite directions, which is exactly why a reader "tidying up"
 * the odd one out is a realistic future regression:
 *
 *  - drop the filter from a picker  -> archived rows become selectable again;
 *  - add the filter to a resolver   -> historical rows lose their label and an
 *                                      archive starts looking like data loss.
 *
 * This is a source-level check, not a query-execution check: no database exists
 * in this change (tasks 4.1-4.4 are blocked on the user), so the SQL cannot be
 * run. It is a regression guard on intent, and it says so rather than posing as
 * behavioural coverage.
 */

const REPOSITORY_DIR = path.resolve(__dirname);

type FilterExpectation =
  | "must-filter-archived"
  | "must-include-archived"
  | "must-only-archived"
  | "not-a-read";

const EXPECTATIONS: Record<string, Record<string, FilterExpectation>> = {
  "categories.repository.ts": {
    listActiveCategoriesByKind: "must-filter-archived",
    listActiveCategories: "must-filter-archived",
    resolveCategoryLabels: "must-include-archived",
    getCategoryById: "must-include-archived",
    createCategory: "not-a-read",
    archiveCategory: "must-filter-archived",
    renameCategory: "must-filter-archived",
    unarchiveCategory: "must-only-archived",
    listArchivedCategories: "must-only-archived",
  },
  "members.repository.ts": {
    listActiveMembers: "must-filter-archived",
    resolveMemberLabels: "must-include-archived",
    getMemberById: "must-include-archived",
    createMember: "not-a-read",
    archiveMember: "must-filter-archived",
    unarchiveMember: "must-only-archived",
    listArchivedMembers: "must-only-archived",
  },
};

/** Rewinds to the start of the `/** ... *\/` block directly above, if any. */
function withLeadingDocComment(source: string, declarationIndex: number): number {
  const before = source.slice(0, declarationIndex);
  const closes = before.lastIndexOf("*/");
  if (closes === -1) return declarationIndex;
  if (before.slice(closes + 2).trim() !== "") return declarationIndex;

  const opens = before.lastIndexOf("/**", closes);
  return opens === -1 ? declarationIndex : opens;
}

/**
 * Maps each exported function name to its declaration text, including the
 * doc comment immediately above it — the comment is part of what is asserted.
 */
function exportedFunctionBodies(source: string): Map<string, string> {
  const bodies = new Map<string, string>();
  const pattern = /export async function (\w+)\(/g;

  const starts: Array<{ name: string; index: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    starts.push({ name: match[1], index: withLeadingDocComment(source, match.index) });
  }

  starts.forEach(({ name, index }, position) => {
    const end = position + 1 < starts.length ? starts[position + 1].index : source.length;
    bodies.set(name, source.slice(index, end));
  });

  return bodies;
}

/**
 * Comments are stripped first: the resolvers NAME the forbidden call in their
 * own warning ("DO NOT ADD `isNull(...)`"). A raw substring scan would read
 * that warning as the very filter it warns against.
 */
function stripComments(body: string): string {
  return body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function filtersArchived(body: string): boolean {
  const code = stripComments(body);
  return /isNull\(\s*(?:categories|members)\.archivedAt\s*\)/.test(code);
}

/** `isNotNull(<table>.archivedAt)` present and no `isNull(...)` filter. */
function onlyArchived(body: string): boolean {
  const code = stripComments(body);
  return (
    /isNotNull\(\s*(?:categories|members)\.archivedAt\s*\)/.test(code) &&
    !/isNull\(/.test(code)
  );
}

describe.each(Object.entries(EXPECTATIONS))(
  "%s archive read semantics",
  (file, expectations) => {
    const source = readFileSync(path.join(REPOSITORY_DIR, file), "utf8");
    const bodies = exportedFunctionBodies(source);

    it("exports exactly the functions this table describes", () => {
      // Without this, a NEW read could be added and silently escape the table.
      expect([...bodies.keys()].sort()).toEqual(Object.keys(expectations).sort());
    });

    it.each(
      Object.entries(expectations).filter(
        ([, rule]) => rule === "must-filter-archived",
      ),
    )("%s filters archived rows", (name) => {
      expect(filtersArchived(bodies.get(name)!)).toBe(true);
    });

    it.each(
      Object.entries(expectations).filter(
        ([, rule]) => rule === "must-include-archived",
      ),
    )("%s deliberately does NOT filter archived rows", (name) => {
      const body = bodies.get(name)!;

      expect(filtersArchived(body)).toBe(false);
      // The comment is load-bearing: it is what stops the next reader from
      // "fixing" the missing filter.
      expect(body).toContain("DO NOT ADD");
      // The caller must be able to render it AS archived, not as a live row.
      expect(body).toMatch(/archived:\s*archivedAt !== null/);
    });

    it.each(
      Object.entries(expectations).filter(
        ([, rule]) => rule === "must-only-archived",
      ),
    )("%s only touches archived rows", (name) => {
      expect(onlyArchived(bodies.get(name)!)).toBe(true);
    });
  },
);
