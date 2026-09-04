# Tasks: Port Foundation — Persistence, Auth, Domain Core, and App Shell

> **Size note.** `sdd-tasks`'s 530-word budget is deliberately exceeded, matching `design.md`'s own
> override. This change spans 5 capabilities, a `pnpm`-only greenfield toolchain, a per-domain-function
> unit-test requirement, every threat-matrix RED test, and explicit user-blocking prerequisites. Compressing
> this into 530 words would push detail into `sdd-apply`, which is the exact failure mode the three-change
> slicing (proposal.md, obs #158) exists to prevent.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,150–1,400 (matches proposal.md's own estimate) |
| 400-line budget risk | High |
| Chained PRs recommended | No — `delivery_strategy: single-pr` with pre-accepted `size:exception` |
| Suggested split | Single PR, organized as 10 work-unit commits (below) |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

The overage is pre-accepted (user decision, 2026-09-01, recorded in `proposal.md` and `design.md`):
apply-phase context — not reviewer load — is the binding constraint for this solo-developer change, and
each of the three port-* slices is already the finest cut the user is willing to make.

### Suggested Work Units (commits within the single PR)

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------------|------------------|--------------------|
| 1 | Tooling, Vitest harness, env + connection guard | `pnpm test -- lib/env` | `DATABASE_URL=<direct-host> pnpm dev` — confirm throw naming the host | Revert `package.json`, `lib/env.ts`, `lib/db/client.ts` |
| 2 | Schema + first migration | N/A — generated SQL has no test; `pnpm db:generate` re-run must diff clean | `pnpm db:generate` | Run `drizzle/0000_rollback.sql` |
| 3 | Domain core + unit tests | `pnpm test -- lib/domain` | N/A — pure functions, no process to exercise | Delete `lib/domain/**` (no consumer yet) |
| 4 | Import-direction enforcement | `pnpm test -- architecture` + `pnpm lint` | N/A — build/lint-time only | Revert `eslint.config.mjs` zones + `architecture.test.ts` |
| 5 | Repository adapters | `pnpm build` (typecheck; integration deferred per design) | N/A — no Neon test branch provisioned this change | Delete `lib/db/repositories/**` |
| 6 | Auth (session + middleware) | `pnpm test -- lib/auth` | `pnpm dev` + `curl -i localhost:3000/inicio` → 307 to `/login?next=/inicio` | Delete `proxy.ts`, `lib/auth/session.ts`, `app/login/**`, `app/actions/login.ts` |
| 7 | Shell + navigation | N/A — Playwright deferred per config.yaml | `pnpm dev` — click all 4 tabs, confirm 430px width | Delete `app/(shell)/**`, `components/organisms/BottomNav.tsx` |
| 8 | Theming | `pnpm test -- lib/domain/theme` | `pnpm dev` — toggle OS dark mode, confirm no flash | Revert `app/layout.tsx` theme block, `app/globals.css`, `app/actions/setTheme.ts` |
| 9 | Seed data | N/A — no test DB; dev seed exercised manually | `pnpm db:seed` on the Neon branch (**needs Phase 4**) | `TRUNCATE` or discard the Neon branch |
| 10 | Full verification | `pnpm install && pnpm test && pnpm build` | Vercel preview walkthrough (**needs Phase 4**) | Vercel instant rollback |

---

## Phase 1: Tooling & Scaffolding

- [x] 1.0 **SUPPLY-CHAIN HARDENING — MUST run before any dependency is downloaded.** Create
      `pnpm-workspace.yaml` at the repo root with:

      ```yaml
      minimumReleaseAge: 1440
      strictDepBuilds: true
      onlyBuiltDependencies: []
      ```

      Rationale (verified against pnpm docs, 2026-09-02): `minimumReleaseAge` refuses any version
      published less than 24h ago, which is the window in which most malicious releases are caught
      and pulled. `strictDepBuilds: true` makes the install FAIL rather than silently proceed when a
      package wants to run install scripts. `onlyBuiltDependencies: []` is the allowlist — every
      package that legitimately needs a build script must be added by hand, with a one-line comment
      saying why. pnpm 11 already defaults `minimumReleaseAge` to 1440, but pinning it in the repo
      makes the guarantee reproducible on Vercel's build machine, whose pnpm version we do not
      control. Do NOT weaken any of these three to make an install succeed — if an install fails on
      `strictDepBuilds`, that is the control working; evaluate the package instead.
- [x] 1.1 `pnpm create next-app@latest . --typescript --eslint --app --import-alias "@/*" --skip-install`
      — scaffolds `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs` WITHOUT
      downloading anything. Then run `pnpm install` so the very first download is already governed by
      the 1.0 policy. **Explicit pnpm commands; npm is never used.**
- [x] 1.2 `pnpm add drizzle-orm @neondatabase/serverless` — Neon + Drizzle runtime deps.
- [x] 1.3 `pnpm add -D drizzle-kit tsx` — migration generator + script runner.
- [x] 1.4 `pnpm add lucide-react` — bundled icons (never per-icon unpkg fetch).
- [x] 1.5 `pnpm add -D vitest` and create `vitest.config.ts` (Node env, `lib/**/*.test.ts`). **Dedicated Vitest harness task** — `pnpm test` does not exist yet.
- [x] 1.6 Add `"dev"`, `"build"`, `"test"` scripts to `package.json`, each prefixed `TZ=UTC` (design §2 wall-clock invariant).
- [x] 1.7 Add `db:generate`, `db:migrate`, `db:seed`, `db:seed:dev` scripts to `package.json` (design §6).

## Phase 2: Environment & Connection Policy

- [x] 2.1 Create `lib/env.ts`: hand-written validation of `DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET`, `TZ`; export `assertProcessTimezoneUtc()`. No zod.
- [x] 2.2 [RED] `lib/env.test.ts`: table-driven cases for `assertPooledNeonUrl` — direct Neon host, non-Neon host, missing `sslmode=require`, missing `-pooler.`, well-formed pooled URL.
- [x] 2.3 Create `lib/db/client.ts`: `assertPooledNeonUrl()` — parses URL, checks `postgres(ql):` protocol, `.neon.tech` hostname, `-pooler.` substring, `sslmode=require`; called at module scope before the Neon client; `import 'server-only'` at the top. **This is the startup assertion rejecting a direct (non-`-pooler`) connection string.**
- [x] 2.4 [GREEN] Run 2.2 against 2.3 — confirm all cases pass.

## Phase 3: Schema & Migration

- [x] 3.1 `lib/db/schema.ts`: `category_kind` and `transaction_type` enums.
- [x] 3.2 Add `members` table: `archived_at`, partial unique `members_active_name_uq`, index `members_active_idx`.
- [x] 3.3 Add `categories` table: `kind`, `icon`, `color_index` (`CHECK 0..5`), `archived_at`, partial unique `categories_active_name_uq`, index `categories_active_kind_idx`.
- [x] 3.4 Add `transactions` table: `amount`/`gross` CHECKs, `cashback_bps CHECK 0..10000`, `CHECK (type <> 'income' OR cashback_bps = 0)`, `CHECK (amount <= gross)`, indexes `transactions_month_idx`, `transactions_category_month_idx`.
- [x] 3.5 Add `budgets` table: `month char(7) CHECK (month ~ '^\d{4}-\d{2}$')`, unique `budgets_month_category_uq`.
- [x] 3.6 Add `card_order` table: composite PK `(user_id, category_id)`, index `card_order_position_idx`.
- [x] 3.7 Set `ON DELETE RESTRICT` on every FK from `transactions`/`budgets`/`card_order`; confirm no `ON DELETE CASCADE` anywhere in `schema.ts`.
- [x] 3.8 Create `drizzle.config.ts` (`dialect: 'postgresql'`, `schema: './lib/db/schema.ts'`, `out: './drizzle'`).
- [x] 3.9 `pnpm db:generate` — emit `drizzle/0000_*.sql`, commit it.
- [x] 3.10 Hand-author `drizzle/0000_rollback.sql` (`DROP TABLE card_order, budgets, transactions, categories, members; DROP TYPE transaction_type, category_kind;`).
- [x] 3.11 Create `lib/db/migrate.ts` (`drizzle-orm/neon-http/migrator` entrypoint for `pnpm db:migrate`).

## Phase 4: External Prerequisites — BLOCKING ON USER

> These require external account/dashboard access an agent cannot perform. Hand to the user now;
> Phases 5–11 do not depend on them and can proceed in parallel. Only Phase 4.4, 11.3, and 12.4 need
> Phase 4 complete first.

- [ ] 4.1 **BLOCKING ON USER** — create the Neon Postgres project via the Vercel Marketplace free tier.
- [ ] 4.2 **BLOCKING ON USER** — set `DATABASE_URL` (pooled/HTTP string), `APP_PASSWORD`, `SESSION_SECRET` (≥32 bytes) as Vercel project environment variables.
- [ ] 4.3 **BLOCKING ON USER** — link the local repo to the Vercel project (`vercel link` or dashboard).
- [ ] 4.4 **BLOCKING ON USER (needs 4.1–4.3)** — run `pnpm db:migrate` against the Neon branch; confirm all 5 tables + `transactions(date)` index exist (spec: data-persistence, "First migration applies and reverts cleanly").

## Phase 5: Domain Core (`lib/domain/`) — pure, no DB/React dependency

- [x] 5.1 `lib/domain/types.ts` — `TransactionType`, `MonthKey`, `SortMode`, `ThemePreference`, `EffectiveTheme`, `DomainTransaction`, `MonthRange`, `BudgetProgress`, `TransactionFilters`.
- [x] 5.2 `lib/domain/money.ts` — `computeNetAmount`, `percentToBps`, `bpsToPercent`.
- [x] 5.3 [Test] `lib/domain/money.test.ts`: fractional rounding (gross=33333, pct=7 → round(30999.69)=31000); cap-at-zero (gross=1000, pct=150 → 0); income ignores cashback (gross=50000, pct=10 → 50000); round-once (gross=100, pct=33 → 67); `RangeError` on negative gross / out-of-range bps.
- [x] 5.4 `lib/domain/balance.ts` — `totalBalance`, `spentForCategory`.
- [x] 5.5 [Test] `lib/domain/balance.test.ts`: `spentForCategory` sums net not gross (930+1860=2790); `totalBalance` spans all history (incl. 2026-01 while viewing 2026-08); nets income minus expense (100000-40000=60000).
- [x] 5.6 `lib/domain/budget.ts` — `budgetProgress`.
- [x] 5.7 [Test] `lib/domain/budget.test.ts`: bar capped at 100 (spent 1500/budgeted 1000); label uncapped at 150; `hasBudget:false` neutral state when budgeted ≤ 0; `overBudget` flips exactly at `spent > budgeted`.
- [x] 5.8 `lib/domain/month.ts` — `isMonthKey`, `monthKeyOf`, `monthKeyLabel`, `prevMonthKey`, `monthRange`.
- [x] 5.9 [Test] `lib/domain/month.test.ts`: `monthKeyLabel('2026-08')`='Agosto 2026'; `prevMonthKey` year rollover ('2026-01'→'2025-12') and same-year; `monthRange` half-open at February and December boundaries; `RangeError` on invalid key for all four functions.
- [x] 5.10 `lib/domain/time.ts` — `nowInBuenosAires`, `wallClockFromParts`.
- [x] 5.11 [Test] `lib/domain/time.test.ts`: UTC instant 2026-08-15T00:00Z → BA wall-clock 2026-08-14 (`vi.setSystemTime`); fixed UTC-3 offset, no DST.
- [x] 5.12 `lib/domain/transactions.ts` — `filterTransactions`, `sortTransactions`, `nextSortMode`.
- [x] 5.13 [Test] `lib/domain/transactions.test.ts`: empty filters return all; type filter narrows; combined filters AND; date range inclusive both ends; sort cycle `date→amountDesc→amountAsc→date`; stable tie-break on `id` descending.
- [x] 5.14 `lib/domain/categories.ts` — `orderCategories`, `categoryColor`, `ACCENT_CYCLE_LENGTH`, `nextColorIndex`.
- [x] 5.15 [Test] `lib/domain/categories.test.ts`: stored order respected; archived/unknown ids skipped, new appended last; `categoryColor` returns `var(--accent-N)`; modulo wrap at `ACCENT_CYCLE_LENGTH=6`.
- [x] 5.16 `lib/domain/theme.ts` — `isThemePreference`, `resolveTheme`.
- [x] 5.17 [Test] `lib/domain/theme.test.ts`: invalid value rejected; `resolveTheme('system', true)`→'dark', `('system', false)`→'light'; explicit 'dark'/'light' ignore `systemPrefersDark`.
- [x] 5.18 `lib/domain/greeting.ts` — `greeting`.
- [x] 5.19 [Test] `lib/domain/greeting.test.ts`: hour 9→'Buenos días'; hour 12 boundary→'Buenas tardes'; hour 19 boundary→'Buenas noches'; hour 23→'Buenas noches'.

## Phase 6: Import-Direction Enforcement

- [x] 6.1 Add per-directory `no-restricted-imports` zones to `eslint.config.mjs` for `lib/domain/**` (deny `react`, `react-dom`, `next*`, `server-only`, `drizzle-orm*`, `@neondatabase/*`, `@/lib/db/**`, `@/components/**`, `@/app/**`), `components/**`+`app/**` (deny `drizzle-orm*`, `@neondatabase/*`, `@/lib/db/schema`, `@/lib/db/client`), and `lib/db/repositories/**` (deny `react`, `react-dom`, `next/*`, `@/components/**`, `@/app/**`).
- [x] 6.2 [RED] `lib/domain/architecture.test.ts`: scans every file under `lib/domain/` for forbidden import specifiers and fails on any match — the enforcement mechanism design §4 requires, running inside `pnpm test`.
- [x] 6.3 [GREEN] Run `pnpm test` — confirm 6.2 passes against Phase 5's `lib/domain/` output.

## Phase 7: Persistence Adapters (`lib/db/repositories/`) — the only Drizzle consumers

- [x] 7.1 `lib/db/repositories/members.repository.ts`: list-active (`archived_at IS NULL`), archive (rejects when it is the last active member), create.
- [x] 7.2 `lib/db/repositories/categories.repository.ts`: list-active-by-kind (`WHERE kind = :type AND archived_at IS NULL`), archive, create.
- [x] 7.3 `lib/db/repositories/transactions.repository.ts`: month-scoped list accepting caller-supplied `{start, endExclusive}` Date bounds (`date >= start AND date < endExclusive`; no `LIKE`/`startsWith` anywhere), create.
- [x] 7.4 `lib/db/repositories/budgets.repository.ts`: get-by-month (`WHERE user_id = :u AND month = :monthKey`), upsert.
- [x] 7.5 `lib/db/repositories/cardOrder.repository.ts`: get-ordered-for-user (join `categories`, filter `archived_at IS NULL`), replace-all as one `db.transaction([DELETE, INSERT ...])` batch (non-interactive `neon-http` constraint, design §1).
- [x] 7.6 Confirm 7.1–7.5 import nothing from `components/`/`app/` (covered by 6.1's `lib/db/repositories/**` zone); run `pnpm build` to typecheck (integration against a live Neon branch is deferred per design's Testing Strategy).

## Phase 8: Auth (`lib/auth/session.ts`, `proxy.ts`)

- [x] 8.1 `lib/auth/session.ts`: `signSession` (Node `crypto`, `timingSafeEqual` over SHA-256 digests) and `verifySession` (Web Crypto `crypto.subtle`, Edge-safe).
- [x] 8.2 [RED] `lib/auth/session.test.ts`: valid signature; tampered payload with sig kept; expired `exp`; malformed cookie.
- [x] 8.3 [RED, threat matrix] Middleware test table covering every design threat-matrix row: absent/malformed/unsigned cookie → 307 to `/login?next=<path>`; expired `exp` → cookie deleted + 307; tampered signature → rejected; `?next=//evil.com`, `/\evil.com`, `https://evil.com` → rejected, redirect `/inicio`; `/login` with a valid cookie → 307 `/inicio`; matcher-bypass paths (`/inicio/`, `/INICIO`, `/inicio/../perfil`) → all gated.
- [x] 8.4 `proxy.ts`: cookie read + `verifySession`; matcher excludes `_next/static`, `_next/image`, `favicon.ico`, `icons/`, `manifest.webmanifest`; explicit early return for `pathname === '/login'`; `next` sanitization (single leading `/`, no `//`, no `/\`, no scheme).
- [x] 8.5 `app/actions/login.ts`: Server Action — SHA-256 digest + `timingSafeEqual`; sets `tm_session` (`httpOnly`, `secure` in prod, `sameSite=lax`, `maxAge` 30 days) on match; generic Spanish error, no cookie, on mismatch.
- [x] 8.6 `app/login/page.tsx`: password form, public route outside the gate.
- [x] 8.7 [GREEN] Run 8.2–8.3 against 8.1/8.4 — confirm every threat-matrix row passes.

## Phase 9: App Shell & Navigation

- [x] 9.1 `components/ui/{Button,Chip,Input,Avatar,ProgressBar,Icon}.tsx` — presentational atoms using `lucide-react`.
- [x] 9.2 `components/organisms/BottomNav.tsx`: tabs "Inicio", "Presupuesto", "Movimientos", "Perfil" in order + center FAB.
- [x] 9.3 `app/(shell)/layout.tsx`: 430px max-width shell wrapping `BottomNav`.
- [x] 9.4 Placeholder `app/(shell)/{inicio,presupuesto,movimientos,perfil}/page.tsx` — empty Server Components, no CRUD/content.
- [x] 9.5 [Manual, Playwright deferred per config.yaml] `pnpm dev` — click all four tabs, confirm each navigates and the shell renders at 430px.

## Phase 10: Theming

- [x] 10.1 `app/actions/setTheme.ts`: Server Action writing `tm_theme` cookie, validated by `isThemePreference`.
- [x] 10.2 Boot inline script in `app/layout.tsx` `<head>`: reads `matchMedia('(prefers-color-scheme: dark)')`; corrects `documentElement.dataset.theme` and writes `tm_system_dark` before first paint when `pref==='system'` and the OS answer differs from the server guess; mount a `change` listener in the shell.
- [x] 10.3 `app/layout.tsx`: read `tm_theme`/`tm_system_dark` cookies, `resolveTheme(pref, systemDark)`, render `<html data-theme data-theme-pref suppressHydrationWarning>`.
- [x] 10.4 `app/globals.css`: CSS custom properties under `[data-theme='light']` and `[data-theme='dark']`, including both accent cycles (6 colors each) backing `categoryColor`.

## Phase 11: Seed Data

- [x] 11.1 `lib/db/seed/default.seed.ts`: 21 categories (18 expense + 3 income: "Sueldo", "Regalo", "Otro"), 2 members, `ON CONFLICT DO NOTHING` against the partial unique indexes, idempotent.
- [x] 11.2 `lib/db/seed/dev.seed.ts`: 20 fixture transactions + budgets for 2026-07/2026-08; refuses to run when `DATABASE_URL` is not a Neon branch host.
- [ ] 11.3 **BLOCKING ON USER (needs Phase 4)** — run `pnpm db:seed` against the provisioned Neon database; confirm the "Fresh database default seed" scenario (21/18/3/2 members/0 transactions/0 budgets).

## Phase 12: Full-Suite Verification & Wiring

- [x] 12.1 `pnpm install` from a clean checkout — confirm it succeeds (success criterion).
- [x] 12.2 `pnpm test` — all domain, guard, and architecture tests pass.
- [x] 12.3 `pnpm build` — confirm success; spot-check the `server-only` build-time enforcement (temporarily import `lib/db/client.ts` from a Client Component, confirm the build fails, then revert).
- [ ] 12.4 **BLOCKING ON USER (needs Phase 4)** — deploy the Vercel preview; manually verify: unauthenticated request redirects to `/login`; correct password grants access, wrong password denied; all four tabs reachable; theme resolves with no flash; app reads Neon over the pooled connection.
