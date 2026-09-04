import { describe, expect, it } from "vitest";

import {
  SEED_CATEGORIES,
  SEED_EXPENSE_CATEGORIES,
  SEED_INCOME_CATEGORIES,
  SEED_MEMBERS,
} from "@/lib/db/seed/categories";
import { ACCENT_CYCLE_LENGTH, nextColorIndex } from "@/lib/domain/categories";

/**
 * Proves the seed's SHAPE without a database. The row counts landing in
 * Postgres are still verified against the provisioned Neon branch (task 11.3),
 * but a miscounted fixture list is caught here, in `pnpm test`, instead of
 * after a migration.
 */
describe("default seed content", () => {
  it("contains exactly 21 categories", () => {
    expect(SEED_CATEGORIES).toHaveLength(21);
  });

  it("splits them 18 expense / 3 income", () => {
    expect(SEED_EXPENSE_CATEGORIES).toHaveLength(18);
    expect(SEED_INCOME_CATEGORIES).toHaveLength(3);
    expect(SEED_CATEGORIES.filter((c) => c.kind === "expense")).toHaveLength(18);
    expect(SEED_CATEGORIES.filter((c) => c.kind === "income")).toHaveLength(3);
  });

  it("names the three income categories exactly", () => {
    expect(SEED_INCOME_CATEGORIES.map((c) => c.name)).toEqual([
      "Sueldo",
      "Regalo",
      "Otro",
    ]);
  });

  it("contains exactly 2 members", () => {
    expect(SEED_MEMBERS).toHaveLength(2);
  });

  it("has no duplicate name within a kind, which the partial unique index forbids", () => {
    const keys = SEED_CATEGORIES.map((c) => `${c.kind}:${c.name}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(SEED_MEMBERS).size).toBe(SEED_MEMBERS.length);
  });

  it("gives every category a bundled lucide icon name", () => {
    for (const category of SEED_CATEGORIES) {
      expect(category.icon).toMatch(/^[a-z0-9-]+$/);
      // The prototype fetched icons from unpkg at render time; never again.
      expect(category.icon).not.toContain("http");
    }
  });

  it("assigns every colour index inside the CHECK (0..5) range", () => {
    for (const [position] of SEED_CATEGORIES.entries()) {
      const colorIndex = nextColorIndex(position);
      expect(colorIndex).toBeGreaterThanOrEqual(0);
      expect(colorIndex).toBeLessThan(ACCENT_CYCLE_LENGTH);
    }
  });
});
