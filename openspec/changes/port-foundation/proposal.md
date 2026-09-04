# Proposal: Port Foundation — Persistence, Auth, Domain Core, and App Shell

## Intent

The product exists only as `docs/design/transaction-manager.dc.html`: an in-memory prototype with
no persistence, no auth, no build tooling. Two people cannot actually use it — a refresh loses
everything. This change lays the production floor the whole port stands on — database, auth gate,
navigable shell, and the pure domain rules extracted from the prototype's `renderVals()` — so both
remaining screen slices are thin presentational work on top of a tested core rather than one
untestable big-bang deploy.

## Delivery decision — three changes, not one oversized change

**Decided: option (b), a sequence — sliced into THREE changes (user decision, 2026-09-01).** The
complete port is roughly 3,000–4,000 changed lines against a `review_budget_lines: 800` budget. A
`size:exception` is the wrong call here, and not because of reviewer load (the developer is solo):

- **`sdd-apply` context is the binding limit.** A single change of this size cannot be
  implemented, verified, and reviewed inside one working session without quality decay.
- **Deploy risk.** Neon connection mode, Vercel env wiring, and the middleware gate either work or
  they do not. Proving them on a slice that deploys is strictly cheaper than debugging them buried
  inside 4,000 lines of simultaneously-new UI.
- **Rollback granularity.** Once real household data exists (change 2 onward), migrations must be
  additive. Squashing the schema into the same change as every screen destroys the ability to
  revert a screen without touching the database.

Each slice deliberately runs over the 800-line budget (~1,000–1,300 lines) because the user
rejected finer slicing as excessive ceremony for a solo personal app. That tradeoff is accepted:
the binding constraint is apply-phase context, which each slice still fits, not reviewer load.
`sdd-tasks` MUST still forecast per-slice size and flag the overage.

**This proposal covers change 1 (`port-foundation`) ONLY.** Changes 2 and 3 below are follow-ups,
each requiring its own SDD cycle.

| # | Change | Scope | Est. lines | Depends on |
|---|--------|-------|-----------|-----------|
| 1 | `port-foundation` | **This change.** Tooling, Neon/Drizzle schema + first migration, default seed, shared-password middleware, 430px shell, bottom nav + FAB, theming, **and the domain core** (`lib/domain/` pure functions + `lib/db/repositories/` + Vitest harness) | ~1,150 | — |
| 2 | `port-ledger` | "Movimientos" (filters, 3-state sort, list) + "Presupuesto" (per-month budgets, "Copiar presupuesto de {mes}", add/remove category rows) + the shared add/edit bottom sheet with cashback | ~1,300 | 1 |
| 3 | `port-dashboard` | "Inicio" (balance card, category grid, drag-to-reorder via dnd-kit, recent movements) + "Perfil" (theme switch, members, categories, archive controls) | ~1,000 | 2 |

Ordering rationale: `port-ledger` comes before `port-dashboard` because "Inicio" renders balances
and per-category budget progress derived from transactions and budgets, so the write paths that
produce that data must exist first. "Perfil" rides with `port-dashboard` because its archive
controls are the UI surface of the deletion policy resolved below.

## Scope

