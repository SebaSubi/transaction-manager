# Proposal: Port Dashboard — Inicio and Perfil

## Intent

Changes 1 (`port-foundation`) and 2 (`port-ledger`) shipped the schema, auth, shell, the add/edit
sheet, "Movimientos", and "Presupuesto". "Inicio" and "Perfil" are still empty placeholders, so the
household has no at-a-glance view of the month and no way to manage members, categories, or the
theme from the app. Categories and members can only be changed by editing the database.

This change (3 of 3) completes the port: "Inicio" becomes the monthly dashboard (balance, budgeted
category grid with drag-to-reorder, recent movements) and "Perfil" becomes the household settings
screen (members, expense categories, archived items with restore, theme switch).

Success: from a phone, a member opens the app and sees this month's balance, the budgeted
categories in the order they arranged, and the last five movements; in "Perfil" they can add,
rename, archive, and restore categories, add, archive, and restore members, and switch the theme,
all without touching the database and without a schema migration.

## Scope

### In Scope
- **"Inicio" screen** (Server Component page, thin client islands):
  - Static header greeting "¡Buenas!" (no name, no time-of-day logic) (Q7).
  - Balance card for the **current Buenos Aires month only**: net income minus net expense over
    the half-open `monthRange()` of the current month (Q1). No month selector (Q6).
  - Category grid of **expense categories with a budget in the current month** only (Q8), each card
    showing `budgetProgress` (capped bar, uncapped label, over-budget colour), ordered by
    `orderCategories` over the stored card order.
  - **Drag-to-reorder** of the grid with `@dnd-kit/core` 6.3.1 + `@dnd-kit/sortable` 10.0.0:
    `TouchSensor` (delay 180 ms, tolerance 8 px), `KeyboardSensor`, Spanish screen-reader
    announcements, `rectSortingStrategy` for the 2-column grid, optimistic order via
    `useOptimistic`, stable `DndContext` id to avoid SSR hydration mismatches.
  - **Last 5 movements**; tapping one opens the existing edit sheet (Q2).
- **"Perfil" screen**:
  - Members: list active members, add a member, archive a member (allowed with transactions;
    last active member blocked, already enforced by `archiveMember`) (Q5).
  - Expense categories only (Q9): list, add (name + icon picked from the 21 icons already mapped in
    `CategoryIcon`, colour from `nextColorIndex`) (Q10), **rename (name only)** (Q3), archive
    (allowed even with a budget this month) (Q11).
  - **"Archivadas" section** listing archived members and archived expense categories, each with a
    restore action. Restore fails with a Spanish message when an active row already has the same
    name (enforced by the existing partial unique indexes) (Q4).
  - Theme switch (Oscuro / Claro / Sistema) using the existing `SegmentedControl` and `setTheme`.
- **Server Actions** in `app/actions/`: create/rename/archive/restore category, create/archive/
  restore member, reorder cards. Every action calls `assertSession`, validates input, writes via
  repositories, maps unique-index violations to Spanish messages, and revalidates the affected
  routes.
- **Hardening**: add `assertSession` to `app/actions/setTheme.ts`, the only mutating action
  without it.
- **Repository additions** (no schema change): `listRecentTransactions(limit)`, category rename,
  unarchive for categories and members, `listArchived` reads for categories and members, and a
  month-scoped read for the balance (existing `listTransactionsInRange` or an SQL sum; design
  decides).
- **Pure domain additions** (with Vitest): `mergeCardOrder` (visible order first, then the stored
  remainder, deduplicated, so persisting the visible subset never drops other categories'
  positions; required because `replaceCardOrder` replaces the whole order), name validation
  (trim, non-empty, max length), and the month balance rule. New Spanish messages in
  `lib/domain/messages.ts`.
- Vitest coverage for new domain functions, action validation paths, and the new components.

