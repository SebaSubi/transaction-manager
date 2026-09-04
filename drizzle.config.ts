import { defineConfig } from "drizzle-kit";

// Reads DATABASE_URL directly from process.env rather than lib/env.ts: this
// file runs under drizzle-kit's own CLI process (db:generate/db:migrate),
// not the Next.js app, and must not pull in `server-only` or the app's
// runtime env-validation module-scope side effects.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
});