### In Scope
- Next.js App Router + React + TypeScript project scaffolding via **pnpm only**; `lucide-react`
  bundled (never the design's per-icon unpkg fetch).
- Drizzle schema (`lib/db/schema.ts`) + first `drizzle-kit` migration: members, categories,
  transactions, budgets, `card_order`, including `archived_at` on categories and members.
- Neon client via `drizzle-orm/neon-http` — **pooled/HTTP connection string only**, never direct.
- Shared-password `proxy.ts` gate over all app routes, with signed httpOnly session cookie.
- 430px mobile shell, bottom nav with the four tabs "Inicio", "Presupuesto", "Movimientos",
  "Perfil" plus the center FAB, and empty placeholder screens for each.
- Theme (dark/light/system) read from a cookie during Server Component render (no theme flash).
- Default content seed: 21 category rows (18 `kind = 'expense'` + 3 `kind = 'income'`) and 2
  household members.
- **Domain core** — `lib/domain/`, pure TypeScript with no React and no DB imports, ported from
  the prototype's `renderVals()`: `computeNetAmount` (cashback, expenses only, `max(0, …)`),
  `spentForCategory`, `totalBalance` (all transactions ever, not just the selected month),
  `budgetProgress` (bar capped at 100%, label uncapped, over-budget colour switch), `monthKey`
  helpers (`monthKeyLabel`, `prevMonthKey`, half-open month range), `nowInBuenosAires`,
  `filterTransactions`, `sortTransactions` (3-state cycle), `orderCategories`, `categoryColor`
  (accent cycle, separate dark-mode cycle), `greeting`.
- **Persistence adapters** — `lib/db/repositories/` (transactions, budgets, categories, members,
  card order) as the hexagonal port/adapter boundary over Drizzle.
- **Vitest harness** — `pnpm test` wired, with unit tests covering every `lib/domain/` function.

### Out of Scope
- Any screen content, transaction/budget CRUD, filters, sorting UI, or the add/edit bottom sheet
  (changes 2 and 3) — the domain functions that will back them ship here, their UI does not.
- Server Actions and `useOptimistic` write paths (change 2).
- Drag-to-reorder interaction and dnd-kit (change 3).
- Archive controls in "Perfil" (change 3) — the `archived_at` columns and the repository filtering
  ship here, the UI does not.
- Per-user login, password reset, multi-household support, i18n beyond Spanish UI copy.
- Playwright / E2E (deferred until core flows exist, per `openspec/config.yaml`).

## Capabilities

### New Capabilities
- `data-persistence`: Neon Postgres schema, migration workflow, money and timestamp
  representation invariants, connection policy, archive semantics, repository boundary.
- `shared-password-auth`: single-password middleware gate, session cookie, protected route set.
- `app-shell-navigation`: 430px mobile shell, four-tab bottom nav with center FAB, route layout.
- `theming`: dark/light/system resolution, cookie persistence, server-rendered initial theme.
- `financial-domain-rules`: cashback net/gross math, total balance, per-category spend, per-month
  budget progress, month-key arithmetic and Buenos Aires "now", transaction filtering and the
  3-state sort ordering, category ordering and colour assignment, time-based greeting.

### Modified Capabilities
- None (`openspec/specs/` is empty; this is the first change).

## Approach

Adopt the exploration recommendations (obs #95) verbatim as technical direction. Money is stored
as **integer whole ARS pesos** (`amount` = net, `gross` = original; `cashback` stays a rate, not
money). Timestamps are `timestamp without time zone`, treated as Buenos Aires wall-clock
throughout, with a btree index on `transactions(date)` sized for half-open month range queries.
Reads are Server Components; writes are Server Actions (from change 2).

Because the domain core now lands in this change, the money and timestamp invariants are not just
schema declarations — they are enforced by tested pure functions (`computeNetAmount`,
`nowInBuenosAires`, the month-range helper) that changes 2 and 3 are required to call rather than
reimplement. `lib/domain/` imports no React and no database module; `lib/db/repositories/` is the
only module family that touches Drizzle. That seam is what makes the later screen slices thin.

**Naming clarification within the locked decision:** the locked constant-default auth-scoping
column keeps the name `user_id`. The household member a transaction belongs to (obs #59's `user`
field) is named `member_id` and references a `members` table. These are two different concepts and
must not share a name.

## The five latent bugs — stated resolutions

| # | Bug | Resolution | Lands in |
|---|-----|-----------|----------|
| 1 | Unrounded float money vs rounded-only display | `amount`/`gross` are `integer` whole pesos. `net = Math.round(gross * (1 - pct/100))` lives in `computeNetAmount` and is applied **once**, server-side, on the write path. Never round at render only. | Schema + `computeNetAmount` + its unit tests: **1**. Called on the write path: 2 |
| 2 | Server "now" is UTC on Vercel; design assumed browser-local | Columns are `timestamp without time zone`. `nowInBuenosAires()` is the only permitted source of "now"; bare `new Date()` treated as local is banned server-side. | Column type + helper + tests: **1** |
| 3 | `startsWith` / `LIKE 'YYYY-MM%'` month filter cannot use a btree index | Half-open range: `date >= :monthStart AND date < :nextMonthStart`, computed in app code from `monthKey`. Index created in the first migration; the range query lives in the transactions repository. | Index + range helper + repository query: **1** |
| 4 | Drag-to-reorder has no keyboard path and no ARIA | Replace the hand-rolled pointer code with `@dnd-kit/core` + `@dnd-kit/sortable`: `TouchSensor` reproduces the 180ms/8px activation constraint, `KeyboardSensor` adds arrow-key reordering, announcements in Spanish. | 3 (recorded here so it is not lost) |
| 5 | `removeCategory` / `removeUser` orphan referencing rows once real FKs exist | **RESOLVED — soft-delete / archive.** See the binding consequences below. | Schema (`archived_at`, `ON DELETE RESTRICT`) + repository `archived_at IS NULL` filtering: **1**. Archive UI in "Perfil": 3 |

## RESOLVED — category and member deletion policy: soft-delete / archive

**Confirmed by the user on 2026-09-01. This decision is closed; `sdd-design` MUST implement
soft-delete / archive and MUST NOT re-open the question.**

This is a **product** decision, not only a technical one, and it gated the schema for this change.

The design lets a user delete a category outright. In Postgres, a category with years of
historical transactions cannot simply vanish.

| Option | Consequence |
|--------|-------------|
| **Block when referenced** (`ON DELETE RESTRICT`) | Simplest FK. But any category ever used becomes permanently undeletable, so the picker list only grows and can never be cleaned up. The design's delete button would need a new error path. |
| **Cascade** (`ON DELETE CASCADE`) | Deleting "Supermercado" silently erases years of transactions and changes the total balance. Unacceptable for a financial ledger. |
| **Soft-delete / archive** (recommended) | `archived_at timestamp null`. Archived categories disappear from pickers and the "Inicio" grid; historical transactions and budgets still resolve their category. Cost: every picker query must filter `archived_at IS NULL`. |

**DECIDED: soft-delete / archive**, applied to both categories and household members, and
keeping obs #59's rule that the last remaining active member cannot be archived. The delete
control becomes an archive control; its Spanish label is a spec-phase decision.

Binding consequences for `sdd-design` and `sdd-spec`:

1. Both the categories table and the members table carry `archived_at timestamp null`.
2. Foreign keys from transactions and budgets use `ON DELETE RESTRICT`; rows are archived, never
   deleted, so the restrict path is a safety net rather than a user-facing error.
3. Every picker, the "Inicio" grid, the add/edit sheet, and new budget rows filter
   `archived_at IS NULL`.
4. Historical transactions and budgets continue to resolve and display an archived category or
   member label exactly as before.
5. Archiving the last active member MUST be rejected.
6. Cascade delete is rejected outright and MUST NOT appear in the schema.

## Seed data decision

The design ships 2 users, 18 expense categories, 3 income categories, 20 transactions, and budgets
for 2026-07 / 2026-08.

- **21 categories + the category→icon map + accent cycle → onboarding default** (real production
  content): the 18 expense categories plus the 3 income categories ("Sueldo", "Regalo", "Otro")
  that the source design keeps in a separate `incomeCategories` list. They live in one table
  discriminated by `kind`, because the add/edit sheet swaps between the two sets by transaction
  type. A finance app with an empty category list is unusable on first run; the category set is
  product content, not fixture data. Inserted by the change-1 seed.
- **2 household members → onboarding default**, seeded with the design's names and renameable in
  "Perfil" (change 3).
- **20 transactions + the two months of budgets → dev-only seed** (`pnpm db:seed:dev`), never run
  against production. These are fixtures.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts` | New | Project scaffolding, pnpm only |
| `lib/db/schema.ts`, `drizzle/` | New | Drizzle schema + first migration |
| `lib/db/client.ts` | New | Neon `neon-http` client, pooled/HTTP string only |
| `lib/db/repositories/` | New | Transactions, budgets, categories, members, card order; archive filtering; half-open month range query |
| `lib/db/seed/` | New | Default seed (prod) + dev fixture seed |
| `lib/domain/` | New | Pure domain functions ported from `renderVals()`; no React, no DB imports |
| `vitest.config.ts`, `lib/domain/**/*.test.ts` | New | Test harness + unit tests for every domain function |
| `proxy.ts` | New | Shared-password gate |
| `app/(shell)/layout.tsx`, `app/(shell)/{inicio,presupuesto,movimientos,perfil}/page.tsx` | New | Shell, bottom nav, placeholder screens |
| `components/ui/`, `components/organisms/BottomNav.tsx` | New | Shell atoms and nav |
| `docs/design/` | Unchanged | Reference only, never imported or shipped |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Direct Neon connection string used from serverless, exhausting the ~97-connection cap | Med | `neon-http` driver only; assert at startup that the configured URL is the pooled/HTTP endpoint |
| Domain core ships with no UI consumer, so a wrong ported rule surfaces only in change 2 | Med | Every `lib/domain/` function has a Vitest unit test in this change, with cases taken from obs #59's rules (cashback `max(0, …)`, over-budget colour switch, uncapped label, all-time balance) |
| Shared password weak or leaked (single secret protects all household data) | Med | Env var only, never committed; constant-time comparison; httpOnly + secure + sameSite session cookie |
| `integer` pesos overflow under long-run ARS inflation | Low | ~2.1B ARS per value; `ALTER COLUMN TYPE bigint` is a trivial additive migration later |
| Each of the three slices exceeds the 800-line review budget | High | Accepted tradeoff (user decision); apply-phase context, not reviewer load, is the binding constraint. `sdd-tasks` MUST forecast the overage and `sdd-apply` needs an explicit `size:exception` per slice |
| Later slices reimplement domain logic instead of importing it | Med | `lib/domain/` is the single source for these rules; changes 2 and 3 MUST import, never duplicate — enforce in their spec phases |

## Rollback Plan

**Schema migration.** This is the first migration against an empty Neon database, so rollback is
lossless: revert the migration commit and drop the created tables, or delete and recreate the Neon
branch. Apply the migration to a Neon **branch** for the preview deployment before promoting.
From change 2 onward, real household data exists and migrations MUST be expand-contract only.

**Auth change.** The middleware is new; there is no prior auth to restore. Rollback is reverting
`proxy.ts` and removing the password env var from Vercel, which leaves the app open — safe
only in this change because no household data exists yet. If a later change must revert auth, the
app MUST be taken offline instead.

**Domain core and repositories.** Pure code with no persisted state and, within this change, no UI
consumer. Rollback is a plain commit revert with no data implication. Reverting the domain core
without also reverting the schema is safe; the reverse is not, so revert them together.

**Deployment.** Vercel instant rollback to the previous deployment; no data migration is coupled
to the redeploy.

## Dependencies

- Neon Postgres project provisioned via the Vercel Marketplace free tier, pooled/HTTP connection
  string available as a Vercel env var.
- Shared password chosen and stored as a Vercel env var.
- Personal GitHub account added via `gh auth login` before any push or PR (obs #58) — the only
  configured account is the work account.

## Success Criteria

- [ ] `pnpm install`, `pnpm build`, and `pnpm test` all succeed from a clean clone.
- [ ] The first Drizzle migration applies to a fresh Neon database and can be reverted cleanly.
- [ ] Requesting any app route without a valid session redirects to the password screen; a correct
      password grants access and a wrong one does not.
- [ ] All four tabs — "Inicio", "Presupuesto", "Movimientos", "Perfil" — are reachable from the
      bottom nav inside the 430px shell, and the center FAB is present.
- [ ] Theme dark/light/system resolves on the server with no flash of the wrong theme on load.
- [ ] Seeding a fresh database yields the 18 default categories and 2 household members, with no
      fixture transactions or budgets.
- [ ] The deployed Vercel preview reads from Neon over the pooled/HTTP connection string.
- [ ] Every `lib/domain/` function has a passing Vitest unit test, including: cashback net is
      `max(0, …)` and applies to expenses only; `totalBalance` sums all transactions ever, not the
      selected month; the budget bar caps at 100% while its label does not; the bar switches to the
      expense colour when spent exceeds budgeted; the sort toggle cycles date desc → amount desc →
      amount asc.
- [ ] `lib/domain/` contains no import of React, Next.js, Drizzle, or `lib/db/`.
- [ ] Repository reads for pickers exclude rows with a non-null `archived_at`, while a read of a
      historical transaction still resolves an archived category or member label.
- [ ] Attempting to archive the last active member is rejected.
- [ ] The month-range repository query uses a half-open range and the planner uses the
      `transactions(date)` index, with no `LIKE` predicate anywhere.
- [ ] No UI copy is in English; no code, identifier, or comment is in Spanish.
