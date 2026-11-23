import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const journal = JSON.parse(read("drizzle/meta/_journal.json")) as {
  entries: { tag: string; when: number }[];
};

describe("0001_amounts_to_cents", () => {
  const sql = read("drizzle/0001_amounts_to_cents.sql");

  it("is journaled right after 0000", () => {
    expect(journal.entries[1]?.tag).toBe("0001_amounts_to_cents");
  });

  it("widens every money column to bigint BEFORE multiplying by 100", () => {
    for (const column of [
      '"budgets" ALTER COLUMN "amount" SET DATA TYPE bigint',
      '"transactions" ALTER COLUMN "amount" SET DATA TYPE bigint',
      '"transactions" ALTER COLUMN "gross" SET DATA TYPE bigint',
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql.lastIndexOf("SET DATA TYPE")).toBeLessThan(sql.indexOf("UPDATE"));
    expect(sql).toContain('UPDATE "budgets" SET "amount" = "amount" * 100');
    expect(sql).toContain(
      'UPDATE "transactions" SET "amount" = "amount" * 100, "gross" = "gross" * 100',
    );
  });

  it("ships a non-journaled rollback that divides by 100 and re-arms the migration", () => {
    expect(journal.entries.some((entry) => entry.tag.includes("rollback"))).toBe(false);
    const rollback = read("drizzle/0001_rollback.sql");
    expect(rollback).toContain("ROUND(amount / 100.0)");
    expect(rollback).toContain("ROUND(gross / 100.0)");
    expect(rollback).toContain(
      `DELETE FROM drizzle.__drizzle_migrations WHERE created_at = ${journal.entries[1]?.when}`,
    );
  });
});

describe("0002_transaction_description", () => {
  const sql = read("drizzle/0002_transaction_description.sql");

  it("is journaled after 0001", () => {
    expect(journal.entries[2]?.tag).toBe("0002_transaction_description");
  });

  it("is exactly one nullable ADD COLUMN on transactions", () => {
    expect(sql.match(/ALTER TABLE/g)).toHaveLength(1);
    expect(sql).toContain('ALTER TABLE "transactions" ADD COLUMN "description" text');
    expect(sql).not.toMatch(/NOT NULL|DEFAULT|DROP/i);
  });

  it("ships a non-journaled rollback that drops only description", () => {
    const rollback = read("drizzle/0002_rollback.sql");
    expect(rollback).toContain("ALTER TABLE transactions DROP COLUMN IF EXISTS description");
    expect(rollback).toContain(
      `DELETE FROM drizzle.__drizzle_migrations WHERE created_at = ${journal.entries[2]?.when}`,
    );
  });
});
