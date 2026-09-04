/**
 * Pure connection-string validation, deliberately separate from
 * `lib/db/client.ts` (which carries `import 'server-only'` and the app's
 * full env validation). `lib/db/migrate.ts` (run via `tsx`, plain Node,
 * outside the Next.js bundler) and the Vitest suite both need this
 * assertion without pulling in `server-only` or unrelated env vars
 * (APP_PASSWORD, SESSION_SECRET) that a migration run has no use for.
 */

/**
 * Validates that `rawUrl` is a Neon pooled/HTTP connection string.
 *
 * 1. parses as a URL with protocol `postgres:` or `postgresql:`;
 * 2. hostname ends with `.neon.tech`;
 * 3. hostname contains `-pooler.` — Neon's pooled endpoints are
 *    `ep-*-pooler.<region>.aws.neon.tech` and direct endpoints are the same
 *    host WITHOUT `-pooler`, so this is the discriminator;
 * 4. query string carries `sslmode=require`.
 *
 * Throws an `Error` naming the offending host so a misconfigured deployment
 * fails loudly at the very first request instead of silently opening a
 * direct connection and exhausting the ~97-connection cap under load
 * (design §2, Connection Policy). There is no escape hatch: no
 * `ALLOW_DIRECT` flag.
 */
export function assertPooledNeonUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`DATABASE_URL is not a valid URL: "${rawUrl}"`);
  }

  const protocol = parsed.protocol.replace(/:$/, "");
  if (protocol !== "postgres" && protocol !== "postgresql") {
    throw new Error(
      `DATABASE_URL for host "${parsed.hostname}" must use the postgres:// or postgresql:// protocol, got "${parsed.protocol}"`,
    );
  }

  if (!parsed.hostname.endsWith(".neon.tech")) {
    throw new Error(
      `DATABASE_URL host "${parsed.hostname}" is not a Neon host (expected a hostname ending in ".neon.tech")`,
    );
  }

  if (!parsed.hostname.includes("-pooler.")) {
    throw new Error(
      `DATABASE_URL host "${parsed.hostname}" is a DIRECT Neon connection, not the pooled/HTTP endpoint. ` +
        `Use the pooled connection string (hostname must contain "-pooler.") to avoid exhausting the connection cap.`,
    );
  }

  if (parsed.searchParams.get("sslmode") !== "require") {
    throw new Error(
      `DATABASE_URL for host "${parsed.hostname}" is missing "sslmode=require"`,
    );
  }
}
