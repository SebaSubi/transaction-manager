# Design: Port Dashboard — Inicio and Perfil

> **Inputs.** `proposal.md` (decisions Q1–Q11 are final), Engram `sdd/port-dashboard/explore`
> (obs #1010), the archived `port-ledger` design (conventions reused verbatim: Server Component
> pages, the `EntrySheetProvider` in the async shell layout, the action order, `lib/view` mappers,
> the `useOptimistic` overlay, `lib/domain/messages.ts`), and the spec deltas under `specs/` as they
> existed when this design was written (including the coordinator's Q11 correction: archived
> categories never appear in the Inicio grid).
>
> **Next.js docs consulted** (installed `next@16.3.4`, `node_modules/next/dist/docs/01-app/`):
> `03-api-reference/04-functions/revalidatePath.md` (in a Server Function it updates the UI
> immediately for the viewed path; literal paths omit `type`; `('/', 'layout')` purges everything),
> `03-api-reference/04-functions/cookies.md` (async `cookies()`; `.set` only in Server Functions or
> Route Handlers; "after you set or delete a cookie in a Server Function, Next.js can return both the
> updated UI and new data in a single server roundtrip"), `03-api-reference/01-directives/use-client.md`
> (client entry points; props must be serializable), `02-guides/interactive-apps.md` (Step 5:
> drag-and-drop board with `useOptimistic(tasks, reducer)` + standalone `startTransition`; the
> optimistic value applies while the transition is pending and reverts when an expected error is
> returned; post-`await` state updates need `startTransition`), and `02-guides/data-security.md`
> §"Server Actions" (every exported action is reachable by direct POST; verify auth and
> authorization inside each one; return only what the UI needs). `cacheComponents` is still not
> enabled, so no `'use cache'`, `cacheTag`, or `updateTag`.
>
> **Schema decisions: none.** No table, column, index, constraint, enum, or seed change. No file is
> added under `drizzle/`. `members.archived_at`, `categories.archived_at`, the `card_order` table,
> and the partial unique indexes `members_active_name_uq` and `categories_active_name_uq` support
> every operation in this change.

## Technical Approach

The three rings from changes 1 and 2 stay intact (`lib/domain/architecture.test.ts`, ESLint zones,
`server-only`):

```
app/(shell)/{inicio,perfil}/page.tsx   ← containers (Server Components): read repositories + cookie,
app/actions/{members,categories,cardOrder,setTheme}.ts    compute via domain, map via lib/view
        │
components/{ui,molecules,organisms,screens}   ← presentational; 'use client' only for interaction
        │
lib/view/{home,settings}.ts   ← NEW pure mappers (cards, ordering, settings rows)
lib/db/repositories/*          ← the only Drizzle consumers (+ rename, unarchive, listArchived,
lib/db/errors.ts                  listRecent, getStoredCardOrder; unique-violation detector)
lib/domain/*                   ← pure rules (+ mergeCardOrder, monthBalance, parseName, icon keys)
```

- **Inicio** is a Server Component that reads the current Buenos Aires month once and derives the
  balance, the budgeted-card grid, and the recent movements from repository reads plus pure
  functions. One client island: the sortable grid. The recent list reuses the change-2
  `LedgerList` (already a client component wired to `useEntrySheet().openEdit` and the overlay), so
  a tap opens the existing edit sheet with no new sheet code.
- **Perfil** is a Server Component that reads active and archived members and expense categories
  plus the theme cookie. Client islands: member settings, category settings, the "Archivadas"
  section, and the theme switch.
- **Server Actions** follow the change-2 order with no exceptions:
  `assertSession → parse → reference reads → pure validation → single-statement write →
  revalidatePath`, and return a serialized result with a Spanish message on failure.

## Architecture Decisions

### Decision 1: Drag-to-reorder with `@dnd-kit/core` 6.3.1 + `@dnd-kit/sortable` 10.0.0

**Install (explicit task, per `rules.tasks`):**

```
pnpm add @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0
```

Exact pins (no caret). `@dnd-kit/utilities` arrives transitively but is **not imported**: pnpm's
strict layout does not hoist it, so the transform string is built by hand (below) instead of adding
a third dependency.

**Component**: `components/organisms/SortableCategoryGrid.tsx` (`'use client'`) owns the
`DndContext`; `components/organisms/SortableCategoryCard.tsx` (`'use client'`) wraps the
presentational `HomeCategoryCard` with `useSortable`.

| Concern | Choice |
|---|---|
| Sensors | `useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 8 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))` |
| Collision / strategy | `closestCenter`; `SortableContext items={ids} strategy={rectSortingStrategy}` (2-column grid) |
| Stable id | `<DndContext id="home-card-grid" …>`. dnd-kit uses this prop verbatim as the `aria-describedby` target (the `DndDescribedBy-` prefix is only added to auto-generated ids; verified in task 1.2) and derives the live-region id from it; without it the ids come from a module counter that differs between the server render and hydration, producing the known attribute mismatch |
| Announcements | `accessibility={{ announcements, screenReaderInstructions: { draggable: HOME_COPY.dragInstructions } }}`; the four callbacks call copy functions in `lib/copy/es.ts` (table below) with the card name and 1-based position from the current optimistic order |
| Role description | `useSortable({ id, attributes: { roleDescription: HOME_COPY.cardRoleDescription } })` |
| Transform | `style={{ transform: t ? \`translate3d(${t.x}px, ${t.y}px, 0)\` : undefined, transition }}`; `isDragging` adds `home-card--dragging` (raised shadow, `z-index`) |
| Optimistic order | `const [ids, setIds] = useOptimistic(serverIds)`; see flow below |

**Sensor deviation from the brief (deliberate):** the brief lists `PointerSensor`. `PointerSensor`
also activates on *touch* pointers (Pointer Events unify mouse, pen, and touch), so on a phone it
would race the `TouchSensor` and its distance constraint would start a drag on an ordinary scroll
swipe, breaking the "quick swipe scrolls" scenario. `MouseSensor` (distance 8 px) covers mouse and
pen-compatibility events and never sees touch. This is dnd-kit's documented pairing for touch plus
desktop. If the apply phase verifies that `PointerSensor` can be restricted to non-touch pointers
without a custom subclass, either choice satisfies the spec; the spec names only behaviors.

**iOS / touch CSS** (`app/globals.css`, on `.home-card`):

```css
.home-card {
  touch-action: manipulation;      /* keeps vertical pan scrolling; no double-tap zoom delay */
  -webkit-user-select: none;
  user-select: none;               /* long press must not start a text selection */
  -webkit-touch-callout: none;     /* suppress the iOS long-press callout */
  -webkit-tap-highlight-color: transparent;
}
.home-card--dragging { touch-action: none; }
```

`touch-action: none` is **not** set on idle cards: it would make the grid unscrollable. After the
180 ms delay, dnd-kit's `TouchSensor` calls `preventDefault` on `touchmove` itself, which stops the
page scrolling during an active drag.

**Optimistic flow** (interactive-apps guide, Step 5 pattern):

```
onDragStart → setError(null)
onDragEnd({ active, over })
  over === null || active.id === over.id → return
  next = moveId(ids, active.id, over.id)          // lib/view/home.ts, pure (arrayMove semantics)
  startTransition(async () => {
    setIds(next)                                   // applies on the current frame
    const result = await reorderCardsAction(next)
    if (result.status === 'error') startTransition(() => setError(result.message))
  })
success → revalidatePath('/inicio') delivers the persisted order as the new serverIds;
          the transition ends and the optimistic value collapses onto it (identical order)
error   → transition ends, optimistic value reverts to serverIds; the message renders in a
          role="alert" line under the grid until the next drag starts
```

A second drag before the first settles builds on the current optimistic `ids`, so both moves show;
each call persists the full visible order, so the last write wins (accepted in the proposal).

**`reorderCardsAction(orderedIds: unknown): Promise<MutationResult>`** (`app/actions/cardOrder.ts`):

```
1. await assertSession()
2. ids = parseIdList(orderedIds, MAX_CARD_IDS = 200)        // lib/domain/validation.ts, pure
   └─ null (not an array, non-integer/negative element, too long, or empty) → error, no read
      duplicates are removed here (first occurrence wins)
3. [activeExpense, stored] = await Promise.all([
     listActiveCategoriesByKind('expense'), getStoredCardOrder() ])
4. checkCardOrderIds(ids, new Set(activeExpense.map(c => c.id)))   // lib/domain/cardOrder.ts
   └─ any id not an active expense category (unknown, foreign, income, archived) → error, no write
   merged = mergeCardOrder(ids, stored)
   sameOrder(merged, stored) → return { status: 'ok' }      // nothing to write
5. await replaceCardOrder(merged)                            // db.batch([DELETE, INSERT]), atomic
6. revalidatePath('/inicio')
7. return { status: 'ok' }
```

Unexpected throws in steps 3–5 are caught and mapped to `VALIDATION_MESSAGES.cardOrderSaveFailed`.
Archived ids are rejected (spec scenario "Foreign, archived, or duplicate ids"); they can never be
visible cards (Q11 correction), so a legitimate client never sends one.

**`mergeCardOrder` and the stored order**:

```ts
// lib/domain/cardOrder.ts (pure)
export function mergeCardOrder(visible: readonly number[], stored: readonly number[]): number[];
// visible ids first (deduplicated, first occurrence wins), then every stored id not already
// placed, in stored order (also deduplicated). Never drops a stored id. Non-mutating.
export function checkCardOrderIds(ids: readonly number[], allowed: ReadonlySet<number>): boolean;
export function sameOrder(a: readonly number[], b: readonly number[]): boolean;
```

`stored` comes from a **new** read `getStoredCardOrder()` that returns every `card_order` row for
the household **including archived categories** (no join). The existing `getCardOrder()` (which
joins and excludes archived rows) stays the display read. Reason: `replaceCardOrder` deletes the
whole order, so merging against the archived-excluding read would silently delete the positions of
archived categories on every reorder, violating "positions of categories not currently visible
MUST be preserved". With the raw read, a restored category regains its previous position.

`replaceCardOrder` is called unchanged with the merged list. It already issues
`db.batch([delete, insert])`, which `neon-http` applies atomically (spec "failure leaves the order
intact"). The `card_order` primary key `(user_id, category_id)` is never violated because the merged
list is deduplicated.

**Alternatives considered**: `@dnd-kit/react` 0.5 (pre-1.0, new API, rejected in exploration); an
explicit "Reordenar" mode with up/down buttons (no dependency, best a11y, but worse UX than the
requested drag); persisting only the visible ids (wipes other positions, rejected by the proposal);
filtering unknown ids silently instead of rejecting (friendlier to a stale tab, but contradicts the
spec scenario); merging against `getCardOrder()` (loses archived positions, see above).

### Decision 2: This-month balance — `listTransactionsInRange` + pure `monthBalance`

**Choice**: Reuse `listTransactionsInRange(monthRange(month))` and a new pure
`monthBalance(transactions, monthKey)` in `lib/domain/balance.ts`. It sums net `amount` of income
minus net `amount` of expense, **counting only rows inside the half-open `monthRange(monthKey)`**
(the spec makes the function itself range-aware, so it is correct even if handed a wider slice).
`totalBalance` is not modified.

**Alternatives considered**: an SQL `SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END)`
over the month range — one fewer row transfer, but rejected.

**Rationale**: Inicio already needs the month's transactions for `spentForCategory` on every budget
card, so the same single read serves both; an SQL sum would be an **extra** round trip, not a saved
one. It also keeps the netting rule in one tested pure function instead of duplicating it in SQL.
A household month is tens to low hundreds of rows, served by `transactions_month_idx`.

### Decision 3: `listRecentTransactions(limit = 5)`

```ts
export async function listRecentTransactions(limit = 5, userId = HOUSEHOLD): Promise<DomainTransaction[]>;
```

```sql
SELECT id, type, amount, gross, cashback_bps, category_id, member_id, date
FROM transactions
WHERE user_id = $1
ORDER BY date DESC, id DESC
LIMIT $2;
```

Drizzle: `db.select(TRANSACTION_COLUMNS).from(transactions).where(eq(transactions.userId, userId))
.orderBy(desc(transactions.date), desc(transactions.id)).limit(safeLimit)`, where
`safeLimit = Math.min(50, Math.max(1, Math.trunc(limit)))` (a non-finite value falls back to 5).
`transactions_month_idx (user_id, date)` serves the scan backwards; `id DESC` is the deterministic
tiebreaker, identical to `listTransactionsInRange`. All dates are included (spec "movements outside
the current month included"). Labels come from the existing `resolveCategoryLabels` /
`resolveMemberLabels` (archived included) and rows are mapped with `toLedgerRowView`.

### Decision 4: Repository additions on `neon-http` — one statement each, `RETURNING`

| Repository | Function | SQL shape | Archive rule |
|---|---|---|---|
| `categories` | `renameCategory(id, kind, name)` → `CategoryRow \| null` | `UPDATE categories SET name = $n WHERE user_id = $u AND id = $id AND kind = $k AND archived_at IS NULL RETURNING …` | must-filter-archived |
| `categories` | `unarchiveCategory(id, kind)` → `CategoryRow \| null` | `UPDATE categories SET archived_at = NULL WHERE user_id AND id AND kind AND archived_at IS NOT NULL RETURNING …` | must-only-archived |
| `categories` | `listArchivedCategories(kind)` → `CategoryRow[]` | `SELECT … WHERE user_id AND kind AND archived_at IS NOT NULL ORDER BY archived_at DESC, id DESC` | must-only-archived |
| `members` | `unarchiveMember(id)` → `MemberRow \| null` | `UPDATE members SET archived_at = NULL WHERE user_id AND id AND archived_at IS NOT NULL RETURNING id, name` | must-only-archived |
| `members` | `listArchivedMembers()` → `MemberRow[]` | `SELECT id, name … WHERE user_id AND archived_at IS NOT NULL ORDER BY archived_at DESC, id DESC` | must-only-archived |
| `transactions` | `listRecentTransactions(limit)` | Decision 3 | n/a |
| `cardOrder` | `getStoredCardOrder()` → `number[]` | `SELECT category_id FROM card_order WHERE user_id ORDER BY position, category_id` (no join; archived included, comment says why) | n/a |

`null` from an `UPDATE … RETURNING` means "no row matched" (vanished, wrong kind, or already in the
target state); it never throws for that. Rename sets **only** `name` (icon, colour, kind,
`archived_at` untouched). Unarchive sets **only** `archived_at`. Unchanged: `createCategory`,
`createMember`, `archiveCategory`, `archiveMember`, `replaceCardOrder`, `getCardOrder`.

**Duplicate active names** (create, rename, restore): Postgres rejects the statement atomically
through the partial unique index, so there is never a partial write. Detection lives in a new pure
module `lib/db/errors.ts` (no `server-only`, no Drizzle import, so it is unit-testable):

```ts
export const UNIQUE_VIOLATION = "23505";
export const MEMBERS_ACTIVE_NAME_UQ = "members_active_name_uq";
export const CATEGORIES_ACTIVE_NAME_UQ = "categories_active_name_uq";
/** Walks error → error.cause (max 5 hops) for { code: '23505', constraint } . */
export function isUniqueViolation(error: unknown, constraint: string): boolean;
```

Verified error shape: on `neon-http`, `drizzle-orm/pg-core/session.js` wraps every failure in
`DrizzleQueryError` with the driver error as `cause`; `@neondatabase/serverless` `NeonDbError`
exposes `code` and `constraint` (`index.d.ts`). Matching both the SQLSTATE **and** the constraint
name means an unrelated unique violation is never mislabeled as a duplicate name. A source guard in
`lib/db/errors.test.ts` asserts both constraint-name constants appear in `lib/db/schema.ts`, so a
rename of the index fails a test instead of silently disabling the mapping.

Duplicate detection is **exact-match after trim**, as enforced by the index. Case-insensitive
duplicates ("ana" vs "Ana") are allowed by the database and are not pre-checked (see Open
Questions).

**`archiveReads.test.ts` update**: add a fourth expectation kind `"must-only-archived"` asserting the
body contains `isNotNull(categories.archivedAt)` / `isNotNull(members.archivedAt)` and does **not**
match the existing `isNull(...)` filter (the regex `isNull\(` does not match `isNotNull(`). New
EXPECTATIONS entries:

| File | Function | Expectation |
|---|---|---|
| `categories.repository.ts` | `renameCategory` | `must-filter-archived` |
| `categories.repository.ts` | `unarchiveCategory` | `must-only-archived` |
| `categories.repository.ts` | `listArchivedCategories` | `must-only-archived` |
| `members.repository.ts` | `unarchiveMember` | `must-only-archived` |
| `members.repository.ts` | `listArchivedMembers` | `must-only-archived` |

The "exports exactly the functions this table describes" check guarantees no new export escapes the
table. `cardOrder.repository.ts` and `transactions.repository.ts` are not covered by that test
(unchanged policy); `getStoredCardOrder` carries an explicit comment instead.

### Decision 5: Perfil Server Actions

Two `'use server'` modules; state types live in `lib/actions/state.ts` (a `'use server'` module may
export async functions only). A shared non-action helper `lib/actions/revalidate.ts` exports
`revalidateShellTabs()` = `revalidatePath` on `/perfil`, `/inicio`, `/presupuesto`, `/movimientos`
(literal paths, no `type`). All four are revalidated for member/category mutations because the shell
layout's sheet pickers (every tab), Movimientos filters and labels, Presupuesto labels, and the
Inicio grid all render member or category data.

| Action | Signature | Flow after `assertSession` |
|---|---|---|
| `createMemberAction` | `(prev: NameFormState, form: FormData) => Promise<NameFormState>` | `parseName(name)` → `createMember(name)` → 23505 `members_active_name_uq` → `memberNameTaken` |
| `archiveMemberAction` | `(id: unknown) => Promise<MutationResult>` | `parsePositiveId` → `getMemberById ∥ listActiveMembers` → `checkMemberArchivable(member, activeCount)` → `archiveMember(id, nowInBuenosAires())` |
| `restoreMemberAction` | `(id: unknown) => Promise<MutationResult>` | `parsePositiveId` → `getMemberById` → missing → error; already active → ok → `unarchiveMember(id)` → 23505 → `memberRestoreNameTaken` |
| `createCategoryAction` | `(prev: NameFormState, form: FormData) => Promise<NameFormState>` | `parseName(name)`, `isCategoryIconKey(icon)` (both errors reported together) → `listActiveCategories()` → `colorIndex = nextColorIndex(active.length)` → `createCategory({ name, kind: 'expense', icon, colorIndex })` → 23505 → `categoryNameTaken` |
| `renameCategoryAction` | `(prev: NameFormState, form: FormData) => Promise<NameFormState>` | `parsePositiveId(id)`, `parseName(name)` → `getCategoryById` → `checkManagedCategory(label, 'active')` → `renameCategory(id, 'expense', name)` → `null` → `categoryUnavailable`; 23505 → `categoryNameTaken` |
| `archiveCategoryAction` | `(id: unknown) => Promise<MutationResult>` | `parsePositiveId` → `getCategoryById` → `checkManagedCategory(label, 'any')`; already archived → ok → `archiveCategory(id, nowInBuenosAires())` |
| `restoreCategoryAction` | `(id: unknown) => Promise<MutationResult>` | `parsePositiveId` → `getCategoryById` → `checkManagedCategory(label, 'any')`; already active → ok → `unarchiveCategory(id, 'expense')` → 23505 → `categoryRestoreNameTaken` |

Every row ends with `revalidateShellTabs()` on success and returns no DB row (only `{ status,
id?, name? }`). Rules:

- **Validation before the database**: an invalid name/icon/id returns its message and calls no
  repository (spec "Invalid name rejected before the database").
- **Pure reference checks** (`lib/domain/settings.ts`):
  `checkManagedCategory(label: { kind; archived } | null, need: 'active' | 'any')` → `null` |
  message (`categoryMissing`, `categoryNotManaged` for income, `categoryUnavailable` for an archived
  row when `need = 'active'`); `checkMemberArchivable(member: { archived } | null, activeCount)` →
  `'archive' | 'noop' | message` (`memberMissing`, `lastActiveMember` when `activeCount <= 1`).
- **Idempotence**: archiving an already-archived row and restoring an already-active row return
  `ok` with no write (same convention as change-2 delete).
- **Last active member**: the pure check rejects first; `archiveMember` keeps its single-statement
  count guard and throws on a concurrent race, which the action maps to `lastActiveMember` (Q5).
- **Colour**: `nextColorIndex` over the count of **all** active categories, matching the seed,
  which assigns `nextColorIndex(position)` across the seeded list.
- **Kind guard twice**: the pure check rejects income categories (Q9), and the `kind = $k` predicate
  in `renameCategory` / `unarchiveCategory` makes the write itself incapable of touching one.
- Unexpected throws map to `saveFailed` (create/rename), `archiveFailed`, or `restoreFailed`.

**Name validation** (`lib/domain/validation.ts`, pure, never throws):

```ts
export const NAME_MAX_LENGTH = 40;
export function parseName(raw: unknown): ParseResult<string, "name">;
// non-string → nameRequired; trim(); "" → nameRequired;
// [...trimmed].length > 40 (code points, so "Peluquería" counts 10) → nameTooLong;
// otherwise { ok: true, value: trimmed }. Internal whitespace is preserved.
export function parseIdList(raw: unknown, max: number): number[] | null;  // Decision 1
```

**Icon keys** (`lib/domain/categoryIcons.ts`, pure, no Spanish):

```ts
export const CATEGORY_ICON_KEYS = ["shopping-cart", "key-round", "lightbulb", "flame", "droplet",
  "building-2", "house", "heart-pulse", "dumbbell", "users", "cake", "scissors", "fuel", "wine",
  "hand-heart", "church", "shield", "piggy-bank", "banknote", "gift", "circle-ellipsis"] as const;
export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];
export function isCategoryIconKey(value: unknown): value is CategoryIconKey;
```

`components/ui/CategoryIcon.tsx` changes its map type to
`Readonly<Record<CategoryIconKey, LucideIcon>>` (the compiler then enforces exactly the 21 keys) and
keeps the `Tag` fallback for unknown stored values. The picker iterates `CATEGORY_ICON_KEYS`, and the
action validates against the same list, so picker, renderer, and server cannot drift.

### Decision 6: `setTheme` requires a session

```
export async function setTheme(preference: unknown): Promise<void> {
  await assertSession();                 // FIRST: throws UnauthorizedError, nothing else runs
  if (!isThemePreference(preference)) throw new Error(...);   // unchanged
  (await cookies()).set(THEME_COOKIE, preference, { ...unchanged options });
}
```

No `revalidatePath` is added (none existed). Per `cookies.md`, setting a cookie inside a Server
Action already returns the re-rendered tree in the same round trip, so the root layout re-renders
`data-theme` / `data-theme-pref` from the new cookie. A rejected call sets no cookie and triggers no
revalidation.

**Theme switch** (`components/organisms/ThemeSwitch.tsx`, `'use client'`): `SegmentedControl` with
`Oscuro`/`Claro`/`Sistema` mapped to `dark`/`light`/`system`; `value` is the stored **preference**
read by the Perfil page from `tm_theme` (default `DEFAULT_THEME_PREFERENCE`). On change:
`startTransition(async () => { setOptimisticPref(v); applyThemeToDocument(v); await setTheme(v); })`.
`applyThemeToDocument` writes `dataset.themePref` and `dataset.theme` (resolving `system` via
`matchMedia`, same logic as `SystemThemeWatcher`) so the palette changes on the same frame. On
rejection, the transition ends and the selection reverts; the document attributes are restored from
the previous preference. No theme value enters render state beyond the selected radio, so there is
no hydration risk.

### Decision 7: Component breakdown (atomic design, container/presentational)

Containers: `app/(shell)/inicio/page.tsx`, `app/(shell)/perfil/page.tsx`. Everything under
`components/` receives props.

| Level | Component | Client? | Responsibility |
|---|---|---|---|
| atom (`ui/`) | `CategoryIcon` (modify) | no | Map typed by `CategoryIconKey`; `Tag` fallback |
| atom | `ProgressBar` (existing) | no | Capped bar; over-budget colour |
| molecule | `HomeCategoryCard` | no | Icon, name, `labelPct%`, bar, `gastado {x} de {y}`; pure markup from `HomeCardView` |
| molecule | `IconPicker` | yes | `role="radiogroup"` of 21 buttons (`role="radio"`, `aria-checked`, `aria-label` from `ICON_LABELS`); writes a hidden `icon` input |
| molecule | `RenameForm` | yes | Inline name input + Guardar/Cancelar; `useActionState(renameCategoryAction)`; `FieldError` |
| molecule | `SettingsRow` | no | Leading icon/avatar, name, trailing action slot |
| molecule | `ConfirmDialog`, `SegmentedControl`, `EmptyState`, `LedgerRow` (existing) | — | Reused unchanged |
| organism | `BalanceCard` | no | Label `Balance de {mes}`, `formatArs(balance)`; negative uses expense colour |
| organism | `SortableCategoryGrid` | yes | Decision 1: `DndContext`, sensors, announcements, optimistic ids, error line |
| organism | `SortableCategoryCard` | yes | `useSortable` wrapper around `HomeCategoryCard` |
| organism | `RecentMovements` | no | Title + `LedgerList` (existing client organism) or `EmptyState` |
| organism | `MemberSettings` | yes | Active list, add form (`useActionState(createMemberAction)`), archive with `ConfirmDialog` |
| organism | `CategorySettings` | yes | Active expense list, add form (name + `IconPicker`), `RenameForm` per row, archive with `ConfirmDialog` |
| organism | `ArchivedSection` | yes | "Archivadas": archived members, archived categories, `Restaurar` per row with per-row pending + error; empty message when both lists are empty |
| organism | `ThemeSwitch` | yes | Decision 6 |
| screen | `HomeScreen` | no | Greeting `¡Buenas!`, `BalanceCard`, grid or empty state, `RecentMovements` |
| screen | `ProfileScreen` | no | `MemberSettings`, `CategorySettings`, `ArchivedSection`, `ThemeSwitch` |

Restore requires no confirmation (spec); archive always opens `ConfirmDialog` and calls the action
only on confirm. The archive/restore buttons call their action inside `startTransition` and render
the returned Spanish message next to the row.

### Decision 8: View models in `lib/view/`

```ts
// lib/view/home.ts (pure)
export interface HomeCardView {
  id: number; name: string; icon: string; color: string;      // color via categoryColor
  amountLabel: string; spentLabel: string; progress: BudgetProgress;
}
export function buildHomeCards(input: {
  budgetRows: readonly BudgetRow[];              // current month
  activeExpense: readonly CategoryRow[];          // listActiveCategoriesByKind('expense')
  monthTransactions: readonly DomainTransaction[];
  displayOrder: readonly number[];               // getCardOrder() (archived excluded)
}): HomeCardView[];
// keeps only budget rows whose category is an ACTIVE expense category (Q8 + Q11 correction),
// spent = spentForCategory, progress = budgetProgress, then orderCategories(cards, displayOrder)
// over a base sorted by category id (unknown ids appended at the end, spec "stored order").
export function moveId(ids: readonly number[], activeId: number, overId: number): number[];

// lib/view/settings.ts (pure)
export interface SettingsCategoryView { id: number; name: string; icon: string; color: string }
export interface SettingsMemberView { id: number; name: string }
export function toSettingsCategoryView(row: CategoryRow): SettingsCategoryView;
```

`Date` never crosses to the client.

## Data Flow

**Read — Inicio**

```
GET /inicio
  (shell)/layout.tsx  ─→ EntrySheetProvider (unchanged)
  inicio/page.tsx
    month = monthKeyOf(nowInBuenosAires())
    listTransactionsInRange(monthRange(month)) ∥ getBudgetsForMonth(month)
      ∥ listActiveCategoriesByKind('expense') ∥ getCardOrder() ∥ listRecentTransactions(5)
    → resolveCategoryLabels(recent) ∥ resolveMemberLabels(recent)
    balance = monthBalance(monthTxs, month)
    cards   = buildHomeCards({ budgetRows, activeExpense, monthTransactions, displayOrder })
    recent  = recentTxs.map(toLedgerRowView)
    <HomeScreen monthName balance cards recent />
```

**Write — reorder**

```
SortableCategoryGrid onDragEnd ─→ setIds(moveId(...)) ─→ reorderCardsAction(next)
   assertSession → parseIdList → listActiveCategoriesByKind('expense') ∥ getStoredCardOrder()
   → checkCardOrderIds → mergeCardOrder → (sameOrder? skip) → replaceCardOrder (db.batch)
   → revalidatePath('/inicio') → { ok }
 ←─ error: optimistic order reverts, alert shows message
```

**Write — restore category (duplicate)**

```
ArchivedSection "Restaurar" ─→ restoreCategoryAction(id)
   assertSession → parsePositiveId → getCategoryById → checkManagedCategory
   → unarchiveCategory(id, 'expense')  ✗ 23505 categories_active_name_uq
   → isUniqueViolation → { error, categoryRestoreNameTaken }   (row stays archived, no revalidate)
```

**Read — Perfil**

```
perfil/page.tsx
  listActiveMembers ∥ listActiveCategoriesByKind('expense') ∥ listArchivedMembers
  ∥ listArchivedCategories('expense') ∥ cookies() (tm_theme → preference)
  → <ProfileScreen members categories archivedMembers archivedCategories themePreference />
```

## Spanish UI Copy (exact strings)

Neutral Spanish, impersonal or *usted* constructions, no voseo. UI labels go in `lib/copy/es.ts`;
action results go in `lib/domain/messages.ts`.

**Inicio** — `HOME_COPY` and functions in `lib/copy/es.ts`

| Key | String |
|---|---|
| greeting | `¡Buenas!` |
| balance label | `Balance de {mes}` (month name lower-case, e.g. `Balance de octubre`) |
| grid title | `Presupuesto del mes` |
| card spent line | `gastado {x} de {y}` |
| empty grid / action | `No hay categorías con presupuesto este mes.` / `Ir a Presupuesto` |
| recent title | `Últimos movimientos` |
| recent empty | `Todavía no hay movimientos.` |
| card role description | `categoría reordenable` |
| drag instructions | `Para reordenar una categoría, presione la barra espaciadora o Enter, muévala con las flechas y presione de nuevo la barra espaciadora o Enter para soltarla. Presione Escape para cancelar.` |
| drag start | `Se tomó {nombre}. Posición {i} de {n}.` |
| drag over | `{nombre} está sobre la posición {i} de {n}.` / no target: `{nombre} no está sobre ninguna posición.` |
| drag end | `Se soltó {nombre} en la posición {i} de {n}.` / no target: `Se soltó {nombre} sin cambios.` |
| drag cancel | `Se canceló el movimiento. {nombre} volvió a la posición {i} de {n}.` |

`monthNameOf(key)` is added to `lib/domain/month.ts` (returns `MONTHS_ES[m - 1]`, no new table); the
copy function lower-cases it.

**Perfil** — `PROFILE_COPY` in `lib/copy/es.ts`

| Key | String |
|---|---|
| title | `Perfil` |
| members section / add / placeholder / submit | `Personas` / `Agregar persona` / `Nombre` / `Agregar` |
| categories section / add | `Categorías de gastos` / `Agregar categoría` |
| name label / icon label | `Nombre` / `Ícono` |
| rename / save / cancel | `Cambiar nombre` / `Guardar` / `Cancelar` |
| archive button | `Archivar` |
| archive member confirm | `¿Archivar a {nombre}?` / `Sus movimientos se conservan. Se puede restaurar desde Archivadas.` |
| archive category confirm | `¿Archivar la categoría {nombre}?` / `Sus movimientos y presupuestos se conservan. Se puede restaurar desde Archivadas.` |
| confirm / pending | `Archivar` / `Archivando…` |
| saving | `Guardando…` |
| archived section / subsections | `Archivadas` / `Personas` / `Categorías` |
| restore / pending | `Restaurar` / `Restaurando…` |
| archived empty | `No hay elementos archivados.` |
| theme section / options | `Tema` / `Oscuro` / `Claro` / `Sistema` |

**Icon labels** — `ICON_LABELS: Record<CategoryIconKey, string>` in `lib/copy/es.ts`

| Key | Label | Key | Label | Key | Label |
|---|---|---|---|---|---|
| `shopping-cart` | `Carrito` | `heart-pulse` | `Salud` | `hand-heart` | `Donación` |
| `key-round` | `Llave` | `dumbbell` | `Pesa` | `church` | `Iglesia` |
| `lightbulb` | `Lámpara` | `users` | `Personas` | `shield` | `Escudo` |
| `flame` | `Fuego` | `cake` | `Pastel` | `piggy-bank` | `Alcancía` |
| `droplet` | `Gota` | `scissors` | `Tijeras` | `banknote` | `Billete` |
| `building-2` | `Edificio` | `fuel` | `Combustible` | `gift` | `Regalo` |
| `house` | `Casa` | `wine` | `Copa` | `circle-ellipsis` | `Otros` |

**Action messages** — added to `VALIDATION_MESSAGES` in `lib/domain/messages.ts`

| Key | String |
|---|---|
| `nameRequired` | `El nombre es obligatorio.` |
| `nameTooLong` | `El nombre puede tener hasta 40 caracteres.` |
| `iconRequired` | `Falta elegir un ícono.` |
| `memberNameTaken` | `Ya existe una persona activa con ese nombre.` |
| `memberRestoreNameTaken` | `No se puede restaurar: ya existe una persona activa con ese nombre.` |
| `memberMissing` | `La persona ya no existe.` |
| `lastActiveMember` | `No se puede archivar a la última persona activa.` |
| `categoryNameTaken` | `Ya existe una categoría activa con ese nombre.` |
| `categoryRestoreNameTaken` | `No se puede restaurar: ya existe una categoría activa con ese nombre.` |
| `categoryNotManaged` | `Solo se pueden gestionar categorías de gastos.` |
| `archiveFailed` | `No se pudo archivar.` |
| `restoreFailed` | `No se pudo restaurar.` |
| `cardOrderSaveFailed` | `No se pudo guardar el orden.` |

Reused: `saveFailed`, `categoryMissing`, `categoryUnavailable`. A test asserts `nameTooLong`
contains `String(NAME_MAX_LENGTH)` so the literal cannot drift from the constant.

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json`, `pnpm-lock.yaml` | Modify | `pnpm add @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0` |
| `app/(shell)/inicio/page.tsx` | Modify | Inicio container (Data Flow) |
| `app/(shell)/perfil/page.tsx` | Modify | Perfil container |
| `app/(shell)/inicio/page.test.ts`, `app/(shell)/perfil/page.test.ts` | Create | Container tests with mocked repositories (change-2 page-test pattern) |
| `app/actions/cardOrder.ts` (+ test) | Create | `reorderCardsAction` |
| `app/actions/members.ts` (+ test) | Create | create / archive / restore member |
| `app/actions/categories.ts` (+ test) | Create | create / rename / archive / restore category |
| `app/actions/setTheme.ts` (+ new `setTheme.test.ts`) | Modify | `assertSession` first |
| `lib/actions/state.ts` | Modify | `NameFormState`, `MutationResult`, `INITIAL_NAME_FORM_STATE` |
| `lib/actions/revalidate.ts` | Create | `revalidateShellTabs()` |
| `lib/db/errors.ts` (+ test) | Create | `isUniqueViolation`, constraint constants, schema-name source guard |
| `lib/db/repositories/categories.repository.ts` | Modify | `renameCategory`, `unarchiveCategory`, `listArchivedCategories` |
| `lib/db/repositories/members.repository.ts` | Modify | `unarchiveMember`, `listArchivedMembers` |
| `lib/db/repositories/transactions.repository.ts` | Modify | `listRecentTransactions` |
| `lib/db/repositories/cardOrder.repository.ts` | Modify | `getStoredCardOrder` (archived included) |
| `lib/db/repositories/archiveReads.test.ts` | Modify | `must-only-archived` kind + five entries |
| `lib/domain/cardOrder.ts` (+ test) | Create | `mergeCardOrder`, `checkCardOrderIds`, `sameOrder` |
| `lib/domain/categoryIcons.ts` (+ test) | Create | `CATEGORY_ICON_KEYS`, `isCategoryIconKey` |
| `lib/domain/settings.ts` (+ test) | Create | `checkManagedCategory`, `checkMemberArchivable` |
| `lib/domain/balance.ts` (+ test) | Modify | `monthBalance` (`totalBalance` untouched) |
| `lib/domain/validation.ts` (+ test) | Modify | `NAME_MAX_LENGTH`, `parseName`, `parseIdList` |
| `lib/domain/month.ts` (+ test) | Modify | `monthNameOf` |
| `lib/domain/messages.ts` | Modify | New keys (table above) |
| `lib/copy/es.ts` (+ test for functions) | Modify | `HOME_COPY`, `PROFILE_COPY`, `ICON_LABELS`, announcement and label functions |
| `lib/view/home.ts` (+ test) | Create | `HomeCardView`, `buildHomeCards`, `moveId` |
| `lib/view/settings.ts` (+ test) | Create | Settings row views |
| `components/ui/CategoryIcon.tsx` (+ test) | Modify | Map typed by `CategoryIconKey` |
| `components/molecules/{HomeCategoryCard,IconPicker,RenameForm,SettingsRow}.tsx` (+ tests) | Create | Molecules |
| `components/organisms/{BalanceCard,SortableCategoryGrid,SortableCategoryCard,RecentMovements,MemberSettings,CategorySettings,ArchivedSection,ThemeSwitch}.tsx` (+ tests) | Create | Organisms |
| `components/screens/{HomeScreen,ProfileScreen}.tsx` (+ tests) | Create | Screens |
| `app/globals.css` | Modify | Grid, card (touch CSS), balance, settings, archived, icon picker styles via existing custom properties |
| `lib/domain/greeting.ts`, `lib/domain/balance.ts#totalBalance` | Unchanged | Kept, not rendered |
| `lib/db/schema.ts`, `drizzle/**` | Unchanged | No migration |

## Interfaces / Contracts

```ts
// lib/actions/state.ts (additions)
export type NameField = "name" | "icon" | "id";
export type NameFormState =
  | { status: "idle" }
  | { status: "error"; fieldErrors: Partial<Record<NameField, string>>; formError: string | null }
  | { status: "saved"; id: number; name: string };
export type MutationResult = { status: "ok" } | { status: "error"; message: string };
export const INITIAL_NAME_FORM_STATE: NameFormState; // { status: "idle" }

// Form field names
// member add: name · category add: name, icon · category rename: id, name

// lib/domain/balance.ts
export function monthBalance(transactions: readonly DomainTransaction[], monthKey: MonthKey): number;
```

## Testing Strategy

Vitest only (`pnpm test`, `TZ=UTC`). No live database; no Playwright (deferred by config).

| Layer | What | Approach |
|---|---|---|
| Unit (domain) | `mergeCardOrder`: every spec scenario (`[c,a]`+`[a,b,c,d]`→`[c,a,b,d]`; `[b]`+`[x,y,b,z]`→`[b,x,y,z]`; duplicates in both inputs; empty inputs; input arrays not mutated; property-style check that the result is a permutation of `unique(visible ∪ stored)`). `checkCardOrderIds`, `sameOrder`. `monthBalance` (income − expense, net used, half-open boundaries at month start / next-month start, empty → 0, negative). `parseName` (trim, blank, non-string, exactly 40 code points OK, 41 rejected, accented names counted by code point). `parseIdList` (non-array, string elements accepted only as integer strings per `parsePositiveId`, `-1`, `1.5`, `{}`, duplicates removed, over max, empty). `isCategoryIconKey`, `CATEGORY_ICON_KEYS.length === 21`. `checkManagedCategory`, `checkMemberArchivable`. `monthNameOf`. | Pure, table-driven, no mocks |
| Unit (view / copy) | `buildHomeCards` (income excluded; unbudgeted excluded; **archived with a budget excluded**; stored order `[c,a]` over a,b,c → c,a,b; progress capped/uncapped/over-budget; colour via `categoryColor`). `moveId`. Copy functions (announcement strings with positions; `Balance de octubre`). `nameTooLong` mentions `NAME_MAX_LENGTH`. | Pure |
| Unit (db helpers) | `isUniqueViolation`: direct `{code, constraint}`, nested `DrizzleQueryError`-like `cause`, wrong constraint → false, other code → false, non-object → false, cyclic cause terminates. Schema source contains both constraint names. | Pure + source scan |
| Architecture | `architecture.test.ts` unchanged and green (`lib/domain` imports no React, Next, Drizzle, `lib/db`, or `@dnd-kit`); `archiveReads.test.ts` extended (Decision 4). | Source scans |
| Action (integration-lite) | For **every** new action and `setTheme`: absent/tampered session → throws `UnauthorizedError` and **no repository mock / `cookies().set` / `revalidatePath` is called**. Invalid input (blank/overlong name, missing icon, bad id) → message, no repository call. Unique violation (mock rejects with a `DrizzleQueryError`-shaped error carrying `code: '23505'` and the constraint) → duplicate message, no `revalidatePath`. Last active member (pure path and race path). Income category id → `categoryNotManaged`, no write. Idempotent archive/restore → ok, no write. `createCategoryAction` passes `kind: 'expense'`, the picked icon, and `nextColorIndex(activeCount)`. Reorder: archived/unknown/income id → error and `replaceCardOrder` not called; duplicates deduped before merge; `replaceCardOrder` called once with `mergeCardOrder(visible, stored)` where `stored` includes an archived id (preserved); identical order → no write; success → `revalidatePath('/inicio')` only. Success paths → `revalidateShellTabs` paths called. | `vi.mock('next/headers')`, `vi.mock('next/cache')`, `vi.mock('@/lib/db/repositories/…')` — the change-2 action-test pattern |
| Component (jsdom) | `HomeScreen`: greeting, balance label, no month stepper, empty grid + empty recent states independently. `SortableCategoryGrid`: renders cards in the given order, cards expose `aria-roledescription="categoría reordenable"`, the Spanish instructions text is in the DOM, and `renderToString` markup carries `aria-describedby="home-card-grid"` (stable id). `IconPicker`: exactly 21 radios with Spanish labels, selection writes the hidden input. `CategorySettings` / `MemberSettings`: archive opens `ConfirmDialog`, cancel calls no action, confirm calls it once; field errors render. `ArchivedSection`: lists both kinds, restore calls the action without confirmation, error message renders, empty message. `ThemeSwitch`: current preference selected, three options, change calls `setTheme` with the mapped value. `CategoryIcon`: every key renders its icon, unknown → `Tag`. | `@testing-library/react`, `// @vitest-environment jsdom`, mocked actions |
| Not unit-tested | Real pointer/touch/keyboard drag gestures (dnd-kit measures layout with `getBoundingClientRect`, which jsdom returns as zeros), iOS callout/selection suppression, the 180 ms touch delay versus scroll, and screen-reader output. | Manual check on an iPhone and desktop on the preview deployment; UI tests kept light by design |
| Repository SQL | `renameCategory`, `unarchive*` (including a real 23505 from the partial index), `listArchived*`, `listRecentTransactions`, `getStoredCardOrder` against Postgres | **Deferred** (no Neon test branch, same as changes 1–2); verified on the preview deployment against a Neon branch |
| E2E | Full flows | Deferred per `openspec/config.yaml` |

## Threat Matrix

The trigger is **HTTP routing**: eight new Server Actions (plus the hardened `setTheme`) are
POST-reachable endpoints. No shell, subprocess, Git, PR automation, or executable-file
classification is involved.

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
| Any new action or `setTheme` invoked with absent / tampered / expired `tm_session` (e.g. POST to public `/login` with a `Next-Action` header) | `assertSession` throws before any parse, read, write, cookie, or revalidation | never reads or writes data; theme cookie untouched |
| `reorderCardsAction("1,2")`, `[1, "x"]`, `[-1]`, `[1.5]`, `{}`, 10 000 ids | rejected by `parseIdList`, no repository call | never forwards a non-integer or unbounded id list |
| `reorderCardsAction([<archived id>])`, foreign/unknown id, income id | rejected by `checkCardOrderIds`, no write | card order unchanged |
| `archive*/restore*Action('1; DROP')`, `0`, `{}` | rejected by `parsePositiveId`, no repository call | no query issued |
| `renameCategoryAction` / `restoreCategoryAction` targeting an income category id | `categoryNotManaged`; the `kind` predicate also blocks the write | income categories stay fixed (Q9) |
| `createCategoryAction` with `icon = "../x"` or an unmapped lucide name | `iconRequired`, no write | only the 21 mapped keys are ever stored |

## Migration / Rollout

**No migration required.** No schema, index, constraint, enum, or seed change; nothing is added
under `drizzle/`. Rollout is a normal Vercel deployment; rollback is a revert plus Vercel instant
rollback (proposal Rollback Plan). Data written by this change (new, renamed, archived, restored
rows; card order including archived ids) is valid under the change-1 schema and is read normally by a
reverted build (`getCardOrder` already ignores archived ids). The change ships as one PR under the
`single-pr` strategy; the proposal records that a new `size:exception` decision is required before
apply.

## Open Questions

- [ ] Non-blocking: duplicate names are exact-match after trim (the database rule). "Ana" and "ana"
      can both be active. A case-insensitive pre-check would need a read and a domain rule that no
      spec requires; left out unless the user asks.
- [x] Resolved: the `theming` spec was corrected after this design was written; the switch reflects
      the stored **preference** (a `system` preference shows "Sistema"), matching this design.
- [x] Verified in task 1.2: a provided `id` is used verbatim as the `aria-describedby` target (not `DndDescribedBy-<id>`); originally assumed to derive it from
      the `DndContext` `id` prop, and `useSortable` accepts `attributes.roleDescription` (both
      present in 6.x typings to the best of current knowledge; the component test pins them).
