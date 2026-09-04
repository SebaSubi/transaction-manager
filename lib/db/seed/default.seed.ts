import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { assertPooledNeonUrl } from "@/lib/db/pooledUrl";
import { categories, members } from "@/lib/db/schema";
import { SEED_CATEGORIES, SEED_MEMBERS } from "@/lib/db/seed/categories";
import { nextColorIndex } from "@/lib/domain/categories";

/**
 * Production content seed for `pnpm db:seed`: 21 categories (18 expense +
 * 3 income) and 2 household members. No transactions, no budgets — those are
 * the household's own data, and the prototype's fixtures are dev-only.
 *
 * IDEMPOTENT. Every insert carries `ON CONFLICT DO NOTHING`, so re-running it
 * against an already-seeded database is a no-op rather than a duplicate-key
 * failure. The arbiter is left implicit so Postgres uses whichever unique
 * index applies — here the PARTIAL `*_active_name_uq` indexes, which only
 * cover rows with `archived_at IS NULL`. A category the household archived on
 * purpose therefore stays archived instead of being silently resurrected.
 *
 * Standalone entrypoint (tsx, not the Next.js app): reads DATABASE_URL
 * directly and imports the pure validator rather than lib/db/client.ts, which
 * carries `server-only` and throws outside the Next.js bundler.
 */
async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }
  assertPooledNeonUrl(databaseUrl);

  const db = drizzle(neon(databaseUrl));

  const memberRows = SEED_MEMBERS.map((name) => ({ name }));
  // `color_index` follows the seed order so a category keeps its accent colour
  // across re-seeds; the CHECK constraint bounds it to 0..5, which is exactly
  // what nextColorIndex's modulo guarantees.
  const categoryRows = SEED_CATEGORIES.map((category, position) => ({
    ...category,
    colorIndex: nextColorIndex(position),
  }));

  await db.insert(members).values(memberRows).onConflictDoNothing();
  await db.insert(categories).values(categoryRows).onConflictDoNothing();

  console.log(
    `Seeded ${categoryRows.length} categories (` +
      `${categoryRows.filter((c) => c.kind === "expense").length} expense, ` +
      `${categoryRows.filter((c) => c.kind === "income").length} income) ` +
      `and ${memberRows.length} members.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
