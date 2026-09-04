import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Enforcement layer 3 of the import-direction rule (design §4).
 *
 * Layer 1 is `import 'server-only'` in lib/db/client.ts (fails `pnpm build`).
 * Layer 2 is the per-directory `no-restricted-imports` zones in
 * eslint.config.mjs. This layer runs inside `pnpm test`, where a reviewer sees
 * it fail, and is what discharges the proposal's success criterion.
 */

const DOMAIN_DIR = path.resolve(__dirname);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** Exact module specifiers `lib/domain/` may never import. */
const FORBIDDEN_EXACT = new Set([
  "react",
  "react-dom",
  "next",
  "server-only",
  "drizzle-orm",
]);

/** Specifier prefixes `lib/domain/` may never import. */
const FORBIDDEN_PREFIXES = [
  "next/",
  "drizzle-orm/",
  "@neondatabase/",
  "@/lib/db",
  "@/components",
  "@/app",
];

/**
 * Removes block and line comments so prose that merely NAMES a forbidden
 * module is not mistaken for an import of it. The domain modules and this file
 * both discuss React, Next and `server-only` in their comments.
 *
 * Known limitation: a `//` inside a string literal is also treated as a comment
 * start. No source file under lib/domain/ contains one, and the consequence
 * would be a dropped specifier in an already-forbidden-free region, never a
 * missed violation in an import statement.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

/**
 * Extracts module specifiers from static imports, re-exports, dynamic
 * `import()` and `require()`.
 *
 * Deliberately statement-scoped rather than a raw substring search: a substring
 * scan would report identifiers and prose as violations while proving nothing
 * about the actual dependency graph.
 */
function moduleSpecifiersOf(rawSource: string): string[] {
  const source = stripComments(rawSource);
  const patterns = [
    /\bimport\s+[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bexport\s+[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  const specifiers: string[] = [];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function isForbidden(specifier: string): boolean {
  return (
    FORBIDDEN_EXACT.has(specifier) ||
    FORBIDDEN_PREFIXES.some((prefix) => specifier.startsWith(prefix))
  );
}

function forbiddenImportsIn(source: string): string[] {
  return moduleSpecifiersOf(source).filter(isForbidden);
}

function domainSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...domainSourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files.sort();
}

const DOMAIN_FILES = domainSourceFiles(DOMAIN_DIR);

describe("import-direction rule: lib/domain/ is pure", () => {
  it("finds domain source files to scan", () => {
    // Guards against a silently-passing suite if the directory ever moves.
    expect(DOMAIN_FILES.length).toBeGreaterThanOrEqual(10);
  });

  it.each(DOMAIN_FILES.map((file) => [path.relative(REPO_ROOT, file), file]))(
    "%s imports nothing forbidden",
    (_relative, file) => {
      expect(forbiddenImportsIn(readFileSync(file, "utf8"))).toEqual([]);
    },
  );

  it("detects every violation in the negative-control fixture", () => {
    const fixture = path.resolve(
      REPO_ROOT,
      "test/fixtures/domain-import-violation.ts.txt",
    );
    expect(forbiddenImportsIn(readFileSync(fixture, "utf8")).sort()).toEqual([
      "@/lib/db/client",
      "@/lib/db/schema",
      "@neondatabase/serverless",
      "react",
    ]);
  });

  it.each([
    "react",
    "react-dom",
    "next",
    "next/navigation",
    "server-only",
    "drizzle-orm",
    "drizzle-orm/neon-http",
    "@neondatabase/serverless",
    "@/lib/db/client",
    "@/components/ui/Button",
    "@/app/actions/login",
  ])("classifies %s as forbidden", (specifier) => {
    expect(isForbidden(specifier)).toBe(true);
  });

  it.each(["node:crypto", "@/lib/domain/types", "./types", "vitest"])(
    "classifies %s as allowed",
    (specifier) => {
      expect(isForbidden(specifier)).toBe(false);
    },
  );
});
