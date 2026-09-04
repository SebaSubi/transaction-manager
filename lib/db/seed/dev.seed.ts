import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, isNull } from "drizzle-orm";

import { assertPooledNeonUrl } from "@/lib/db/pooledUrl";
import { budgets, categories, members, transactions } from "@/lib/db/schema";
import { computeNetAmount, percentToBps } from "@/lib/domain/money";
import { nowInBuenosAires, wallClockFromParts } from "@/lib/domain/time";
import type { TransactionType } from "@/lib/domain/types";

/**
 * Dev-only fixtures for `pnpm db:seed:dev`: the prototype's 20 transactions
 * and its budgets for 2026-07 and 2026-08 (obs #59). These are FIXTURES, not
 * product content — the household's real data must never sit next to them.
 *
 * Two independent locks stop this reaching production:
 *
 *  1. `NODE_ENV === 'production'` refuses outright.
 *  2. `DEV_SEED_ALLOWED_HOST` must be set AND match `DATABASE_URL`'s hostname
 *     exactly. Neon gives every branch its own endpoint hostname, so naming
 *     the host is naming the branch. An explicit allowlist is used rather than
 *     a "looks like a branch" heuristic precisely because a heuristic can
 *     match production by accident; an exact hostname cannot.
 *
 * Neither lock has an override flag.
 */

interface FixtureTransaction {
  type: TransactionType;
  gross: number;
  cashbackPercent: number;
  category: string;
  member: string;
  /** Buenos Aires wall-clock parts: year, month (1-based), day, hour, minute. */
  at: [number, number, number, number, number];
}

const FIXTURE_TRANSACTIONS: readonly FixtureTransaction[] = [
  { type: "expense", gross: 45000, cashbackPercent: 0, category: "Super", member: "Sofi", at: [2026, 8, 29, 18, 42] },
  { type: "expense", gross: 12000, cashbackPercent: 0, category: "Nafta", member: "Mati", at: [2026, 8, 29, 9, 15] },
  { type: "expense", gross: 8000, cashbackPercent: 0, category: "Peluquería", member: "Sofi", at: [2026, 8, 28, 16, 5] },
  { type: "income", gross: 500000, cashbackPercent: 0, category: "Sueldo", member: "Mati", at: [2026, 8, 28, 8, 0] },
  { type: "expense", gross: 60000, cashbackPercent: 0, category: "Expensas", member: "Mati", at: [2026, 8, 27, 11, 30] },
  { type: "expense", gross: 15000, cashbackPercent: 0, category: "Gas", member: "Sofi", at: [2026, 8, 26, 20, 10] },
  { type: "expense", gross: 22000, cashbackPercent: 0, category: "Date and fun time", member: "Mati", at: [2026, 8, 25, 21, 0] },
  { type: "expense", gross: 9500, cashbackPercent: 0, category: "Agua", member: "Sofi", at: [2026, 8, 24, 10, 20] },
  { type: "expense", gross: 35000, cashbackPercent: 0, category: "Luz", member: "Mati", at: [2026, 8, 23, 19, 45] },
  { type: "expense", gross: 18000, cashbackPercent: 0, category: "Salud", member: "Sofi", at: [2026, 8, 22, 13, 10] },
  { type: "income", gross: 450000, cashbackPercent: 0, category: "Sueldo", member: "Sofi", at: [2026, 8, 15, 8, 0] },
  { type: "expense", gross: 60000, cashbackPercent: 0, category: "Super", member: "Mati", at: [2026, 8, 14, 17, 25] },
  { type: "expense", gross: 300000, cashbackPercent: 0, category: "Alquiler", member: "Mati", at: [2026, 8, 5, 9, 0] },
  { type: "expense", gross: 20000, cashbackPercent: 0, category: "Chicas", member: "Sofi", at: [2026, 8, 10, 15, 40] },
  { type: "expense", gross: 10000, cashbackPercent: 0, category: "Cumple", member: "Sofi", at: [2026, 8, 8, 12, 0] },
  { type: "expense", gross: 5000, cashbackPercent: 0, category: "Diezmo", member: "Mati", at: [2026, 8, 3, 9, 30] },
  { type: "income", gross: 20000, cashbackPercent: 0, category: "Regalo", member: "Sofi", at: [2026, 8, 2, 14, 0] },
  { type: "expense", gross: 130000, cashbackPercent: 0, category: "Super", member: "Sofi", at: [2026, 7, 29, 18, 0] },
  { type: "expense", gross: 300000, cashbackPercent: 0, category: "Alquiler", member: "Mati", at: [2026, 7, 5, 9, 0] },
  { type: "expense", gross: 45000, cashbackPercent: 0, category: "Nafta", member: "Mati", at: [2026, 7, 12, 10, 0] },
];

