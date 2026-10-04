# Design: Port Ledger — Movimientos, Presupuesto, and the Add/Edit Sheet

> **Inputs.** `proposal.md` (decisions Q1–Q13 are final), Engram `sdd/port-ledger/explore` (obs #995),
> the archived `port-foundation` design (conventions: three rings, import zones, `TZ=UTC` wall-clock
> invariant), and the spec deltas under `specs/` as they existed when this design was written.
>
> **Next.js docs consulted** (installed `next@16.3.4`, `node_modules/next/dist/docs/01-app/`):
> `03-api-reference/04-functions/cookies.md` (async `cookies()`, `.set` only in Server Functions),
> `03-api-reference/03-file-conventions/page.md` (`searchParams` is a `Promise`, plain object, makes
> the page dynamic), `03-api-reference/04-functions/revalidatePath.md` (in a Server Function it
> updates the UI immediately; literal paths omit `type`), `03-api-reference/04-functions/refresh.md`,
> `03-api-reference/01-directives/use-server.md` (return values are serialized; return only what the
> UI needs), `02-guides/interactive-apps.md` (`useOptimistic` resets to the base value when the
> transition ends; `useActionState`; post-`await` state updates need `startTransition`), and
> `02-guides/data-security.md` §"Server Actions" (every action is reachable by direct POST; verify
> auth inside each one). `cacheComponents` is **not** enabled in `next.config.ts`, so no `'use cache'`,
> `cacheTag`, or `updateTag` is used.
>
> **Schema decisions: none.** No table, column, index, constraint, or enum changes. The existing
> `transactions` checks (`cashback_bps` range, income-no-cashback, `amount <= gross`), the
> constant-default `user_id = 'household'` column, and `budgets_month_category_uq` already support
> every operation. No file is added under `drizzle/`.
>
> **Auth flow: unchanged** (single shared password, `proxy.ts` gate). This change adds a
> defense-in-depth session check inside every mutating Server Action (Decision 9).

## Technical Approach

The three rings from change 1 stay intact and enforced (`lib/domain/architecture.test.ts`, ESLint
zones, `server-only`):

```
app/(shell)/**/page.tsx, layout.tsx  ← containers (Server Components): read URL + cookies, call
app/actions/*.ts                       repositories, compute via domain, map to view models
        │
components/{ui,molecules,organisms,screens}  ← presentational; 'use client' only for interaction
        │
lib/view/*            ← NEW: pure view-model mappers + URL (de)serialization (no db, no React)
lib/db/repositories/* ← the only Drizzle consumers (+ new by-id reads, update/delete, copy)
lib/domain/*          ← pure rules (+ format, validation, copy plan, clamp, nextMonthKey)
```

- **URL search params are the source of truth** for month, filters, and sort. Pages await
  `searchParams`, parse them with pure helpers, call the repository with `monthRange()`, then apply
  `filterTransactions` / `sortTransactions` / `budgetProgress`.
- **Client islands only where interaction demands it:** the sheet provider + sheet, the filter
  controls, the optimistic ledger list, and the budget row forms. The month stepper and sort toggle
  are plain `<Link>`s rendered on the server (zero client JS).
- **Server Actions** authenticate, validate with pure `lib/domain` helpers, check references against
  repositories, compute net with `computeNetAmount`, write with one SQL statement, set the
  last-used-member cookie, call `revalidatePath` for affected tabs, and return a serialized view of
  the **persisted** row.

## Architecture Decisions

### Decision 1: Sheet wiring — one context provider in the shell layout

**Choice**: `app/(shell)/layout.tsx` becomes an `async` Server Component that fetches the picker data
(`listActiveCategories()`, `listActiveMembers()` in parallel) and the last-used-member cookie, and
renders `<EntrySheetProvider categories members defaultMemberId>` around `<main>`, `<BottomNav />`,
and `<EntrySheet />`. The provider (`'use client'`) owns `{ open, mode, editingRow }` and exposes
`openCreate()`, `openEdit(row)`, `close()`, plus the ledger optimistic overlay (Decision 5) through
`useEntrySheet()`. `BottomNav`'s FAB calls `openCreate()`; `LedgerList` rows call `openEdit(row)`.
`useEntrySheet()` throws outside the provider (fail loud).

**Alternatives considered**: (a) an intercepting/parallel route `@sheet/(.)nuevo` — gives a URL per
sheet state, but adds two route segments, a `default.tsx`, and back-button semantics nobody asked
for, and the FAB must work on all four tabs; (b) a global store (Zustand) — new dependency for one
boolean and one row; (c) the sheet fetching its own pickers client-side — needs a Route Handler and
a loading state on every open.

**Rationale**: The FAB is already in a client component under a server layout; a provider is the
smallest boundary that lets it share state with the sheet. Pickers are server-fetched once per
request in the layout, so the sheet opens instantly. Pages remain Server Components.

### Decision 2: Server Action contracts — FormData in, typed state out

**Choice**: Two `'use server'` modules. Result/state types and their `INITIAL_*` constants live in
`lib/actions/state.ts`, because a `'use server'` module may export async functions only (same reason
`lib/auth/loginState.ts` exists).

| Action | Signature | Used by |
|---|---|---|
| `createTransactionAction` | `(prev: TransactionFormState, form: FormData) => Promise<TransactionFormState>` | sheet, create mode |
| `updateTransactionAction` | `(prev: TransactionFormState, form: FormData) => Promise<TransactionFormState>` | sheet, edit mode (`id` hidden field) |
| `deleteTransactionAction` | `(id: unknown) => Promise<DeleteResult>` | sheet confirmation |
| `upsertBudgetAction` | `(prev: BudgetFormState, form: FormData) => Promise<BudgetFormState>` | add-row form, per-row amount form |
| `removeBudgetAction` | `(month: unknown, categoryId: unknown) => Promise<BudgetMutationResult>` | row remove button |
| `copyBudgetsAction` | `(month: unknown) => Promise<CopyResult>` | copy button |

Parameters typed `unknown` are deliberate: actions are reachable by direct POST, so every argument is
re-validated (`Number.isSafeInteger(id) && id > 0`, `isMonthKey(month)`).

Every action body follows the same order, with no exceptions:

```
1. await assertSession()                       // Decision 9 — before ANY read or write
2. raw = readForm(formData)                    // FormData → Record<string, string | undefined>
3. parsed = parseTransactionForm(raw)          // pure, lib/domain/validation.ts
   └─ !ok → return { status: 'error', fieldErrors }        (no write, no cookie)
4. reference reads (getCategoryById, getMemberById, getTransactionById for update)
5. refErrors = checkTransactionReferences(...) // pure, lib/domain/validation.ts
   └─ any → return { status: 'error', fieldErrors }
6. amount = computeNetAmount({ type, gross, cashbackBps })  // the ONLY net computation
7. row = await createTransaction | updateTransaction        // one SQL statement
   └─ null (update of a vanished id) → return { status: 'error', formError: NOT_FOUND }
8. (await cookies()).set(LAST_MEMBER_COOKIE, String(memberId), …)   // create AND update (spec)
9. revalidatePath('/movimientos'); revalidatePath('/presupuesto'); revalidatePath('/inicio')
10. return { status: 'saved', row: toLedgerRowView(row, categoryLabel, memberLabel) }
```

Any `amount` field present in the submitted form is never read (spec: client-supplied net is
ignored). Unexpected throws (DB down) are caught at step 7 and mapped to a generic Spanish
`formError`; validation never throws.

**Alternatives considered**: a single `saveTransactionAction` branching on `id` — hides two distinct
authorization/reference rules (Q7 applies only on update) in one body; JSON-argument actions instead
of `FormData` — loses progressive `form action` wiring and `useActionState`.

**Rationale**: `useActionState` (interactive-apps guide, Step 6) gives pending state, preserved field
values, and error state for free. Returning the persisted view (not the raw DB row, per
`use-server.md`) is what lets the client reconcile without computing net.

### Decision 3: Validation location — pure parsers in `lib/domain/validation.ts`

**Choice**: All input rules (Q8, Q9) are pure functions returning a discriminated result and
**never throwing**. Spanish error messages live in `lib/domain/messages.ts` (`VALIDATION_MESSAGES`),
because the `financial-domain-rules` spec requires the helpers to return per-field Spanish messages.
Reference rules that need DB facts are also pure: the action loads the facts, the domain decides.

```ts
// lib/domain/validation.ts
export type TransactionField = 'type' | 'gross' | 'cashback' | 'categoryId' | 'memberId' | 'date' | 'id';
export type FieldErrors<F extends string> = Partial<Record<F, string>>;
export type ParseResult<T, F extends string> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors<F> };

export interface RawTransactionForm {
  id?: string; type?: string; gross?: string; cashback?: string;
  categoryId?: string; memberId?: string; date?: string;
}
export interface ParsedTransactionInput {
  type: TransactionType; gross: number; cashbackBps: number;
  categoryId: number; memberId: number; date: Date;  // wall-clock
}

export function parseWholePesos(raw: string | undefined): ParseResult<number, 'value'>;
export function parseCashbackBps(raw: string | undefined): ParseResult<number, 'value'>;
export function parseTransactionForm(
  raw: RawTransactionForm,
): ParseResult<ParsedTransactionInput, TransactionField>;   // no clock: an empty date is an error, never defaulted
export function parseBudgetAmount(raw: string | undefined): ParseResult<number, 'amount'>;
export function parsePositiveId(raw: unknown): number | null;

export interface ReferenceFacts {
  type: TransactionType;
  category: { id: number; kind: TransactionType; archived: boolean } | null;
  member: { id: number; archived: boolean } | null;
  existing: { categoryId: number; memberId: number } | null;   // null on create
}
export function checkTransactionReferences(facts: ReferenceFacts): FieldErrors<TransactionField>;
export function checkBudgetCategory(
  category: { kind: TransactionType; archived: boolean } | null,
  hasRowThisMonth: boolean,
): string | null;
```

Parsing rules (exact):

| Field | Accepted | Notes |
|---|---|---|
| `gross` | trimmed `^\d+$`, value `1..999_999_999` | `.`/`,` anywhere → "no decimals" message; `0`, `-5`, `abc`, empty → their own messages. Upper bound keeps far below `int4` max. |
| `cashback` | empty → `0`; `^\d{1,3}([.,]\d{1,2})?$`, value `0..100` | Converted **by string arithmetic**: `int * 100 + fraction padded to 2 digits`, so `"0.29"` → 29 and `"1.15"` → 115 exactly (spec "floating-point safety"). `percentToBps` (float) is not used on the write path. |
| `cashback` when `type = 'income'` | ignored, forced to `0` | Spec "Income forces cashback to zero"; a stale value never blocks an income save. |
| `type` | `'expense' \| 'income'` | |
| `categoryId`, `memberId`, `id` | positive safe integers | |
| `date` | `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$`, year `2000..2099`, round-trip valid | Decision 6. Empty → **error** (spec "empty date rejected"). The parser takes no clock; "now" exists only as the sheet's create default (Decision 6), never as a server-side fallback. |
| budget `amount` | same as `gross` | `"1.5"`, `"0"`, `"-3"`, `""` rejected. |

`checkTransactionReferences` rules:

- category missing → "La categoría elegida ya no existe."; `kind !== type` → kind-mismatch message.
- category archived → allowed **only** on update when `category.id === existing.categoryId` (Q7),
  otherwise "La categoría elegida ya no está disponible." Same rule for the member.

**Alternatives considered**: zod — rejected in change 1 for the same reason (a dependency for a
handful of assertions); validation inside the action file — untestable without mocking Next; error
*codes* mapped to copy in the UI — cleaner layering, but contradicts the spec wording and adds a
mapping layer for two screens.

**Rationale**: Pure, table-testable in Node with zero mocks; the architecture test keeps passing
because none of these files import React, Next, Drizzle, or `lib/db`. `messages.ts` is kept as a
second sanctioned Spanish table in the domain (after `MONTHS_ES`), because the spec requires the
helpers themselves to return Spanish messages; its header comment states why.

**Task-level note**: the comment at `lib/domain/month.ts:3-5` currently calls `MONTHS_ES` "The single
permitted Spanish string table in `lib/domain/`". The task that creates `messages.ts` MUST also
update that comment so it names both sanctioned tables (`MONTHS_ES` and `VALIDATION_MESSAGES`) and
no longer claims exclusivity.

### Decision 4: Repository additions on `neon-http` — single statements only

**Choice**: Every write is exactly one SQL statement, so atomicity never depends on a transaction.
`db.batch` is available on `neon-http` but is **not needed** by any operation in this change.

| Repository | Function | SQL shape |
|---|---|---|
| `transactions` | `getTransactionById(id, userId)` → `DomainTransaction \| null` | `SELECT … WHERE user_id = $u AND id = $id` |
| `transactions` | `updateTransaction(id, input: NewTransaction, userId)` → `DomainTransaction \| null` | `UPDATE … SET … WHERE user_id = $u AND id = $id RETURNING …` (null = vanished) |
| `transactions` | `deleteTransaction(id, userId)` → `boolean` | `DELETE … WHERE user_id = $u AND id = $id RETURNING id` (false = already gone; not an error) |
| `budgets` | `deleteBudget(month, categoryId, userId)` → `boolean` | `DELETE … WHERE user_id, month, category_id` — never touches `transactions` |
| `budgets` | `copyMissingBudgets(rows: PlannedBudgetRow[], toMonth, updatedAt, userId)` → `number` | see below |
| `categories` | `getCategoryById(id, userId)` → `CategoryLabel \| null` | includes archived; `DO NOT ADD` comment |
| `members` | `getMemberById(id, userId)` → `MemberLabel \| null` | includes archived; `DO NOT ADD` comment |

Fill-missing copy (Q5) follows the `data-persistence` contract ("inserts planned rows while skipping
conflicts"): the **domain plans**, the **repository inserts the plan** in one statement.

```ts
// lib/domain/budget.ts
export interface PlannedBudgetRow { categoryId: number; amount: number }
export function planBudgetCopy(
  previous: readonly { categoryId: number; amount: number }[],   // prev month's budgets
  current: readonly { categoryId: number }[],                    // selected month's budgets
  activeExpenseCategoryIds: ReadonlySet<number>,
): PlannedBudgetRow[];   // previous rows whose category is active+expense and absent from current
```

`copyBudgetsAction(month)` flow:

```
assertSession → isMonthKey(month) → prev = prevMonthKey(month)
getBudgetsForMonth(prev) ∥ getBudgetsForMonth(month) ∥ listActiveCategoriesByKind('expense')
rows = planBudgetCopy(prevRows, currentRows, new Set(activeExpense.map(c => c.id)))
rows.length === 0 → return { status: 'nothing' }   // "No hay categorías para copiar."; repository NOT called
count = copyMissingBudgets(rows, month, nowInBuenosAires())   // one statement
revalidatePath('/presupuesto'); revalidatePath('/inicio')
return { status: 'copied', count }
```

`copyMissingBudgets` is a **single multi-row** statement, so it is atomic on `neon-http` without a
transaction:

```sql
INSERT INTO budgets (user_id, month, category_id, amount, updated_at)
VALUES ($u, $toMonth, $c1, $a1, $t), ($u, $toMonth, $c2, $a2, $t), …
ON CONFLICT (user_id, month, category_id) DO NOTHING      -- budgets_month_category_uq
RETURNING category_id;
```

Implemented with Drizzle's `db.insert(budgets).values(rows.map(r => ({ userId, month: toMonth, ...r, updatedAt }))).onConflictDoNothing({ target: [budgets.userId, budgets.month, budgets.categoryId] }).returning({ categoryId: budgets.categoryId })`
(the same target already used by `upsertBudget`). The function returns `0` without issuing SQL when
`rows` is empty (defensive; the action never calls it with an empty plan). The returned row count is
the inserted count. Idempotence is structural twice over: a second plan is empty because the rows
now exist, and any row that does slip through conflicts and is skipped. The copy never updates or
deletes an existing row.

**Accepted race**: the plan is read, then written. A category archived (or a row added by another
device) between the read and the write is handled as follows: a concurrently added row is protected
by `ON CONFLICT DO NOTHING`; a category archived in that window may still receive one copied budget
row. This is accepted: archive is a soft delete, the row stays labeled "(en archivo)", and it remains
editable and removable (spec). Two household users and sub-second windows make it practically
unobservable.

`getCategoryById` / `getMemberById` join the "must-include-archived" set: `archiveReads.test.ts`
EXPECTATIONS gains both, and both bodies carry the `DO NOT ADD` warning and
`archived: archivedAt !== null` the test asserts. `archiveCategory`-style tables stay in sync because
that test fails if an exported function is missing from the table.

**Alternatives considered**: a server-side `INSERT … SELECT … JOIN categories … ON CONFLICT DO
NOTHING` that filters archived/non-expense categories in SQL — one round trip and no read/write
window, but **rejected because it diverges from the spec contract**: `data-persistence` requires the
repository to insert *planned rows*, and `financial-domain-rules` requires the pure helper to own the
skip rules, so moving them into SQL would duplicate the rule in two places and leave the domain
helper decorative. `db.batch([delete, insert])` "replace" semantics — explicitly rejected by Q5.

**Rationale**: `neon-http` has no interactive transactions (change-1 design §1). One multi-row
`INSERT … VALUES … ON CONFLICT DO NOTHING RETURNING` gives atomicity and the inserted count in one
statement, while the skip rules stay in one pure, table-tested function.

A source-level guard test `lib/db/repositories/budgetCopy.test.ts` (same technique as
`archiveReads.test.ts`) asserts the body of `copyMissingBudgets` uses `.values(`,
`onConflictDoNothing` with the `[budgets.userId, budgets.month, budgets.categoryId]` target, and
`.returning(`, and contains **no** `onConflictDoUpdate`, `.update(`, `.delete(`, or `.select(` call,
so the copy can never overwrite, remove, or re-derive rows outside the domain plan.

### Decision 5: `useOptimistic` strategy — an overlay with a constant empty base

**Choice**: The provider holds one overlay, not a copy of the list:

```ts
// lib/view/ledgerOverlay.ts  (pure)
export interface LedgerOverlay {
  pendingIds: readonly number[];
  removedIds: readonly number[];
  replaced: Readonly<Record<number, LedgerRowView>>;   // ONLY server-returned rows
}
export type OverlayAction =
  | { kind: 'pending'; id: number }
  | { kind: 'remove'; id: number }
  | { kind: 'replace'; row: LedgerRowView };
export const EMPTY_OVERLAY: LedgerOverlay;
export function reduceOverlay(overlay: LedgerOverlay, action: OverlayAction): LedgerOverlay;
export function applyOverlay(rows: readonly LedgerRowView[], overlay: LedgerOverlay):
  Array<LedgerRowView & { pending: boolean }>;
```

```ts
// EntrySheetProvider
const [overlay, dispatchOverlay] = useOptimistic(EMPTY_OVERLAY, reduceOverlay);
```

Flows (all inside the form action / transition):

| Flow | Before `await` | After a successful `await` | On error |
|---|---|---|---|
| Edit | `dispatchOverlay({ kind: 'pending', id })` — row dims | `startTransition(() => { dispatchOverlay({ kind: 'replace', row: result.row }); close(); })` | transition ends → overlay resets to empty → row shows persisted values; sheet stays open with field errors |
| Delete (after confirm) | `dispatchOverlay({ kind: 'remove', id })` — row disappears | `startTransition(close)` | row reappears; inline error in the sheet |
| Create | none (a new row's month/filters/position are unknown client-side) | `startTransition(close)` | sheet stays open with errors |

Because the base state is the constant `EMPTY_OVERLAY`, the overlay clears itself when the
transition ends, exactly when the action's `revalidatePath` RSC payload has replaced the server
rows (interactive-apps guide, Step 4 "pending list resets to empty"). `LedgerList` renders
`applyOverlay(rows, overlay)`. The client inserts only values the server returned; it never computes
a stored net.

The sheet **does** show a display-only preview ("Gasto final $31.000 · ahorro $2.333") using the pure
`computeNetAmount` on the client — the same function and rounding the server uses, so the preview
cannot disagree with the stored value. It is never submitted.

Budget rows use local `useOptimistic` in `BudgetList`: optimistic remove (row hidden) and optimistic
amount (the user's own typed integer — no computation). Progress bars update on revalidation.

**Alternatives considered**: `useOptimistic(rows, reducer)` inside `LedgerList` — the sheet that
triggers mutations is outside `LedgerList`'s subtree, so the setter would need to be lifted anyway;
client-side recomputation of the edited row (net, filters, sort position) — violates "client never
computes the stored net" and duplicates server logic.

**Rationale**: Smallest state that satisfies "applied optimistically, reverts on rejection,
reconciles with the persisted row" (ledger spec "Edit from the list").

### Decision 6: Date/time — `datetime-local` + wall-clock parts, never `new Date(string)`

**Choice**: Two new pure functions in `lib/domain/time.ts`:

```ts
export function toDateTimeLocalValue(wallClock: Date): string;            // 'YYYY-MM-DDTHH:mm' from UTC components
export function parseDateTimeLocal(value: string): Date | null;           // regex → wallClockFromParts → round-trip check
```

- `parseDateTimeLocal` matches `^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$`, builds the
  Date **only** via `wallClockFromParts(y, m, d, h, min)`, and returns `null` unless the result's UTC
  components equal the inputs (rejects `2026-02-30T10:00`). Seconds, if a browser sends them, are
  dropped. `new Date(string)` and `Date.parse` are banned here: they interpret the string in the
  process zone, which is the latent-bug-#2 class this project eliminated.
- **Create default**: the sheet computes `toDateTimeLocalValue(nowInBuenosAires())` **in
  `openCreate()`** (an event handler), never during render, so there is no hydration mismatch.
  `nowInBuenosAires` is pure and correct in any browser zone because it shifts the epoch and reads UTC
  components.
- **Edit**: the row view carries `dateValue = toDateTimeLocalValue(tx.date)`. If the submitted value
  equals the existing row's `toDateTimeLocalValue(existing.date)`, the action keeps
  `existing.date` (preserves seconds; an untouched date is not rewritten).
- Inputs are `type="datetime-local"`; the server validates regardless.

**Alternatives considered**: separate date and time inputs — two fields for one value on a phone;
storing a client-supplied ISO string — reintroduces offset ambiguity.

**Rationale**: Spec "Entered wall-clock value stored unchanged" and "Default is Buenos Aires now"
(2026-08-15T00:00Z → `2026-08-14T21:00`) both fall out of UTC-component arithmetic under the
`TZ=UTC` invariant.

### Decision 7: URL search-param schema

**Choice**: English identifiers (code rule), defaults omitted from the URL (one canonical URL per
state), invalid values silently fall back to defaults (spec "Invalid month param falls back").

| Screen | Param | Values | Default (omitted) |
|---|---|---|---|
| both | `month` | `YYYY-MM` (`isMonthKey`) | current BA month: `monthKeyOf(nowInBuenosAires())` |
| Movimientos | `type` | `expense` \| `income` | all |
| Movimientos | `category` | positive integer id | all |
| Movimientos | `member` | positive integer id | all |
| Movimientos | `from`, `to` | `YYYY-MM-DD`, clamped to the month (Q13) | unset |
| Movimientos | `sort` | `amount-desc` \| `amount-asc` | `date` (newest first) |

```ts
// lib/view/ledgerQuery.ts  (pure)
export interface LedgerQuery { month: MonthKey; filters: TransactionFilters; sort: SortMode }
export function parseLedgerQuery(
  raw: Record<string, string | string[] | undefined>, currentMonth: MonthKey): LedgerQuery;
export function ledgerHref(query: LedgerQuery): string;                  // '/movimientos?…'
export function withMonth(query: LedgerQuery, month: MonthKey): LedgerQuery; // clears from/to (Q13)
export function withSort(query: LedgerQuery, sort: SortMode): LedgerQuery;
export function clearFilters(query: LedgerQuery): LedgerQuery;          // keeps month + sort
// lib/view/budgetQuery.ts
export function parseBudgetMonth(raw: …, currentMonth: MonthKey): MonthKey;
export function budgetHref(month: MonthKey): string;
```

- Array values (`?type=a&type=b`) take the first element.
- `SortMode` stays `'date' | 'amountDesc' | 'amountAsc'` in the domain; only the URL uses kebab
  values (`amount-desc`), mapped in `lib/view/ledgerQuery.ts`.
- Clamping uses the new domain helper `clampDateFilters(month, from, to)` (spec requirement), whose
  output feeds `filterTransactions` unchanged. Dates are clamped at parse time, and the clamped values
  are what the date inputs display (`min`/`max` are also set to the month bounds).
- Month stepper ‹ › and the sort toggle are server-rendered `<Link href={ledgerHref(…)}>`
  (push navigation, so Back walks months). Filter controls call
  `router.replace(ledgerHref(…), { scroll: false })` inside `startTransition`, with a
  `useOptimistic` selected value + `data-pending` attribute (interactive-apps guide, Step 3).
  Filters receive the parsed `LedgerQuery` as a prop rather than calling `useSearchParams`, so the
  server parse is the single interpretation of the URL.

**Rationale**: Q1/Q4/Q13 plus "survives reload" are satisfied by construction; nothing about the
view lives in client state.

### Decision 8: Last-used member cookie

**Choice**: `lib/members/cookies.ts` exports `LAST_MEMBER_COOKIE = 'tm_last_member'` and
`LAST_MEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 365`. Written by `createTransactionAction` and
`updateTransactionAction` **only after a successful write** (spec), with
`{ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge }`. Read in the shell layout via
`(await cookies()).get(…)`; resolved by a pure helper:

```ts
// lib/domain/members.ts
export function resolveDefaultMemberId(
  cookieValue: string | undefined, activeMemberIds: readonly number[]): number | null;
```

Returns the cookie id if it is an active member, else the first active member (`listActiveMembers`
orders by name), else `null` (sheet shows "No hay personas activas." and disables submit). The
provider also keeps `lastMemberId` in state and updates it from a successful save, so a second
create in the same session preselects correctly before any re-render. Edit mode never uses it.

**Alternatives considered**: `localStorage` — unreadable during the server render (the theme
decision in change 1 rejected it for the same reason); `httpOnly: false` — no client code reads it.

### Decision 9: Authenticate inside every mutating Server Action

**Choice**: New `lib/auth/requireSession.ts`:

```ts
export class UnauthorizedError extends Error {}
export async function assertSession(): Promise<void>;  // cookies() → verifySession() → throw on null
```

Called as the first statement of all six actions, before any parsing, read, or write.

**Scope status**: this is **security hardening beyond the specs**. No spec delta requires an in-action
session check (the auth flow itself is unchanged); it is kept deliberately as defense in depth. Its
RED tests (absent / tampered / expired session → `UnauthorizedError`, and no repository mock called,
for each of the six actions; plus `assertSession` unit tests) MUST be carried into `tasks.md` as
explicit tasks, written before the actions, even though no spec scenario names them.

**Rationale**: `data-security.md` states every exported Server Action is reachable by a direct POST
and must verify auth itself. `proxy.ts` deliberately lets `/login` through untouched, so a POST to
`/login` carrying a `Next-Action` header must not be able to reach a repository. The check is cheap
(Web Crypto HMAC, no DB read). `setTheme` and `login` are unchanged (public by design).

### Decision 10: `lib/domain` additions

| File | Additions |
|---|---|
| `format.ts` (new) | `formatArs(amount)`: `$` + `.` thousands grouping, leading `-` for negatives (`-$5.000`), no rounding, **manual grouping** (not `toLocaleString`, so server and browser ICU can never disagree at hydration). `formatSignedArs(type, amount)`: `-$31.000` / `+$50.000`. `formatShortDate(wallClock)`: `14 ago · 21:00` from UTC components. `formatPercent(bps)`: `7`, `7,5`, `7,25` (comma decimal, trailing zeros trimmed); used for the row tag and the edit seed. |
| `month.ts` | `nextMonthKey(key)` (symmetric to `prevMonthKey`); `monthAbbrev(month1Based)` = `MONTHS_ES[m-1].slice(0,3).toLowerCase()` → `ene … dic` (derived; no new string table). |
| `time.ts` | `toDateTimeLocalValue`, `parseDateTimeLocal` (Decision 6). |
| `transactions.ts` | `clampDateFilters(month, from, to)` → `{ from, to }`. |
| `budget.ts` | `PlannedBudgetRow`; `planBudgetCopy(previous, current, activeExpenseCategoryIds)` → `PlannedBudgetRow[]` (Decision 4). |
| `members.ts` (new) | `resolveDefaultMemberId`. |
| `validation.ts` (new) | Decision 3. |
| `messages.ts` (new) | `VALIDATION_MESSAGES` — every server-produced Spanish error string. |

### Decision 11: View models in `lib/view/` (pure, outside the domain)

**Choice**: Mapping repository rows + labels to render-ready, serializable props happens in
`lib/view/*.ts`: plain TS, imports `lib/domain` and repository **types only** (`import type`),
never `lib/db/client`, never React. Both pages and actions use the same mapper, so the row an action
returns is byte-identical in shape to the row the page renders.

```ts
// lib/view/ledger.ts
export interface LedgerRowView {
  id: number; type: TransactionType;
  amountLabel: string;            // formatSignedArs(type, amount) — persisted net
  grossLabel: string | null;      // formatArs(gross) when expense && cashbackBps > 0
  cashbackLabel: string | null;   // '7% cashback'
  dateLabel: string;              // formatShortDate(date)
  category: {
    id: number; name: string; icon: string; archived: boolean;
    color: string;                // categoryColor(label.colorIndex) — derived by the mapper
  };
  member: { id: number; name: string; archived: boolean };
  edit: { gross: string; cashback: string; dateValue: string };  // sheet seed; strings for inputs
}
export function toLedgerRowView(tx: DomainTransaction, category: CategoryLabel, member: MemberLabel): LedgerRowView;

// lib/view/budgets.ts
export interface BudgetRowView {
  categoryId: number; name: string; icon: string; color: string; archived: boolean;
  amount: number; amountLabel: string; spentLabel: string;   // 'gastado $800'
  progress: BudgetProgress;
}
export function toBudgetRowView(row: BudgetRow, category: CategoryLabel, spent: number): BudgetRowView;
```

`CategoryLabel` (`lib/db/repositories/categories.repository.ts:59-66`) carries `colorIndex: number`,
not a color. The mappers (`toLedgerRowView`, `toBudgetRowView`) derive
`color` with the existing `categoryColor(colorIndex)` from `lib/domain/categories.ts` (a CSS
custom-property reference such as `var(--accent-1)`), so components never see `colorIndex` and no
second color mapping exists.

```ts
// lib/view/ledgerFilterOptions.ts  (pure)
export interface FilterOption { id: number; name: string; archived: boolean }
export interface LedgerFilterOptions { categories: FilterOption[]; members: FilterOption[] }
export function buildLedgerFilterOptions(input: {
  activeCategories: readonly { id: number; name: string }[];
  activeMembers: readonly { id: number; name: string }[];
  monthCategoryLabels: readonly CategoryLabel[];   // labels of categories referenced by the month's transactions
  monthMemberLabels: readonly MemberLabel[];       // labels of members referenced by the month's transactions
}): LedgerFilterOptions;
```

Rules (transaction-ledger spec "Archived category and member remain filterable"): the result is the
active list **plus** every archived label present in the month's transactions, deduplicated by id,
archived entries marked `archived: true` (rendered with the "(en archivo)" suffix). Archived values
not referenced by the month's transactions are not offered. A currently selected `category`/`member`
URL id that is in neither set is still applied by `filterTransactions` (yielding the filtered-empty
state) but is not added as an option. Order: active entries in repository order, then archived
entries by name.

`Date` never crosses the server/client boundary; only strings and numbers do.

**Rationale**: Keeps formatting out of components (presentational stays dumb), keeps `lib/domain`
free of label/view shapes, and is unit-testable in Node.

### Decision 12: Component breakdown (atomic design, container/presentational)

Containers are `app/**/page.tsx` and `app/(shell)/layout.tsx` (fetch + compose). Everything under
`components/` receives props; `'use client'` is marked per file below.

| Level | Component | Client? | Responsibility |
|---|---|---|---|
| atom (`ui/`) | `CategoryIcon` | no | Static map of the seeded lucide names (`shopping-cart`, `key-round`, …) to bundled components; fallback `Tag`. No dynamic import of the whole icon set. |
| atom | `ArchivedTag` | no | Renders "(en archivo)". |
| atom | `FieldError` | no | `role="alert"` message under a field. |
| molecule (`molecules/`) | `MonthStepper` | no | ‹ label › with two `<Link>`s; `aria-label` "Mes anterior" / "Mes siguiente". |
| molecule | `SortToggle` | no | `<Link>` to `withSort(nextSortMode(sort))`. |
| molecule | `SegmentedControl` | yes | Gasto / Ingreso toggle (and Todos/Gastos/Ingresos chips). |
| molecule | `AmountField` | yes | `type="text" inputMode="numeric"`, `$` prefix. |
| molecule | `CashbackField` | yes | `type="text" inputMode="decimal"`, `%` suffix, preview note. |
| molecule | `OptionGrid` | yes | Category picker grid (icon + name, archived option on edit). |
| molecule | `MemberPicker` | yes | Quién buttons. |
| molecule | `ConfirmDialog` | yes | `role="alertdialog"`, Eliminar / Cancelar. |
| molecule | `LedgerRow` | no | Button-row rendering a `LedgerRowView`; `onSelect` prop; dims on `pending`. |
| molecule | `BudgetRow` | yes | Amount form (submit on Enter/blur when changed), × remove, `ProgressBar`. |
| molecule | `EmptyState` | no | Message + optional action link. |
| organism (`organisms/`) | `EntrySheetProvider` | yes | Decision 1 + 5 state. |
| organism | `EntrySheet` | yes | `role="dialog" aria-modal`, Escape closes, `useActionState` wiring, type switch clears an incompatible category (spec), hides cashback for income. |
| organism | `BottomNav` (modified) | yes | FAB → `openCreate()`. |
| organism | `LedgerFilters` | yes | type chips, category/member selects fed by `LedgerFilterOptions` (archived entries suffixed "(en archivo)"), from/to inputs → `router.replace`. |
| organism | `LedgerList` | yes | `applyOverlay(rows, overlay)` → `LedgerRow`s; row → `openEdit`. |
| organism | `BudgetList` | yes | Optimistic remove/amount over `BudgetRow`s. |
| organism | `BudgetAddForm` | yes | Picker of active expense categories not budgeted this month + amount; hidden when none remain (spec). |
| organism | `BudgetCopyButton` | yes | Calls `copyBudgetsAction`; shows the result message. |
| screen (`screens/`) | `LedgerScreen`, `BudgetScreen` | no | Layout composition of the above; no data access. |

The archived option in `OptionGrid` / `MemberPicker` is injected only in edit mode, only for the
row's own stored value (spec "once switched away, the archived value is not re-offered other than as
the originally stored value").

## Data Flow

**Read — Movimientos**

```
GET /movimientos?month=2026-08&type=expense&sort=amount-desc
  proxy.ts (session) ─→ (shell)/layout.tsx ─→ listActiveCategories ∥ listActiveMembers ∥ cookies()
                                              └─→ <EntrySheetProvider …>
  movimientos/page.tsx
    q    = parseLedgerQuery(await searchParams, monthKeyOf(nowInBuenosAires()))
    txs  = listTransactionsInRange(monthRange(q.month))              // half-open
    rows = sortTransactions(filterTransactions(txs, q.filters), q.sort)
    labels = resolveCategoryLabels(ids of txs) ∥ resolveMemberLabels(ids of txs)   // whole month, incl. archived
             ∥ listActiveCategories ∥ listActiveMembers
    views  = rows.map(toLedgerRowView)
    filterOptions = buildLedgerFilterOptions({ activeCategories, activeMembers,
                      monthCategoryLabels, monthMemberLabels })        // lib/view/ledgerFilterOptions.ts
    <LedgerScreen query={q} rows={views} filterOptions={filterOptions} totalInMonth={txs.length} />
```

**Write — edit from the list**

```
LedgerRow click ─→ openEdit(row) ─→ EntrySheet (seeded from row.edit)
  submit ─→ dispatchOverlay(pending id) ─→ updateTransactionAction(prev, formData)
              assertSession → parseTransactionForm → getTransactionById ∥ getCategoryById ∥ getMemberById
              → checkTransactionReferences → computeNetAmount → updateTransaction (1 stmt)
              → cookies().set(tm_last_member) → revalidatePath ×3 → { saved, row: LedgerRowView }
         ←─ startTransition(replace(row); close())
  transition ends ─→ overlay resets to EMPTY ─→ list = fresh server rows
```

**Read/Write — Presupuesto**

```
presupuesto/page.tsx
  month = parseBudgetMonth(await searchParams, currentMonth); prev = prevMonthKey(month)
  getBudgetsForMonth(month) ∥ getBudgetsForMonth(prev) ∥ listTransactionsInRange(monthRange(month))
  ∥ listActiveCategoriesByKind('expense')
  → resolveCategoryLabels(budget category ids)          // archived rows still labeled
  → spentForCategory per row → budgetProgress → toBudgetRowView
  → copy control rendered (label via prevMonthKey + monthKeyLabel); an empty plan is reported
    by the action's "nothing to copy" message, not by hiding the control (spec "Empty source month")
copyBudgetsAction(month) → assertSession → isMonthKey → read prev ∥ current ∥ active expense
  → planBudgetCopy(prevRows, currentRows, activeExpenseIds)
     ├─ [] → { nothing }  (repository not called)
     └─ rows → copyMissingBudgets(rows, month, updatedAt) (1 multi-row stmt, ON CONFLICT DO NOTHING)
        → revalidatePath('/presupuesto'), ('/inicio') → { copied, count }
```

## Spanish UI Copy (Q10 — exact strings)

Validation and server messages live in `lib/domain/messages.ts`; UI labels in `lib/copy/es.ts`.
Copy is neutral: impersonal constructions, no voseo, no regional slang.

**Sheet** — `lib/copy/es.ts`

| Key | String |
|---|---|
| title create / edit | `Nuevo movimiento` / `Editar movimiento` |
| type toggle | `Gasto` / `Ingreso` |
| amount aria-label / placeholder | `Monto` / `0` |
| cashback label / default note | `Cashback` / `Descuento sobre el monto` |
| cashback preview | `Gasto final {net} · ahorro {saving}` |
| section labels | `Categoría` / `Quién` / `Fecha y hora` |
| archived marker | `(en archivo)` |
| submit create / edit / pending | `Registrar` / `Guardar cambios` / `Guardando…` |
| delete button | `Eliminar movimiento` |
| confirm title / body | `¿Eliminar este movimiento?` / `Esta acción no se puede deshacer.` |
| confirm / cancel / pending | `Eliminar` / `Cancelar` / `Eliminando…` |
| close aria-label | `Cerrar` |
| no members | `No hay personas activas.` |

**Movimientos**

| Key | String |
|---|---|
| title | `Movimientos` |
| type chips | `Todos` / `Gastos` / `Ingresos` |
| selects (all) | `Toda categoría` / `Toda persona` |
| date aria-labels | `Desde` / `Hasta` |
| sort labels / aria | `Fecha ↓` / `Monto ↓` / `Monto ↑` / `Cambiar orden` |
| stepper aria | `Mes anterior` / `Mes siguiente` |
| count | `1 movimiento` / `{n} movimientos` |
| row cashback tag | ` · {p}% cashback` |
| empty month | `No hay movimientos en {Mes Año}.` |
| empty filtered / action | `Ningún movimiento coincide con los filtros.` / `Limpiar filtros` |

**Presupuesto**

| Key | String |
|---|---|
| title | `Presupuesto` |
| copy button | `Copiar presupuesto de {Mes Año}` |
| copy results | `Se copió 1 categoría.` / `Se copiaron {n} categorías.` / `No hay categorías para copiar.` |
| row | `gastado {x}` · remove aria `Quitar {categoría}` · amount aria `Monto de {categoría}` |
| add | `+ Agregar categoría` / `Elegir categoría…` / `Monto` / `Agregar` / `Cancelar` |
| empty | `Sin presupuesto para {Mes Año}.` |

**Validation and server errors** — `lib/domain/messages.ts`

| Key | String |
|---|---|
| `grossRequired` | `El monto es obligatorio.` |
| `grossNotWhole` | `El monto debe ser un número entero, sin decimales.` |
| `grossNotPositive` | `El monto debe ser mayor que cero.` |
| `grossTooLarge` | `El monto es demasiado grande.` |
| `cashbackInvalid` | `El cashback debe ser un porcentaje entre 0 y 100, con hasta 2 decimales.` |
| `typeInvalid` | `El tipo de movimiento no es válido.` |
| `categoryRequired` | `Falta elegir una categoría.` |
| `categoryMissing` | `La categoría elegida ya no existe.` |
| `categoryUnavailable` | `La categoría elegida ya no está disponible.` |
| `categoryKindMismatch` | `La categoría no corresponde al tipo de movimiento.` |
| `memberRequired` | `Falta elegir quién hizo el movimiento.` |
| `memberUnavailable` | `La persona elegida ya no está disponible.` |
| `dateInvalid` | `La fecha y hora no son válidas.` |
| `transactionNotFound` | `El movimiento ya no existe.` |
| `saveFailed` | `No se pudieron guardar los cambios.` |
| `deleteFailed` | `No se pudo eliminar el movimiento.` |
| `budgetAmountInvalid` | `El monto debe ser un número entero mayor que cero.` |
| `budgetCategoryNotExpense` | `Solo se pueden presupuestar categorías de gastos.` |
| `budgetSaveFailed` | `No se pudo guardar el presupuesto.` |
| `budgetRemoveFailed` | `No se pudo quitar la categoría.` |
| `budgetCopyFailed` | `No se pudo copiar el presupuesto.` |

Deleting an already-deleted transaction returns success (spec "without data loss"); removing an
already-removed budget row returns success.

## File Changes

| File | Action | Description |
|---|---|---|
| `app/(shell)/layout.tsx` | Modify | `async`; fetch pickers + cookie; wrap in `EntrySheetProvider`; render `EntrySheet` |
| `app/(shell)/layout.test.tsx` | Modify | Mock repositories + `next/headers`; `render(await ShellLayout({ children }))` |
| `app/(shell)/movimientos/page.tsx` | Modify | Ledger container (Decision 7, Data Flow) |
| `app/(shell)/presupuesto/page.tsx` | Modify | Budget container |
| `app/actions/transactions.ts` | Create | create / update / delete actions |
| `app/actions/budgets.ts` | Create | upsert / remove / copy actions |
| `app/actions/transactions.test.ts`, `app/actions/budgets.test.ts` | Create | Action validation/auth/flow tests with mocks |
| `lib/actions/state.ts` | Create | Form-state/result types + `INITIAL_*` constants |
| `lib/auth/requireSession.ts` (+ test) | Create | `assertSession` (Decision 9) |
| `lib/members/cookies.ts` | Create | Cookie name + max age |
| `lib/copy/es.ts` | Create | UI labels (Spanish) |
| `lib/domain/format.ts` (+ test) | Create | `formatArs`, `formatSignedArs`, `formatShortDate`, `formatPercent` |
| `lib/domain/validation.ts` (+ test) | Create | Decision 3 |
| `lib/domain/messages.ts` | Create | Spanish validation/server messages |
| `lib/domain/members.ts` (+ test) | Create | `resolveDefaultMemberId` |
| `lib/domain/month.ts` (+ test) | Modify | `nextMonthKey`, `monthAbbrev` |
| `lib/domain/time.ts` (+ test) | Modify | `toDateTimeLocalValue`, `parseDateTimeLocal` |
| `lib/domain/transactions.ts` (+ test) | Modify | `clampDateFilters` |
| `lib/domain/budget.ts` (+ test) | Modify | `PlannedBudgetRow`, `planBudgetCopy` |
| `lib/domain/month.ts` header comment | Modify | Same task as `messages.ts`: name both sanctioned Spanish tables (Decision 3 note) |
| `lib/view/ledger.ts`, `lib/view/budgets.ts`, `lib/view/ledgerOverlay.ts`, `lib/view/ledgerQuery.ts`, `lib/view/budgetQuery.ts`, `lib/view/ledgerFilterOptions.ts` (+ tests) | Create | Pure view models (color via `categoryColor`), overlay reducer, URL schema, archived-aware filter options |
| `lib/db/repositories/transactions.repository.ts` | Modify | `getTransactionById`, `updateTransaction`, `deleteTransaction` |
| `lib/db/repositories/budgets.repository.ts` | Modify | `deleteBudget`, `copyMissingBudgets` |
| `lib/db/repositories/categories.repository.ts` | Modify | `getCategoryById` (includes archived) |
| `lib/db/repositories/members.repository.ts` | Modify | `getMemberById` (includes archived) |
| `lib/db/repositories/archiveReads.test.ts` | Modify | Add the two by-id reads as `must-include-archived` |
| `lib/db/repositories/budgetCopy.test.ts` | Create | Source-level guard: `copyMissingBudgets` is `values` + `onConflictDoNothing` + `returning`, with no update/delete/select |
| `vitest.config.ts` | Unchanged | `lib/**/*.test.ts` already covers `lib/view/` |
| `components/ui/{CategoryIcon,ArchivedTag,FieldError}.tsx` | Create | Atoms |
| `components/molecules/*` | Create | Per Decision 12 |
| `components/organisms/{EntrySheetProvider,EntrySheet,LedgerFilters,LedgerList,BudgetList,BudgetAddForm,BudgetCopyButton}.tsx` | Create | Organisms |
| `components/organisms/BottomNav.tsx` | Modify | FAB calls `openCreate()`; remove the "inert chrome" comment |
| `components/organisms/BottomNav.test.tsx` | Modify | Render inside a provider; assert FAB opens the sheet |
| `components/screens/{LedgerScreen,BudgetScreen}.tsx` | Create | Screen composition |
| `app/globals.css` | Modify | Sheet, dialog, row, filter, budget styles via existing custom properties |
| `lib/db/schema.ts`, `drizzle/**` | Unchanged | No migration |

## Interfaces / Contracts

```ts
// lib/actions/state.ts
export type TransactionFormState =
  | { status: 'idle' }
  | { status: 'error'; fieldErrors: FieldErrors<TransactionField>; formError: string | null }
  | { status: 'saved'; row: LedgerRowView; memberId: number };
export type DeleteResult = { status: 'deleted'; id: number } | { status: 'error'; message: string };
export type BudgetFormState =
  | { status: 'idle' }
  | { status: 'error'; fieldErrors: Partial<Record<'amount' | 'categoryId' | 'month', string>>; formError: string | null }
  | { status: 'saved'; categoryId: number; amount: number };
export type BudgetMutationResult = { status: 'ok' } | { status: 'error'; message: string };
export type CopyResult =
  | { status: 'copied'; count: number }
  | { status: 'nothing' }
  | { status: 'error'; message: string };
export const INITIAL_TRANSACTION_FORM_STATE: TransactionFormState;  // { status: 'idle' }
export const INITIAL_BUDGET_FORM_STATE: BudgetFormState;

// components/organisms/EntrySheetProvider.tsx
export interface EntrySheetContextValue {
  open: boolean;
  mode: 'create' | 'edit';
  editingRow: LedgerRowView | null;
  defaultMemberId: number | null;
  initialDateValue: string;                 // computed in openCreate()
  categories: readonly CategoryRow[];       // active, both kinds
  members: readonly MemberRow[];            // active
  overlay: LedgerOverlay;
  dispatchOverlay: (action: OverlayAction) => void;
  openCreate: () => void;
  openEdit: (row: LedgerRowView) => void;
  close: () => void;
  rememberMember: (memberId: number) => void;
}
export function useEntrySheet(): EntrySheetContextValue;  // throws outside the provider

// Sheet form field names (FormData contract shared by sheet and actions)
// id (edit only), type, gross, cashback (expense only), categoryId, memberId, date
// Budget form: month, categoryId, amount
```

Budget upsert reference rule (`checkBudgetCategory`): category must exist and be `kind = 'expense'`;
an archived category is accepted only when the month already has a row for it (edit of an existing
archived row, spec "editable and removable"); a new row requires an active category.

## Testing Strategy

Vitest only (`pnpm test`, `TZ=UTC`). No live database; no Playwright (deferred by config).

| Layer | What | Approach |
|---|---|---|
| Unit (domain) | `formatArs` (0, 999, 1234567, −5000), `formatShortDate` (21:00 not shifted, `5 ene`), `formatPercent`; `parseWholePesos`, `parseCashbackBps` (spec table incl. `0.29`→29, `1.15`→115, `7.255`, `100.01`, `-1`, `""`), `parseTransactionForm` (income forces 0, ignores `amount`, empty date rejected — takes no clock argument), `parseBudgetAmount`; `checkTransactionReferences` (archived allowed only as unchanged value on update; kind mismatch); `parseDateTimeLocal` (round-trip, Feb 30, seconds); `toDateTimeLocalValue` with `vi.setSystemTime(2026-08-15T00:00Z)` → `2026-08-14T21:00`; `nextMonthKey`, `monthAbbrev`; `clampDateFilters`; `planBudgetCopy` (only missing, keeps source amount, skips archived and non-expense via the active-expense id set, idempotent: re-planning against the copied month yields `[]`, empty source → `[]`); `resolveDefaultMemberId`. | Pure, table-driven, no mocks. |
| Unit (view) | `toLedgerRowView` (gross label only for expense with cashback; archived flags; `category.color === categoryColor(label.colorIndex)`), `toBudgetRowView` (same color derivation), `buildLedgerFilterOptions` (active-only month; archived category/member present in the month's transactions added and marked archived; archived not in the month not offered; duplicates by id collapsed), `reduceOverlay` / `applyOverlay` (pending, remove, replace, base reset), `parseLedgerQuery` / `ledgerHref` round-trip (defaults omitted, garbage → defaults, arrays → first, `withMonth` clears from/to and keeps type/sort). | Pure. |
| Architecture | `lib/domain/architecture.test.ts` unchanged and green with the new files; `archiveReads.test.ts` extended; new `budgetCopy.test.ts` source guard (`copyMissingBudgets` body uses `.values(`, `onConflictDoNothing` on the `userId/month/categoryId` target, `.returning(`; contains no `onConflictDoUpdate`, `.update(`, `.delete(`, `.select(`). | Source scans. |
| Action (integration-lite) | Each action: (1) invalid/absent session → throws and **no repository mock is called**; (2) invalid input → error state, no write, **no cookie set**; (3) success → `computeNetAmount` result passed to the repository (33333 @ 7% → 31000), client `amount` ignored, cookie set with the member id, `revalidatePath` called for the three paths, returned `row` is the mapped persisted row; (4) update of vanished id → `transactionNotFound`; delete of vanished id → success; budget income category → error; copy with an empty plan → `nothing` and `copyMissingBudgets` **not called**; copy with a plan → `copyMissingBudgets` called once with exactly the planned rows (archived/non-expense source rows absent) and the count mapped to `copied`. (5) `assertSession` RED tests per Decision 9 (security hardening beyond the specs). | `vi.mock('next/headers')`, `vi.mock('next/cache')`, `vi.mock('@/lib/db/repositories/…')` — the `app/actions/login.test.ts` pattern. |
| Component (jsdom) | `EntrySheet`: type switch swaps the category set and clears an incompatible selection; cashback hidden for income; edit pre-fills and shows archived category/member marked `(en archivo)`; create preselects `defaultMemberId`; validation errors keep values. `BottomNav`: FAB opens the sheet. `LedgerList`: overlay hides removed rows and dims pending ones. `ConfirmDialog`: cancel leaves the action uncalled. `layout.test.tsx` updated. | `@testing-library/react`, `// @vitest-environment jsdom`, mocked `next/navigation` / `next/link` and actions. |
| Repository SQL | `copyMissingBudgets`, `updateTransaction`, `deleteTransaction` against Postgres | **Deferred** (no Neon test branch, same as change 1); verified on the preview deployment against a Neon branch. Recorded as a risk. |
| E2E | Full flows | Deferred per `openspec/config.yaml`. |

## Threat Matrix

The trigger is **HTTP routing**: six new Server Actions become POST-reachable endpoints. No shell,
subprocess, Git, PR automation, or executable-file classification is involved.

| Boundary | Applicability | Design response |
|---|---|---|
| Documentation-like paths | **N/A** — no file is classified or executed by path. | — |
| Git repository selection | **N/A** — no Git invocation in shipped code. | — |
| Commit state | **N/A** — no VCS automation. | — |
| Push state | **N/A** — no VCS automation. | — |
| PR commands | **N/A** — no PR automation. | — |

Routing-specific cases that **do** apply and MUST become RED tests in `tasks.md` before the actions
are implemented:

| Case | Expected safe behavior | Failure behavior |
|---|---|---|
| Action invoked with absent / tampered / expired `tm_session` (e.g. POST to public `/login` with a `Next-Action` header) | `assertSession` throws before any repository call | never reads or writes data |
| `deleteTransactionAction('1; DROP')`, `-1`, `1.5`, `{}` | rejected by `parsePositiveId`, no repository call | never forwards a non-integer id |
| `copyBudgetsAction('2026-13')` / `removeBudgetAction('x', 1)` | rejected by `isMonthKey` | no query issued |
| Form carrying `amount=1` alongside gross/cashback | stored amount is `computeNetAmount` output | client net never persisted |
| Create with an archived or foreign-kind category/member id | field error, no write | no reference to an unselectable row is created |

## Migration / Rollout

No migration required. No schema, index, or seed change; nothing is added under `drizzle/`. Rollout
is a normal Vercel deployment; rollback is a revert plus Vercel instant rollback (proposal Rollback
Plan). The `tm_last_member` cookie is ignored by a reverted build. Hard deletes are not reversible by
rollback (accepted under Q3).

## Open Questions

None blocking. The copy statement uses `insert().values([...]).onConflictDoNothing({ target }).returning()`,
the same Drizzle surface `upsertBudget` already exercises (`onConflict*` with a column-array target),
so no API uncertainty remains for `drizzle-orm@0.45`.
