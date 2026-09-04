import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

// Standalone entrypoint for `pnpm db:migrate` (tsx, not the Next.js app), so
// it reads DATABASE_URL directly rather than importing lib/env.ts (which
// also requires APP_PASSWORD/SESSION_SECRET, irrelevant to a migration run)
// and imports the pure validator directly to avoid pulling in `server-only`
// (lib/db/client.ts), which throws outside the Next.js bundler.
import { assertPooledNeonUrl } from "@/lib/db/pooledUrl";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }
  assertPooledNeonUrl(databaseUrl);

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  console.log("Applying pending migrations from ./drizzle ...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