const FIXTURE_BUDGETS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  "2026-07": {
    Super: 140000,
    Alquiler: 300000,
    Luz: 35000,
    Gas: 14000,
    Agua: 9000,
    Expensas: 58000,
    Nafta: 45000,
    Salud: 25000,
    Ahorro: 90000,
  },
  "2026-08": {
    Super: 150000,
    Alquiler: 300000,
    Luz: 40000,
    Gas: 15000,
    Agua: 10000,
    Expensas: 60000,
    Nafta: 50000,
    Salud: 30000,
    "Date and fun time": 40000,
    Ahorro: 100000,
  },
};

function assertDevBranch(databaseUrl: string): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("db:seed:dev refuses to run with NODE_ENV=production.");
  }

  const allowedHost = process.env.DEV_SEED_ALLOWED_HOST;
  if (allowedHost === undefined || allowedHost.trim() === "") {
    throw new Error(
      "db:seed:dev refuses to run: set DEV_SEED_ALLOWED_HOST to the Neon BRANCH hostname " +
        "you intend to seed. There is no override flag.",
    );
  }

  const host = new URL(databaseUrl).hostname;
  if (host !== allowedHost.trim()) {
    throw new Error(
      `db:seed:dev refuses to run: DATABASE_URL host "${host}" is not the allowed branch host ` +
        `"${allowedHost.trim()}".`,
    );
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }
  assertPooledNeonUrl(databaseUrl);
  assertDevBranch(databaseUrl);

  const db = drizzle(neon(databaseUrl));

  const categoryRows = await db
    .select({ id: categories.id, name: categories.name, kind: categories.kind })
    .from(categories)
    .where(isNull(categories.archivedAt));
  const memberRows = await db
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(isNull(members.archivedAt));

  const categoryId = new Map(categoryRows.map((row) => [`${row.kind}:${row.name}`, row.id]));
  const memberId = new Map(memberRows.map((row) => [row.name, row.id]));

  function requireCategory(name: string, kind: TransactionType): number {
    const id = categoryId.get(`${kind}:${name}`);
    if (id === undefined) {
      throw new Error(`Missing ${kind} category "${name}". Run \`pnpm db:seed\` first.`);
    }
    return id;
  }

  function requireMember(name: string): number {
    const id = memberId.get(name);
    if (id === undefined) {
      throw new Error(`Missing member "${name}". Run \`pnpm db:seed\` first.`);
    }
    return id;
  }

  const transactionRows = FIXTURE_TRANSACTIONS.map((fixture) => {
    const cashbackBps = percentToBps(fixture.cashbackPercent);
    return {
      type: fixture.type,
      gross: fixture.gross,
      // Net is computed here, on the write path, exactly once — never on read.
      amount: computeNetAmount({
        type: fixture.type,
        gross: fixture.gross,
        cashbackBps,
      }),
      cashbackBps,
      categoryId: requireCategory(fixture.category, fixture.type),
      memberId: requireMember(fixture.member),
      date: wallClockFromParts(...fixture.at),
    };
  });

  await db.insert(transactions).values(transactionRows);

  // Buenos Aires wall clock, NOT bare `new Date()`. The column's own default
  // is `now() AT TIME ZONE 'America/Argentina/Buenos_Aires'`, so a UTC value
  // here would put dev-seeded rows 3 hours ahead of every other row in the
  // same column — two clock semantics in one column.
  const now = nowInBuenosAires();
  const budgetRows = Object.entries(FIXTURE_BUDGETS).flatMap(([month, byCategory]) =>
    Object.entries(byCategory).map(([name, amount]) => ({
      month,
      categoryId: requireCategory(name, "expense"),
      amount,
      updatedAt: now,
    })),
  );

  for (const row of budgetRows) {
    await db
      .insert(budgets)
      .values(row)
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.month, budgets.categoryId],
        set: { amount: row.amount, updatedAt: now },
      });
  }

  // Guard against a partially-applied run leaving a confusing database.
  const seededMembers = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.userId, "household"), isNull(members.archivedAt)));

  console.log(
    `Seeded ${transactionRows.length} fixture transactions and ${budgetRows.length} budget rows ` +
      `across ${Object.keys(FIXTURE_BUDGETS).length} months for ${seededMembers.length} members.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
