# Design: Port Foundation — Persistence, Auth, Domain Core, and App Shell

> **Size note.** `sdd-design`'s 800-word budget is deliberately exceeded. The orchestrator required a
> full Drizzle schema, every domain signature, connection policy, auth flow, and two rollback plans in
> this artifact. Compressing them would push the decisions into `sdd-apply`, which is exactly the
> failure mode the three-change slicing (obs #158) exists to prevent.

## Technical Approach

Three concentric rings, enforced by import direction rather than convention:

```
  app/ + components/          ← React, Next.js, Server Actions (change 2+)
        │  imports
        ▼
  lib/db/repositories/        ← the ONLY Drizzle consumers (hexagonal adapters)
        │  imports
        ▼
  lib/domain/                 ← pure TypeScript. No React. No Next. No Drizzle. No lib/db.
```

`lib/domain/` is the ported `renderVals()` core and is fully unit-tested in this change even though it
has no UI consumer yet. `lib/db/repositories/` owns every SQL predicate, including the half-open month
range and the `archived_at IS NULL` picker filter. Screens (change 2/3) are thin: fetch via repository,
compute via domain, render.

Reads are Server Components; writes are Server Actions (from change 2). The `neon-http` driver is
connectionless, so there is no pool to manage and no interactive transaction — a hard constraint
recorded below.

---

## 1. Schema (`lib/db/schema.ts`)

### Cross-cutting column conventions

| Convention | Decision | Rationale |
|---|---|---|
| Primary keys | `integer ... generated always as identity` | Postgres 10+ identity is the standard replacement for `serial`; no sequence-ownership surprises. Rejected UUID: no distributed-write requirement, and 4-byte keys keep the composite indexes small. |
| `user_id` | `text NOT NULL DEFAULT 'household'` | **Locked.** The auth-scoping column with a constant default, per `openspec/config.yaml`. It is *not* a person. Every index is prefixed with it so a future multi-account migration is an index-order change, not a rewrite. |
| `member_id` | `integer NOT NULL REFERENCES members(id)` | The household person who made the transaction (obs #59's `user` field). Distinct concept from `user_id`; the two must never share a name. |
| Timestamps | `timestamp` (i.e. `without time zone`) | Locked. Treated as Buenos Aires wall-clock everywhere. |
| Timestamp defaults | `DEFAULT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')` | A bare `now()` yields `timestamptz`; casting it to `timestamp` silently stores **UTC** wall-clock and reintroduces latent bug #2 at the database layer. The explicit zone conversion makes the DB default agree with `nowInBuenosAires()`. |
| FK delete rule | `ON DELETE RESTRICT` everywhere | Rows are archived, never deleted (obs #157). RESTRICT is a safety net, not a user-facing path. Cascade is rejected outright: it silently rewrites historical balances. |

### `members`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `integer` identity | no | — | PK |
| `user_id` | `text` | no | `'household'` | auth scope |
| `name` | `text` | no | — | e.g. "Sofi", "Mati" |
| `archived_at` | `timestamp` | **yes** | `null` | soft-delete marker |
| `created_at` | `timestamp` | no | BA `now()` | |

- Partial unique index `members_active_name_uq` on `(user_id, name) WHERE archived_at IS NULL`.
  Rationale: two *active* members cannot share a name, but archiving "Mati" must not block re-adding
  "Mati" later. A plain unique constraint would make archival permanently poison the name.
- Index `members_active_idx` on `(user_id) WHERE archived_at IS NULL` — the picker read path.

### `categories`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `integer` identity | no | — | PK |
| `user_id` | `text` | no | `'household'` | |
| `name` | `text` | no | — | Spanish product copy, e.g. "Super" |
| `kind` | `category_kind` enum | no | — | `'expense' \| 'income'` |
| `icon` | `text` | no | `'tag'` | lucide icon name, e.g. `shopping-cart` |
| `color_index` | `smallint` | no | — | `0..5`, assigned at insert |
| `archived_at` | `timestamp` | yes | `null` | |
| `created_at` | `timestamp` | no | BA `now()` | |

- `CHECK (color_index BETWEEN 0 AND 5)`.
- Partial unique `categories_active_name_uq` on `(user_id, kind, name) WHERE archived_at IS NULL`.
- Index `categories_active_kind_idx` on `(user_id, kind) WHERE archived_at IS NULL` — the picker read.

**Decision: `kind` column instead of a hardcoded `incomeCategories` array.** obs #59 records a separate
fixed income list (Sueldo, Regalo, Otro) and the add sheet switches on `addType`. Modelling it as a
column keeps one table, one FK from `transactions`, and lets the picker query be
`WHERE kind = :type AND archived_at IS NULL`. Rejected a second `income_categories` table: duplicates
every archive rule and forces a polymorphic FK on `transactions`.

**Decision: persist `icon` and `color_index` as columns, not a code-side map.** The proposal classifies
the category→icon map and accent cycle as *product content*. A TS map keyed by lowercased Spanish names
cannot answer for a user-created category, and `categoryColor` in the design used
`categories.indexOf(name)` — so **archiving one category silently recolours every category after it**.
A stored `color_index`, assigned once at insert as `(active category count) % 6`, is stable across
archive and rename. This is a deliberate fix to a latent design bug, not a deviation.

### `transactions`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `integer` identity | no | — | PK |
| `user_id` | `text` | no | `'household'` | auth scope |
| `member_id` | `integer` | no | — | FK → `members(id)` RESTRICT |
| `category_id` | `integer` | no | — | FK → `categories(id)` RESTRICT |
| `type` | `transaction_type` enum | no | — | `'expense' \| 'income'` |
| `amount` | `integer` | no | — | **net**, whole ARS pesos |
| `gross` | `integer` | no | — | original, whole ARS pesos |
| `cashback_bps` | `smallint` | no | `0` | cashback **rate** in basis points |
| `date` | `timestamp` | no | — | BA wall-clock |
| `created_at` | `timestamp` | no | BA `now()` | |

- `CHECK (amount >= 0 AND gross >= 0)`
- `CHECK (cashback_bps BETWEEN 0 AND 10000)`
- `CHECK (type <> 'income' OR cashback_bps = 0)` — cashback applies to expenses only (obs #59), enforced
  in the database, not only in `computeNetAmount`.
- `CHECK (amount <= gross)`

**Decision: `cashback` is stored as `smallint` basis points, named `cashback_bps`.**
It is a rate, not money — that is locked and unchanged. What is decided here is its *type*:

| Option | Verdict |
|---|---|
| `numeric(5,2)` | **Rejected** — Postgres NUMERIC comes back as a **string** through the Neon/pg drivers; every consumer would need manual parsing (the trap flagged in obs #95). |
| `real` / `double` | **Rejected** — reintroduces float drift into the one number that multiplies money. |
| `smallint` whole percent | **Rejected** — cannot express the 7.5% the design's `parseFloat` input accepts. |
| `smallint` basis points | **Chosen** — exact integer, maps to a JS `number`, 0.01% resolution, and the `_bps` suffix makes the unit unmistakable at every call site. |

**Indexes** (both btree, both sized for half-open range scans — **no `LIKE`, no prefix match anywhere**):

- `transactions_month_idx` on `(user_id, date)` — serves
  `WHERE user_id = $1 AND date >= $2 AND date < $3` for the Movimientos list and month totals.
- `transactions_category_month_idx` on `(user_id, category_id, date)` — serves `spentForCategory`'s
  per-category month scan without touching the table for the filter.

No index on `member_id`: two rows of cardinality, the planner will not use it.

### `budgets`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `integer` identity | no | — | PK |
| `user_id` | `text` | no | `'household'` | |
| `month` | `char(7)` | no | — | `'YYYY-MM'` |
| `category_id` | `integer` | no | — | FK → `categories(id)` RESTRICT |
| `amount` | `integer` | no | — | whole ARS pesos, `CHECK (amount >= 0)` |
| `created_at` / `updated_at` | `timestamp` | no | BA `now()` | |

- Unique `budgets_month_category_uq` on `(user_id, month, category_id)` — this is also the read index;
  its `(user_id, month)` prefix serves the whole-month fetch, so no additional index is created.

**Decision: `month char(7)` holding `'YYYY-MM'`, not a `date` column.**
The half-open range requirement belongs to **`transactions`**, not to budgets. Budgets are only ever
read by exact equality — `= :monthKey` for the current month and `= prevMonthKey(k)` for
"Copiar presupuesto de {mes}" — never by range. `char(7)` is fixed-width, its lexicographic order *is*
chronological order (so `ORDER BY month DESC` is correct), equality uses a plain btree, and it is
byte-identical to the `monthKey` already flowing through URL search params and `lib/domain/month.ts`.
Rejected `date` set to the first of the month: it buys range scans budgets never perform, and inserts a
conversion between the URL param and the column at every boundary — a new place for the same
off-by-one-month bug the `monthKey` helpers exist to eliminate. A `CHECK (month ~ '^\d{4}-\d{2}$')`
constraint keeps the format honest.

### `card_order`

| Column | Type | Null | Notes |
|---|---|---|---|
| `user_id` | `text` | no | `'household'` |
| `category_id` | `integer` | no | FK → `categories(id)` RESTRICT |
| `position` | `integer` | no | 0-based |

- PK `(user_id, category_id)`; index `card_order_position_idx` on `(user_id, position)`.
- No unique constraint on `position`: reorder writes would need a deferrable constraint to pass. Reads
  use `ORDER BY position, category_id` so ties are still deterministic.

**Decision: a table.**

| Option | Verdict |
|---|---|
| JSON array column on a settings row | **Rejected** — no referential integrity; an archived or deleted category leaves a dangling entry, and the whole array is rewritten and re-parsed on every read. |
| `position` column on `categories` | **Rejected** — conflates the household's *Inicio card arrangement* with the category entity, forces a write to the picker table on every drag, and a `NOT NULL position` cannot represent the design's partial coverage (`orderedCats` orders only categories that have a budget this month, appending the rest). |
| Separate `card_order` table | **Chosen** — FK integrity, partial coverage is natural, and the repository can join and filter `archived_at IS NULL` in SQL. Matches the proposal's naming. |

**Reorder write (change 3) constraint:** `neon-http` transactions are **non-interactive** — every
statement must be known up front, no read-then-decide inside the transaction. The reorder is therefore
a single `db.transaction([...])` batch of `DELETE WHERE user_id = $1` followed by one multi-row
`INSERT`, computed entirely client-side from the drop result. Recorded here so change 3 does not
discover it late.

---

## 2. Connection Policy

**Env vars** (all server-only; none prefixed `NEXT_PUBLIC_`):

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Neon **pooled/HTTP** connection string. The only URL the app ever reads. |
| `APP_PASSWORD` | Shared household password. |
| `SESSION_SECRET` | ≥32-byte HMAC key for the session cookie signature. |
| `TZ` | Pinned to `UTC` — see the wall-clock invariant below. |

`lib/env.ts` validates all of these at module load, by hand. **Rejected adding zod**: four assertions do
not justify a runtime dependency in the middleware bundle.

**Startup assertion.** `lib/db/client.ts` calls `assertPooledNeonUrl(process.env.DATABASE_URL)` at
module scope, before creating the client, and throws on failure:

1. parses as a URL with protocol `postgres:` or `postgresql:`;
2. hostname ends with `.neon.tech`;
3. hostname contains `-pooler.` — Neon's pooled endpoints are `ep-*-pooler.<region>.aws.neon.tech`
   and direct endpoints are the same host **without** `-pooler`, so this is the discriminator;
4. query string carries `sslmode=require`.

Failure mode is a thrown `Error` naming the offending host, at import, so the very first request on a
misconfigured deployment fails loudly instead of silently opening direct connections and exhausting the
~97-connection cap under load (obs #95, Q7). **There is no escape hatch** in the app client — no
`ALLOW_DIRECT` flag. A flag would be set once during a debugging session and never unset.

`lib/db/client.ts` also carries `import 'server-only'`, so importing it from a Client Component is a
build error rather than a runtime leak of the connection string.

**Wall-clock invariant.** `timestamp without time zone` is parsed by the driver as the *process's* local
time. The app pins `TZ=UTC` (Vercel's default; forced locally and in tests via the pnpm scripts
`TZ=UTC next dev`, `TZ=UTC next build`, `TZ=UTC vitest run`) so that a wall-clock `Date`'s **UTC**
components are exactly the Buenos Aires wall clock. `lib/env.ts` exports `assertProcessTimezoneUtc()`,
called from the same module-load path. Without this pin the developer's own Buenos Aires machine and
Vercel's UTC would disagree, and the Vitest suite would pass locally and fail in CI.

---

## 3. Auth Design (`proxy.ts`)

```
  GET /movimientos
        │
        ▼
  middleware (Edge runtime)
        ├─ path in PUBLIC set? ───── yes ──→ next()
        ├─ read cookie tm_session
        ├─ verify HMAC-SHA-256 via Web Crypto (crypto.subtle)
        ├─ check exp > now
        │        │ invalid / expired / absent
        │        ▼
        │   delete cookie → 307 → /login?next=/movimientos
        └─ valid ──→ next()

  POST /login  (Server Action, Node runtime)
        ├─ sha256(submitted) vs sha256(APP_PASSWORD) → timingSafeEqual
        ├─ mismatch → re-render /login with a generic Spanish error, no cookie
        └─ match → set tm_session → 307 → sanitized `next`, else /inicio
```

| Decision | Choice | Rationale / rejected |
|---|---|---|
| Comparison | `timingSafeEqual` over the **SHA-256 digests** of both strings | Digesting first makes both operands fixed 32 bytes, so the comparison leaks neither content nor length. Raw `===` is rejected: it short-circuits on the first differing byte. |
| Runtime split | Middleware **verifies** with Web Crypto `crypto.subtle`; the login action **signs** in Node | Middleware runs on the Edge runtime where `node:crypto` is unavailable. Discovering this during apply would force a mid-implementation rewrite. |
| Cookie | `tm_session` = `base64url(JSON{v,iat,exp})` + `.` + `base64url(HMAC-SHA-256(payload, SESSION_SECRET))` | Stateless — no session table, no Neon read on every request. The payload carries no secret and no identity (there is only one). |
| Attributes | `httpOnly`, `secure` (production), `sameSite=lax`, `path=/`, `maxAge` 30 days | `lax` permits top-level navigation from an iOS home-screen shortcut while blocking cross-site POST. Rejected `strict`: it breaks that shortcut entry, which is the primary way this app is opened. |
| Lifetime | **30 days, absolute, no sliding renewal** | A leaked cookie has a bounded life, and no write occurs on every request. Rejected rolling renewal: a `Set-Cookie` on every navigation for no user-visible benefit. |
| Gated routes | Everything except the public set | Matcher: `['/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest).*)']`, plus an explicit early `return NextResponse.next()` for `pathname === '/login'`. |
| Login escapes the gate | Via that explicit early return, **not** only the matcher | Two independent mechanisms; a matcher typo alone cannot lock the user out of the login screen. A request to `/login` holding a valid cookie is redirected to `/inicio`. |
| `?next=` redirect | Accepted only if it starts with a single `/`, does not start with `//` or `/\`, and contains no scheme | Prevents the login screen from becoming an open redirect. |

**Rate limiting is out of scope** and recorded as a risk: the Vercel free tier gives no durable counter
store, and a single shared password with no attempt limit is brute-forceable. Mitigation for this change
is password strength alone.

**Auth rollback.** Revert `proxy.ts`, delete `APP_PASSWORD` and `SESSION_SECRET` from the Vercel
project, redeploy (or use Vercel instant rollback to the prior deployment). This leaves the app fully
open, which is acceptable **only in this change** because no household data exists yet. From change 2
onward, reverting auth requires taking the deployment offline instead — deleting the Vercel deployment
or setting the project to password protection at the platform level.

---

## 4. Directory Layout and the Import-Direction Rule

```
app/
  layout.tsx                    # root: reads theme cookie, sets <html data-theme>
  login/page.tsx                # public — outside the gate
  (shell)/layout.tsx            # 430px shell + BottomNav + FAB
  (shell)/inicio/page.tsx       # placeholder screen (this change)
  (shell)/presupuesto/page.tsx
  (shell)/movimientos/page.tsx
  (shell)/perfil/page.tsx
  actions/                      # Server Actions — login.ts, setTheme.ts (this change)
components/
  ui/                           # atoms: Button, Chip, Input, Avatar, ProgressBar, Icon
  molecules/                    # (change 2/3)
  organisms/BottomNav.tsx
  screens/                      # screen-level containers (change 2/3)
lib/
  domain/                       # PURE. types, money, balance, budget, month, time,
                                # transactions, categories, theme, greeting (+ .test.ts)
  db/
    client.ts                   # neon-http + assertPooledNeonUrl + 'server-only'
    schema.ts                   # Drizzle schema — single source of truth
    migrate.ts                  # pnpm db:migrate entrypoint
    repositories/               # THE ONLY DRIZZLE CONSUMERS
      transactions.repository.ts  budgets.repository.ts
      categories.repository.ts    members.repository.ts
      cardOrder.repository.ts
    seed/
      default.seed.ts           # production content: 18 expense + 3 income categories, 2 members
      dev.seed.ts               # fixtures: 20 transactions, budgets 2026-07 / 2026-08
  env.ts
  auth/session.ts               # sign (Node) + verify (Web Crypto) helpers
proxy.ts
drizzle/                        # generated SQL migrations, committed
```

**The rule.** Imports flow inward only: `app/` → `components/` → `lib/db/repositories/` →
`lib/domain/`. `lib/domain/` imports nothing from this repository. No file outside
`lib/db/repositories/` and `lib/db/{client,migrate,seed}` may import `drizzle-orm`, `@neondatabase/*`,
or `@/lib/db/schema`.

**Enforcement — three layers, because folder convention alone is not enforcement:**

1. **Build.** `import 'server-only'` in `lib/db/client.ts`. Any client-side import chain reaching it
   fails `pnpm build`.
2. **Lint.** ESLint flat config (`eslint.config.mjs`) with per-directory `no-restricted-imports` zones.
   Rejected `eslint-plugin-boundaries`: a new dependency for five rules that
   `eslint-config-next`'s existing ESLint already expresses.
   - `lib/domain/**` — deny `react`, `react-dom`, `next`, `next/*`, `server-only`, `drizzle-orm*`,
     `@neondatabase/*`, `@/lib/db/**`, `@/components/**`, `@/app/**`.
   - `components/**`, `app/**` — deny `drizzle-orm*`, `@neondatabase/*`, `@/lib/db/schema`,
     `@/lib/db/client`.
   - `lib/db/repositories/**` — deny `react`, `react-dom`, `next/*`, `@/components/**`, `@/app/**`.
3. **Test.** `lib/domain/architecture.test.ts` reads every file under `lib/domain/` and asserts no
   forbidden import specifier appears. This is what actually discharges the proposal's success
   criterion, and it runs in `pnpm test` where a reviewer will see it fail.

Container/presentational: `app/**/page.tsx` are containers (fetch + compose, Server Components by
default); everything under `components/ui|molecules|organisms` is presentational — props in, callbacks
out, no repository import, `'use client'` only where interactivity demands it.

---

## 5. Domain Core Signatures (`lib/domain/`)

Contracts only — no bodies. Every function is pure, total, and non-mutating (list functions return new
arrays). Every one gets a Vitest unit test in this change.

### `lib/domain/types.ts`

```ts
export type TransactionType = 'expense' | 'income';
export type MonthKey = string;                 // 'YYYY-MM', narrowed by isMonthKey
export type SortMode = 'date' | 'amountDesc' | 'amountAsc';
export type ThemePreference = 'dark' | 'light' | 'system';
export type EffectiveTheme = 'dark' | 'light';

export interface DomainTransaction {
  id: number;
  type: TransactionType;
  amount: number;        // net, whole ARS pesos
  gross: number;         // whole ARS pesos
  cashbackBps: number;   // 0..10000; always 0 when type === 'income'
  categoryId: number;
  memberId: number;
  date: Date;            // wall-clock: UTC components ARE Buenos Aires local time
}

export interface MonthRange { start: Date; endExclusive: Date }   // half-open [start, endExclusive)

export interface BudgetProgress {
  spent: number; budgeted: number; remaining: number;
  barPct: number;        // clamped to 0..100 — drives the bar width
  labelPct: number;      // UNCAPPED — drives the "127%" label
  overBudget: boolean;   // spent > budgeted
  hasBudget: boolean;    // budgeted > 0; false selects the neutral bar colour
}

export interface TransactionFilters {
  type: TransactionType | 'all';
  categoryId: number | 'all';
  memberId: number | 'all';
  from: string | null;   // 'YYYY-MM-DD', inclusive
  to: string | null;     // 'YYYY-MM-DD', inclusive
}
```

### `lib/domain/money.ts`

```ts
export function computeNetAmount(
  input: { type: TransactionType; gross: number; cashbackBps: number },
): number;
export function percentToBps(percent: number): number;
export function bpsToPercent(bps: number): number;
```

- `computeNetAmount` — returns `gross` unchanged for `income`. For `expense`, returns
  `max(0, round(gross * (1 - cashbackBps / 10_000)))`. **Rounding happens here, exactly once**, on the
  server write path; never at render. Throws `RangeError` when `gross` is not a non-negative integer or
  `cashbackBps` is outside `0..10000`.
- `percentToBps` / `bpsToPercent` — the boundary between the UI's percent input (`"7.5"`) and the stored
  integer rate. `percentToBps` rounds to the nearest bp and clamps to `0..10000`. *(Design addition:
  the proposal locks cashback as a rate but not its unit; these two functions are the cost of choosing
  basis points, and both are trivially testable.)*

### `lib/domain/balance.ts`

```ts
export function totalBalance(transactions: readonly DomainTransaction[]): number;
export function spentForCategory(
  transactions: readonly DomainTransaction[],
  categoryId: number,
): number;
```

- `totalBalance` — `income` adds `amount`, `expense` subtracts it, over **every transaction ever**, not
  the selected month (obs #59).
- `spentForCategory` — sums `amount` for `type === 'expense'` and the given `categoryId`. **Contract: the
  input list is already month-scoped by the caller.** The domain never filters by month string; that is
  the repository's half-open range query. This is what structurally removes `startsWith` (latent bug #3)
  rather than relocating it.

### `lib/domain/budget.ts`

```ts
export function budgetProgress(spent: number, budgeted: number): BudgetProgress;
```

- `budgeted <= 0` → `hasBudget: false`, `barPct: 0`, `labelPct: 0`, `overBudget: false` (the design's
  neutral state). Otherwise `barPct = min(100, round(spent / budgeted * 100))`,
  `labelPct = round(spent / budgeted * 100)` uncapped, `remaining = budgeted - spent` (may be negative).

### `lib/domain/month.ts`

```ts
export function isMonthKey(value: string): value is MonthKey;
export function monthKeyOf(wallClock: Date): MonthKey;
export function monthKeyLabel(key: MonthKey): string;   // 'Agosto 2026'
export function prevMonthKey(key: MonthKey): MonthKey;  // '2026-01' → '2025-12'
export function monthRange(key: MonthKey): MonthRange;  // the half-open range
```

- `monthRange('2026-08')` → `{ start: 2026-08-01T00:00, endExclusive: 2026-09-01T00:00 }`, both
  wall-clock Dates. This is the **only** producer of month bounds; the transactions repository consumes
  it verbatim as `date >= start AND date < endExclusive`.
- `monthKeyLabel` returns Spanish product copy (`MONTHS_ES`). That is the single permitted Spanish
  string table in `lib/domain/`; the alternative is duplicating twelve month names across three screens.
- All four throw `RangeError` on a value failing `isMonthKey`.

### `lib/domain/time.ts`

```ts
export function nowInBuenosAires(): Date;
export function wallClockFromParts(
  year: number, month: number, day: number, hour: number, minute: number,
): Date;
```

- `nowInBuenosAires()` is the **only** permitted source of "now" server-side. Bare `new Date()` treated
  as local is banned (latent bug #2) and is caught by the ESLint `no-restricted-globals`-style rule plus
  review.
- Both return a `Date` whose **UTC** components are Buenos Aires wall-clock, per the `TZ=UTC` invariant.
  Tests inject a fixed instant with `vi.setSystemTime`, so they are deterministic.

### `lib/domain/transactions.ts`

```ts
export function filterTransactions(
  transactions: readonly DomainTransaction[],
  filters: TransactionFilters,
): DomainTransaction[];
export function sortTransactions(
  transactions: readonly DomainTransaction[],
  mode: SortMode,
): DomainTransaction[];
export function nextSortMode(mode: SortMode): SortMode;
```

- `nextSortMode` implements the 3-state cycle exactly: `date → amountDesc → amountAsc → date`.
- `sortTransactions` is stable and breaks ties on `id` descending, so equal amounts render in a
  deterministic order across renders and across server/client.
- `from`/`to` compare on the wall-clock **date part only**, inclusive at both ends, matching the design's
  `date.slice(0, 10)` semantics.

### `lib/domain/categories.ts`

```ts
export function orderCategories<T extends { id: number }>(
  categories: readonly T[],
  order: readonly number[],
): T[];
export function categoryColor(colorIndex: number): string;  // 'var(--accent-3)'
export const ACCENT_CYCLE_LENGTH: 6;
export function nextColorIndex(activeCategoryCount: number): number;
```

- `orderCategories` — known ids first in `order`'s sequence, then the remainder in input order. Ids in
  `order` that are absent from `categories` (archived) are skipped. Generic over `T` so it works on both
  full rows and view models without the domain knowing either shape.
- `categoryColor` returns a **CSS custom-property reference**, not a hex literal. See §7 — this is what
  makes theme-dependent colour impossible to get wrong at hydration time.

### `lib/domain/theme.ts`

```ts
export function isThemePreference(value: unknown): value is ThemePreference;
export function resolveTheme(
  preference: ThemePreference, systemPrefersDark: boolean,
): EffectiveTheme;
```

### `lib/domain/greeting.ts`

```ts
export function greeting(wallClock: Date): 'Buenos días' | 'Buenas tardes' | 'Buenas noches';
```

Boundaries at hour `< 12` and `< 19`, read from the wall-clock UTC components.

**Deferred to change 2 (recorded so it does not get reimplemented ad hoc):** `formatArs` and
`formatShortDate` (the design's `fmt` / `fmtDate`) land in `lib/domain/format.ts` when their first UI
consumer exists. They are pure and belong in the domain; they are simply not needed by any change-1
artifact.

---

## 6. Migration Strategy

`drizzle.config.ts`: `dialect: 'postgresql'`, `schema: './lib/db/schema.ts'`, `out: './drizzle'`,
`dbCredentials.url = process.env.DATABASE_URL`.

| Script | Command | Purpose |
|---|---|---|
| `db:generate` | `drizzle-kit generate` | Diffs `schema.ts`, emits SQL into `drizzle/`, **committed and reviewed in the PR** |
| `db:migrate` | `tsx lib/db/migrate.ts` | Applies pending migrations via `drizzle-orm/neon-http/migrator` |
| `db:seed` | `tsx lib/db/seed/default.seed.ts` | Production content: 18 expense + 3 income categories, 2 members. Idempotent — `ON CONFLICT DO NOTHING` against the partial unique index |
| `db:seed:dev` | `tsx lib/db/seed/dev.seed.ts` | Fixtures only; refuses to run when `DATABASE_URL` is not a Neon *branch* host |

**`drizzle-kit push` is banned.** It diffs live and can silently drop. Generate → review the SQL →
migrate is the only path.

**Migrations are run manually, never from `next build`.** Rationale: Vercel builds run per preview
deployment against whatever `DATABASE_URL` is bound to that environment — coupling migration to build is
precisely how a preview build migrates production. `pnpm db:migrate` is run against the target Neon
branch before promoting the deployment.

**Expand-contract, binding from change 2 onward** (once real household data exists):

1. **Expand** — add the nullable column or new table; deploy. Never in the same migration as its
   consumer.
2. **Backfill** — a separate, re-runnable script.
3. **Switch** — code reads/writes the new shape; deploy.
4. **Contract** — drop the old column in a *later* change, after the previous deployment is proven.

No `DROP COLUMN`, `DROP TABLE`, type narrowing, or `SET NOT NULL` on an existing column may ship in the
same migration as the code depending on it. Renames become add + backfill + drop across two changes —
`drizzle-kit` will offer a rename; refuse it.

---

## 7. Theming — No Flash, No Hydration Mismatch

Two cookies, both written by a Server Action (`app/actions/setTheme.ts`) or the boot script:

| Cookie | Value | Written by |
|---|---|---|
| `tm_theme` | `'dark' \| 'light' \| 'system'` | Server Action from the Perfil switch (change 3); default `'system'` |
| `tm_system_dark` | `'1' \| '0'` | the boot script, via `document.cookie` |

**Server render (no flash).** `app/layout.tsx` is a Server Component:

```
cookies().get('tm_theme')       → validated by isThemePreference, default 'system'
cookies().get('tm_system_dark') → '1' | '0', default '1' (design's systemPrefersDark: true)
resolveTheme(pref, systemDark)  → 'dark' | 'light'
<html lang="es" data-theme={resolved} data-theme-pref={pref} suppressHydrationWarning>
```

The first byte of HTML already carries the correct `data-theme`, so the correct palette paints
immediately. This is the whole reason theme lives in a cookie rather than `localStorage` (obs #95, Q8).

**`'system'` on the client, without a mismatch.** A small blocking inline script in `<head>` (before
first paint) reads `matchMedia('(prefers-color-scheme: dark)')`. If `data-theme-pref === 'system'` and
the OS answer differs from the server's guess, it corrects `documentElement.dataset.theme` and writes
`tm_system_dark` so every subsequent server render is already right. A `matchMedia` `change` listener
mounted in the shell keeps it live.

**Why there is no hydration mismatch:**

1. The theme exists *only* as an attribute on `<html>`, which carries `suppressHydrationWarning` — the
   established App Router pattern for pre-hydration DOM correction.
2. **No React component reads the effective theme during render.** All colours — including the two
   accent cycles — are CSS custom properties declared twice in `app/globals.css`, under
   `[data-theme='light']` and `[data-theme='dark']`. `categoryColor(colorIndex)` returns
   `var(--accent-N)`, so the same string renders on server and client and the browser resolves the
   palette. Rejected returning a hex literal from `categoryColor`: it would force the effective theme
   into React render state, which is exactly the value the server cannot know for `'system'` — a
   guaranteed mismatch on every category card.

The two accent cycles from obs #59 therefore live in `app/globals.css` only, with
`ACCENT_CYCLE_LENGTH = 6` in the domain as the single numeric coupling, asserted by a unit test on the
modulo wrap.

---

## 8. Rollback Plan

**Schema migration.** This is the first migration against an empty Neon database, so rollback is
lossless. In order of preference: (1) delete and recreate the Neon **branch** — the migration is applied
to a branch for the preview deployment before promoting, so discarding the branch discards everything;
(2) revert the migration commit and run the hand-written `DROP TABLE card_order, budgets, transactions,
categories, members; DROP TYPE transaction_type, category_kind;` recorded alongside the migration.
`drizzle-kit` does not generate down migrations, so the drop script is authored in this change and
checked in next to `drizzle/0000_*.sql`. Reverting the domain core without reverting the schema is safe;
the reverse is not — revert them together. **From change 2 onward this rollback path is void**; real
household data exists and only expand-contract applies.

**Auth change.** Revert `proxy.ts`, delete `APP_PASSWORD` and `SESSION_SECRET` from the Vercel
project, redeploy — or use Vercel instant rollback to the previous deployment. This leaves the app open,
acceptable **only in this change** because no household data exists yet. In any later change, reverting
auth requires taking the deployment offline instead.

**Deployment.** Vercel instant rollback; no data migration is coupled to the redeploy, because
migrations are deliberately decoupled from `next build` (§6).

---

## Data Flow

```
  Request ──→ proxy.ts (Edge) ──→ verify tm_session (Web Crypto HMAC)
                    │ invalid                      │ valid
                    ▼                              ▼
              /login (public)            app/(shell)/<tab>/page.tsx   [Server Component]
                    │                              │
              login Server Action                  ├─→ lib/db/repositories/*  ──→ Drizzle ──→ neon-http ──→ Neon (pooled)
              (Node: timingSafeEqual)              │          │ archived_at IS NULL
                    │                              │          │ date >= start AND date < endExclusive
              set tm_session ──────────────────────┘          │
                                                              ▼
                                                    lib/domain/*  (pure — no React, no Drizzle)
                                                              │
                                                              ▼
                                          components/ui | molecules | organisms  (presentational)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs` | Create | Scaffolding, **pnpm only**; import-zone lint rules; `TZ=UTC` in dev/build/test scripts |
| `vitest.config.ts` | Create | Node environment, `lib/**/*.test.ts` |
| `lib/env.ts` | Create | Env validation, `assertProcessTimezoneUtc()` |
| `lib/db/schema.ts` | Create | 5 tables, 2 enums, checks, partial uniques, 4 indexes |
| `lib/db/client.ts` | Create | `neon-http` client, `assertPooledNeonUrl`, `server-only` |
| `lib/db/migrate.ts`, `drizzle.config.ts`, `drizzle/0000_*.sql`, `drizzle/0000_rollback.sql` | Create | Migration workflow + hand-authored drop script |
| `lib/db/repositories/*.repository.ts` | Create | 5 adapters; the only Drizzle consumers |
| `lib/db/seed/{default,dev}.seed.ts` | Create | Production content vs fixtures |
| `lib/domain/{types,money,balance,budget,month,time,transactions,categories,theme,greeting}.ts` | Create | Pure core |
| `lib/domain/*.test.ts`, `lib/domain/architecture.test.ts` | Create | Unit tests + import-direction assertion |
| `lib/auth/session.ts` | Create | Sign (Node) / verify (Web Crypto) |
| `proxy.ts` | Create | Shared-password gate |
| `app/layout.tsx`, `app/globals.css` | Create | Theme cookie read, boot script, CSS custom properties incl. both accent cycles |
| `app/login/page.tsx`, `app/actions/{login,setTheme}.ts` | Create | Login screen + Server Actions |
| `app/(shell)/layout.tsx` + 4 `page.tsx` | Create | 430px shell, placeholder screens |
| `components/ui/*`, `components/organisms/BottomNav.tsx` | Create | Shell atoms, nav + FAB |
| `docs/design/**` | Unchanged | Reference only, never imported |

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit (domain) | Every `lib/domain/` function | Vitest, no mocks needed — all pure. Cases from obs #59: cashback `max(0, …)` and expenses only; `totalBalance` over all transactions ever; bar capped at 100 / label uncapped; over-budget flag flips at `spent > budgeted`; sort cycle `date → amountDesc → amountAsc`; `prevMonthKey` across a year boundary; `monthRange` is half-open at both February and December. |
| Unit (guards) | `assertPooledNeonUrl`, `isMonthKey`, session sign/verify | Table-driven: direct Neon host, non-Neon host, missing `sslmode`, tampered signature, expired `exp`. |
| Architecture | Import direction | `lib/domain/architecture.test.ts` scans source text for forbidden specifiers. |
| Integration | Repositories | **Deferred** — no Neon test branch is provisioned in this change; repository queries are proven by the deployed preview against a Neon branch (success criteria) rather than by an automated suite. Recorded as a risk. |
| E2E | Auth gate, nav | **Deferred** per `openspec/config.yaml` (`playwright: defer until core flows exist`). The auth gate is verified manually against the preview deployment. |

## Threat Matrix

The trigger is **HTTP routing** (`proxy.ts`). The reference matrix's rows cover shell, Git, and PR
automation, none of which this change touches.

| Boundary | Applicability | Design response |
|---|---|---|
| Documentation-like paths | **N/A** — no file is classified or executed by path; nothing is interpreted as a script. | — |
| Git repository selection | **N/A** — no Git invocation in the shipped code. | — |
| Commit state | **N/A** — no VCS automation. | — |
| Push state | **N/A** — no VCS automation. | — |
| PR commands | **N/A** — no PR automation. | — |

Routing-specific cases, which **do** apply and MUST carry into `tasks.md` as RED tests before the
middleware is written:

| Case | Expected safe behavior | Failure behavior |
|---|---|---|
| Absent / malformed / unsigned `tm_session` | 307 → `/login?next=<path>` | never `next()` |
| Signature valid, `exp` in the past | cookie deleted, 307 → `/login` | never `next()` |
| Signature tampered (payload edited, sig kept) | rejected by HMAC verify | never `next()` |
| `?next=//evil.com`, `/\evil.com`, `https://evil.com` | rejected; redirect to `/inicio` | no open redirect |
| `/login` with a valid cookie | 307 → `/inicio` | no redirect loop |
| Matcher bypass attempts (`/inicio/`, `/INICIO`, `/inicio/../perfil`) | all gated | no unauthenticated route reaches a repository |
| `DATABASE_URL` set to a direct (non-`-pooler`) Neon host | module-load throw naming the host | never opens a direct connection |

## Open Questions

- [x] **RESOLVED (orchestrator, 2026-09-02).** The seed is **21 category rows — 18 `kind = 'expense'`
      + 3 `kind = 'income'`** ("Sueldo", "Regalo", "Otro"), in one table discriminated by `kind`. The
      design was correct and the earlier "18 categories" wording was wrong: obs #59 records
      `incomeCategories` as a separate fixed list the add/edit sheet requires, so seeding only 18
      would make income transactions unrecordable. `proposal.md` (Scope + Seed data decision) and
      `specs/data-persistence/spec.md` (Requirement: Seed data, plus a new income-category scenario)
      have both been corrected to 21. No further action.
- [x] **RESOLVED (orchestrator, 2026-09-02).** `SESSION_SECRET` rotation invalidating every session
      at once is ACCEPTED as designed. With a single shared password and two users, re-entering the
      password is the entire recovery cost. A versioned-key scheme is explicitly out of scope for
      this change and MUST NOT be added speculatively.