### Out of Scope
- Any schema migration (none required; see Rollback Plan).
- Category recolor or icon change after creation; member rename (not requested).
- Income category management; income categories stay fixed (Q9).
- Month selector on "Inicio" (Q6); all-time balance display (Q1).
- Personalized or time-based greeting (Q7).
- "Who am I" identity chips (`profileUser`) in the "Inicio" header or "Perfil" card.
- Hard delete of members or categories; archive remains the only removal.
- Playwright / E2E (still deferred per `openspec/config.yaml`).

## Product Decisions

All decisions were answered by the user and recorded in Engram topic
`sdd/port-dashboard/product-decisions` (obs #1011). They are final for this change.

| # | Decision |
|---|----------|
| Q1 | Balance card shows the current Buenos Aires month only (net income − net expense) |
| Q2 | Last 5 movements; tapping one opens the existing edit sheet |
| Q3 | Categories can be renamed (name only) |
| Q4 | "Archivadas" section in "Perfil" with restore for members and categories; duplicate active name fails with a Spanish message |
| Q5 | Archiving a member with transactions is allowed; last active member is blocked |
| Q6 | No month selector on "Inicio" |
| Q7 | Greeting is a static "¡Buenas!" with no name |
| Q8 | Grid shows only expense categories budgeted this month |
| Q9 | "Perfil" manages expense categories only |
| Q10 | New category icon picked from the 21 mapped icons; colour from `nextColorIndex` |
| Q11 | Archiving a category with a budget this month is allowed |

## Deviations from the Design Analysis

Called out per `openspec/config.yaml` `rules.proposal`.

| Design behavior | This change | Driver |
|-----------------|-------------|--------|
| "Inicio" balance card shows the all-time `totalBalance` | Balance card shows the current month only (income − expense of the current Buenos Aires month) | Q1 |
| Header greeting is time-based (`greeting()`: "Buenos días" / "Buenas tardes" / "Buenas noches") plus the member's name | Static "¡Buenas!" with no name | Q7 |
| `profileUser` identity chips in the "Inicio" header and "Perfil" card | Not ported; the last-used member cookie from change 2 remains the only identity hint | Out of scope |
| Prototype category/member delete | Archive with restore; no hard delete | Change-1 archive policy, Q4 |

**Domain functions kept in place:**
- `totalBalance` (all-time) stays unchanged in `lib/domain/balance.ts` and in the
  `financial-domain-rules` spec. It is no longer rendered anywhere, but it remains a valid,
  tested domain rule for future use. The month balance is a separate rule, not a redefinition.
- `greeting.ts` **is kept, unused**. Decision: keep it rather than remove it, because removal
  would require a REMOVED delta on the `greeting` requirement in `financial-domain-rules` and
  deleting tested code for no functional gain; reverting Q7 later costs one line. The spec phase
  MUST NOT modify or remove the `greeting` requirement.

Domain rules that are **not** changed: cashback net/gross math, `budgetProgress` capped bar /
uncapped label / over-budget colour, `orderCategories` append-unknown-at-end, `categoryColor`
accent cycle, per-month budgets, half-open month ranges, Buenos Aires wall-clock "now", archive
semantics (no cascade, last active member guard), and the three theme values.

## Capabilities

### New Capabilities
- `home-dashboard`: the "Inicio" screen — static greeting, current-month balance card, grid of
  expense categories budgeted this month with progress, drag-to-reorder (touch, keyboard, Spanish
  announcements, optimistic order, persistence via merge), last 5 movements opening the edit
  sheet, and empty states.
- `household-settings`: the "Perfil" screen — member list/add/archive, expense category
  list/add (icon picker, auto colour)/rename/archive, "Archivadas" with restore and duplicate-name
  error, theme switch, and the Server Action contracts for these operations.

### Modified Capabilities
- `app-shell-navigation`: MODIFIED "Tab screens" — "Inicio" and "Perfil" render functional
  screens; no placeholder tabs remain.
- `financial-domain-rules`: ADDED `mergeCardOrder`, name validation, and the current-month balance
  rule. `totalBalance` and `greeting` are NOT modified.
- `data-persistence`: ADDED category rename, unarchive (restore) for categories and members with
  the duplicate-active-name rejection, archived-row listing, recent-transactions read, and card
  order persistence via merge. "Archive semantics (soft-delete)" MAY be MODIFIED to state that
  restore clears `archived_at` (design/spec decide ADDED vs. MODIFIED).
- `theming`: ADDED a user-facing theme switch and the requirement that the `setTheme` action
  rejects requests without a valid session.

**Spec-phase gotcha (from change 2):** a requirement that does not already exist in the main spec
under `openspec/specs/` MUST go under `## ADDED Requirements`, not `## MODIFIED Requirements`.
Only "Tab screens" (and optionally "Archive semantics") are true MODIFIED entries here; every
other delta above is ADDED.

## Approach

Adopt the exploration recommendation (Engram `sdd/port-dashboard/explore`, obs #1010):

- **Server Component pages** for `app/(shell)/inicio/page.tsx` and `app/(shell)/perfil/page.tsx`
  read data through repositories and pure domain functions; client islands only where interaction
  requires it (sortable grid, rename/add forms, confirm dialogs, theme switch).
- **Reorder flow:** `reorderCardsAction` → `assertSession` → validate ids are active categories of
  the household and deduplicate → `mergeCardOrder(visibleOrder, storedOrder)` →
  `replaceCardOrder` → `revalidatePath('/inicio')`. Last write wins on concurrent reorders
  (accepted).
- **Rename and restore** reuse existing columns (`name`, `archived_at`). Unique-violation errors
  from the partial unique indexes are caught in the action and mapped to a Spanish message;
  domain name validation runs first to reject empty or overlong names before hitting the DB.
- **Recent movements** reuse `toLedgerRowView` and the change-2 `EntrySheetProvider` edit entry
  point; no new sheet.
- **No schema change.** `members.archived_at`, `categories.archived_at`, the `card_order` table,
  and the partial unique indexes already support every operation.
- Per `AGENTS.md`, design and apply MUST consult `node_modules/next/dist/docs/` for Server
  Actions, `revalidatePath`, and `useOptimistic` before writing code.
- **Dependency install** (`pnpm add @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0`) MUST be an
  explicit task, per `rules.tasks`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/(shell)/inicio/page.tsx` | Modified | Placeholder replaced by the dashboard |
| `app/(shell)/perfil/page.tsx` | Modified | Placeholder replaced by household settings |
| `components/screens/` (`HomeScreen`, `ProfileScreen`) | New | Screen compositions |
| `components/organisms/` (balance card, sortable category grid, recent movements, member list, category list, archived list, add forms, theme switch) | New | Screen organisms and client islands |
| `components/molecules/` (category card, icon picker, rename field) | New | Reusable pieces |
| `components/ui/CategoryIcon.tsx` | Modified (minor) | Expose the 21 mapped icon keys for the picker |
| `app/actions/categories.ts`, `app/actions/members.ts`, `app/actions/cardOrder.ts` (+ tests) | New | Perfil and reorder Server Actions |
| `app/actions/setTheme.ts` | Modified | Adds `assertSession` |
| `lib/db/repositories/{categories,members,transactions,cardOrder}.repository.ts` | Modified | Rename, unarchive, listArchived, listRecent, merge-backed persistence |
| `lib/domain/` (card order merge, name validation, month balance, messages) (+ tests) | New/Modified | Pure helpers and Spanish messages |
| `lib/domain/greeting.ts`, `lib/domain/balance.ts` (`totalBalance`) | Unchanged | Kept in place, not rendered |
| `package.json`, `pnpm-lock.yaml` | Modified | Adds `@dnd-kit/core` and `@dnd-kit/sortable` |
| `lib/db/schema.ts`, `drizzle/` | Unchanged | No migration |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Change exceeds the 400-line review budget under `single-pr` (forecast ~2,000–2,600 authored lines) | High | **A new `size:exception` decision is required for this change.** The change-2 exception does not carry over. `sdd-tasks` MUST forecast the overage and the human decides before `sdd-apply` |
| Persisting only the visible (budgeted) cards wipes stored positions of other categories, because `replaceCardOrder` deletes the whole order | High (if unmitigated) | Pure, tested `mergeCardOrder`; the action always persists the merged full order |
| Create/rename/restore collides with the partial unique index on active names | Med | Domain validation first; catch the unique violation and return a Spanish message; no partial write |
| Drag gestures conflict with page scroll or iOS long-press callout / text selection | Med | `TouchSensor` 180 ms / 8 px, `touch-action` and `user-select` styles on cards; keyboard path as an alternative |
| `DndContext` SSR `aria-describedby` hydration mismatch | Med | Stable explicit `id` on `DndContext` |
| Reorder action receives foreign, archived, or duplicated ids | Low | Server-side validation against active household categories; deduplicate before merge |
| Users read the month balance as a running total | Low | Card label states the month (e.g. "Balance de octubre"); `totalBalance` stays available if Q1 is revisited |
| Next.js version differs from training data | Med | Read `node_modules/next/dist/docs/` before design and apply |
| Concurrent reorders on two devices | Low | Last write wins; accepted |

## Rollback Plan

**No schema migration is part of this change**, so no expand-contract sequence is needed and
rollback carries no schema risk. Rename and restore use the existing `name` and `archived_at`
columns; reorder uses the existing `card_order` table. Rollback is a plain revert of the change's
commits plus Vercel instant rollback to the previous deployment.

- **Data written during the change's lifetime stays valid after rollback.** New, renamed,
  archived, and restored members and categories, and stored card order, all use the change-1
  schema; the reverted app reads them normally (archived rows remain archived, restored rows are
  simply active).
- **Renames are not undone by rollback**; the new names persist. Acceptable: a rename is a
  user-intended edit and can be redone after the next deploy.
- **The `setTheme` hardening is safe to revert**; it only tightens access.
- The added `@dnd-kit` dependencies are removed by the revert of `package.json` and the lockfile.

## Dependencies

- Changes 1 (`port-foundation`) and 2 (`port-ledger`) archived and deployed.
- Engram product decisions `sdd/port-dashboard/product-decisions` (obs #1011) and exploration
  `sdd/port-dashboard/explore` (obs #1010).
- `@dnd-kit/core` 6.3.1 and `@dnd-kit/sortable` 10.0.0 (peer React >= 16.8; compatible with the
  installed React 19).
- Human decision on a `size:exception` for this single PR before apply.

## Success Criteria

- [ ] "Inicio" shows "¡Buenas!", the current month's balance (net income − net expense of the
      current Buenos Aires month), and no month selector.
- [ ] The grid shows exactly the expense categories with a budget this month, with
      `budgetProgress` values matching "Presupuesto".
- [ ] Reordering by touch and by keyboard persists across reloads, and reordering the visible
      subset never changes the stored relative order of non-visible categories.
- [ ] The last 5 movements are listed newest first; tapping one opens the edit sheet for it.
- [ ] In "Perfil", a member can add, rename, archive, and restore an expense category; new
      categories get a picked icon from the 21 mapped icons and a colour from `nextColorIndex`.
- [ ] Members can be added, archived (even with transactions), and restored; archiving the last
      active member is rejected with a Spanish message.
- [ ] Restoring or renaming to a name already used by an active row fails with a Spanish message
      and changes nothing.
- [ ] The theme switch changes the theme with no flash on reload; `setTheme` rejects requests
      without a valid session.
- [ ] Every new Server Action calls `assertSession`.
- [ ] `mergeCardOrder`, name validation, and the month balance rule have passing unit tests;
      `lib/domain/` still imports no React, Next.js, Drizzle, or `lib/db/`.
- [ ] `pnpm test` and `pnpm build` pass; no migration file is added under `drizzle/`.
- [ ] No UI copy is in English and none uses voseo; no code, identifier, or comment is in Spanish.
