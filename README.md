# Transaction Manager

A household finance app: transactions, monthly budgets, and balances for a shared household, behind a single shared password.

**Stack:** Next.js 16 (App Router) · React 19 · Drizzle ORM · Neon Postgres · Vitest · pnpm · Vercel

## Status

This is **change 1 of 3** (`port-foundation`). What works today:

- Shared-password login with signed session cookies
- The app shell: bottom navigation, four tabs, light/dark theme with no flash
- Database schema, migrations, and default seed
- The domain rules (money, balance, budget, categories, months), fully unit-tested

Not built yet: the screens' content and every way to create or edit data.

| Change | Adds |
|---|---|
| 2 | Transactions and budgets UI, Server Actions to create/edit them |
| 3 | Drag-to-reorder cards, archive controls in Perfil |

Plans live in `openspec/changes/`.

## Local setup

Requirements: Node 20.6+ and pnpm (`corepack enable`).

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm dev                     # http://localhost:3000
```

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon **pooled** string: host contains `-pooler.`, ends with `.neon.tech`, has `sslmode=require` |
| `APP_PASSWORD` | yes | The shared login password |
| `SESSION_SECRET` | yes | At least 32 bytes: `openssl rand -base64 32` |
| `DEV_SEED_ALLOWED_HOST` | only for `db:seed:dev` | Exact hostname of the Neon branch to fill with fake data |

Do **not** set `TZ` yourself. The scripts set `TZ=UTC`, and Vercel reserves the name.

## Database

The `db:*` scripts run outside Next.js, so they do **not** read `.env.local` on their own. Pass it explicitly:

```bash
pnpm exec tsx --env-file=.env.local lib/db/migrate.ts            # apply migrations
pnpm exec tsx --env-file=.env.local lib/db/seed/default.seed.ts  # default members and categories
pnpm db:generate                                                 # new migration after editing lib/db/schema.ts
```

Migrations are **expand-contract only** once real data exists: add columns or tables, backfill, and only then remove old ones in a later migration.

## Checks

```bash
pnpm test      # Vitest
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

## Deploying to Vercel

1. **Import the repo:** on vercel.com, choose Add New → Project and pick this GitHub repo. Vercel detects Next.js and pnpm on its own.
2. **Add the database:** in the project's Storage tab, connect **Neon** from the Marketplace (free tier). It creates `DATABASE_URL` for you. Make sure the value is the pooled one (its host contains `-pooler.`).
3. **Add the other variables** under Settings → Environment Variables: `APP_PASSWORD` and `SESSION_SECRET`.
4. **Migrate and seed once from your machine.** Copy the same `DATABASE_URL` into `.env.local` and run the two commands from [Database](#database).
5. **Deploy:** redeploy from the Deployments tab, or push to `main`. Every push redeploys.
6. **Check the live site:** a logged-out visit goes to `/login`, a wrong password is rejected, the right one works, all four tabs open, and the theme does not flash.
