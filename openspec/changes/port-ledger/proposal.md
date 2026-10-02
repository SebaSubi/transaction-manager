# Proposal: Port Ledger — Movimientos, Presupuesto, and the Add/Edit Sheet

## Intent

Change 1 (`port-foundation`, archived 2026-10-02) shipped the database, auth gate, shell, and a
tested domain core, but every tab is still a placeholder and the center FAB is inert. Production
now holds real household data, yet nobody can record, correct, or delete a movement or set a
monthly budget through the app. This change delivers the write paths and the two ledger screens
so the household can actually run its month in the app, and so change 3 (`port-dashboard`) has
real transactions and budgets to render on "Inicio".

Success: from a phone, a member can add an expense with cashback in seconds, find and fix or
delete it in "Movimientos", and set or copy the month's budget in "Presupuesto", with every
number produced by the existing `lib/domain/` functions.

## Scope

### In Scope
- **Add/edit bottom sheet** opened from the FAB (create) and from a list row (edit): type
  (expense/income) swapping the category set by `kind`, whole-peso gross, cashback percent
  (expenses only), category, member ("Quién"), and a date/time field.
- **Server Actions** in `app/actions/` for create, update, and delete transaction, and for
  upsert, remove, and copy budget rows. Net is computed once, server-side, via
  `computeNetAmount`; "now" comes only from `nowInBuenosAires`.
- **"Movimientos" screen**: month-scoped list (current month by default), ‹ › month stepper,
  type/category/member/date filters, the 3-state sort toggle, edit via the sheet, and hard delete
  behind a confirmation prompt. Optimistic row updates.
- **"Presupuesto" screen**: per-month expense budgets with the same ‹ › month stepper, progress
  per category via `budgetProgress`, add a category row, edit an amount, remove a row, and
  "Copiar presupuesto de {mes}" from the previous month.
- **Repository additions**: `getTransactionById`, `updateTransaction`, `deleteTransaction`,
  `deleteBudget`, a fill-missing budget copy, and member/category by-id reads that resolve
  archived rows.
- **`lib/domain/format.ts`** (`formatArs`, `formatShortDate`), deferred from change 1, with unit
  tests.
- **Last-used member cookie** (per device) to default "Quién" on create.
- Neutral Spanish copy for empty, validation, and error states.
- Vitest coverage for every new domain function, input validation, and the Server Actions'
  validation paths.

### Out of Scope
- "Inicio" (balance card, category grid, drag-to-reorder, recent movements) and "Perfil" (theme
  switch UI, members, categories, archive controls) — change 3.
- Creating, renaming, or archiving categories or members (Q12) — change 3.
- Income budgets; "Presupuesto" is expense-only (Q11).
- Soft delete or undo for transactions; recovery of a hard-deleted row (Q3).
- Any schema migration (none is required; see Rollback Plan).
- Playwright / E2E (still deferred per `openspec/config.yaml`).
- Search, export, recurring transactions, multi-currency.

## Product Decisions

Decisions recorded in Engram topic `sdd/port-ledger/product-decisions` (obs #997). These are
final for this change. Q1, Q2, Q3, Q5, and Q6 were answered directly by the user.

| # | Decision | Source |
|---|----------|--------|
| Q1 | "Movimientos" shows the current month by default, with a month selector | User |
| Q2 | "Quién" defaults to the last-used member on this device (cookie) | User |
| Q3 | Delete a transaction = hard delete behind a confirmation prompt; no migration | User |
| Q4 | Month selector is a ‹ prev / next › stepper, no fixed range, future months allowed | **Defaulted on the user's delegation** |
| Q5 | Copying a budget fills only missing categories; it never overwrites existing rows | User |
| Q6 | Create has a date/time field defaulting to now (Buenos Aires), editable | User |
| Q7 | Editing a transaction whose category/member is archived keeps that value shown and selected; the user may switch to an active one | **Defaulted on the user's delegation** |
| Q8 | Gross is whole pesos only (decimals rejected with a message); cashback 0–100% with up to 2 decimals, stored as basis points | **Defaulted on the user's delegation** |
| Q9 | Budget amount must be > 0; removing a budget row is always allowed and never touches transactions | **Defaulted on the user's delegation** |
| Q10 | Empty-state and error copy is short, neutral Spanish; exact strings fixed in design | **Defaulted on the user's delegation** |
| Q11 | "Presupuesto" is expense-only | **Defaulted on the user's delegation** |
| Q12 | No category/member management in this change | **Defaulted on the user's delegation** |

The "defaulted on the user's delegation" rows were applied by the agent after the user delegated
those choices ("I'm always picking the recommended one"). They are listed so the user can revisit
them at any later review.

## Deviations from the Design Analysis

Called out per `openspec/config.yaml` `rules.proposal`.

| Design behavior | This change | Driver |
|-----------------|-------------|--------|
| "Movimientos" lists all transactions ever, narrowed only by filters | Month-scoped list, current month by default | Q1 |
| Month picker is a fixed list of 2026 months | ‹ › stepper over any month, past or future, no fixed range | Q4 |
| "Copiar presupuesto de {mes}" replaces the current month's budgets | Fill-only-missing: copies categories absent from the current month; existing rows are untouched | Q5 |
| Date/time input only appears when editing; create uses "now" implicitly | Date/time field shown on create too, defaulting to now | Q6 |
| Active member (`profileUser`) is in-memory, lost on refresh | Last-used member persisted per device in a cookie | Q2 |
| Category/member delete in the prototype | Out of scope here; archive (soft-delete) remains the binding change-1 policy | Q12 |

Domain rules that are **not** changed: cashback net/gross math and its single rounding, expenses-
only cashback, all-time `totalBalance`, capped bar / uncapped label / over-budget colour switch,
the 3-state sort cycle, half-open month ranges, and Buenos Aires wall-clock "now".

## Capabilities

### New Capabilities
- `transaction-entry`: the add/edit bottom sheet — field set, type-driven category set, whole-
  peso and cashback validation, date/time default, last-used member cookie, archived-value
  handling on edit, and the create/update Server Action contract.
- `transaction-ledger`: the "Movimientos" screen — month scoping and stepper, filters, 3-state
  sort, list rendering with formatted amounts and dates, empty state, and hard delete with
  confirmation.
- `monthly-budgets`: the "Presupuesto" screen — expense-only per-month budget rows, amount
  validation, row add/remove, progress display, and fill-only-missing copy from the previous
  month.

### Modified Capabilities
- `app-shell-navigation`: the "Placeholder screens only" requirement no longer holds for
  "Movimientos" and "Presupuesto"; the center FAB gains behavior (opens the add sheet).
- `financial-domain-rules`: adds `formatArs` and `formatShortDate`, and the pure fill-only-missing
  budget copy rule.
- `data-persistence`: the repository boundary gains transaction update/hard delete, budget
  delete, and the fill-missing copy; states that transaction hard delete is permitted while
  categories/members remain archive-only.

## Approach

Adopt exploration Approach 1 (Engram `sdd/port-ledger/explore`, obs #995):

- **URL search params are the source of truth** for month, filters, and sort on both screens.
  Pages stay Server Components that read params, call repositories with the half-open
  `monthRange()`, and apply `filterTransactions` / `sortTransactions` / `budgetProgress`.
- **Thin client islands** only where interaction requires it: the bottom sheet (open state shared
  with the FAB in `BottomNav`), the month stepper and filter controls (which only rewrite the
  URL), and an optimistic list wrapper using `useOptimistic`.
- **Server Actions** validate input server-side (whole-peso gross, cashback to bps, budget
  amount > 0, active category/member on create), compute net with `computeNetAmount`, write via
  repositories, set the last-used member cookie, and revalidate the affected routes. The client
  never computes the stored net.
- **No schema change.** The existing tables, checks (`cashback_bps` range, income-no-cashback,
  `amount <= gross`), and `budgets_month_category_uq` already support every operation; the copy
  uses an insert that skips conflicts on that unique index, which is exactly fill-only-missing.
- Per `AGENTS.md`, the installed Next.js has breaking changes; design and apply MUST consult
  `node_modules/next/dist/docs/` for Server Actions, `cookies()`, search params, and
  `useOptimistic` before writing code.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/(shell)/movimientos/page.tsx` | Modified | Placeholder replaced by the month-scoped ledger |
| `app/(shell)/presupuesto/page.tsx` | Modified | Placeholder replaced by the monthly budget screen |
| `app/(shell)/layout.tsx` | Modified | Hosts the sheet provider shared with the FAB |
| `components/organisms/BottomNav.tsx` | Modified | FAB opens the add sheet |
| `components/organisms/` (sheet, list, budget rows, month stepper, filters) | New | Screen organisms and client islands |
| `components/molecules/` | New | Row, filter chip group, amount field, confirmation prompt |
| `app/actions/` | New | Transaction and budget Server Actions |
| `lib/db/repositories/transactions.repository.ts` | Modified | `getTransactionById`, `updateTransaction`, `deleteTransaction` |
| `lib/db/repositories/budgets.repository.ts` | Modified | `deleteBudget`, fill-missing copy |
| `lib/db/repositories/{categories,members}.repository.ts` | Modified | By-id reads that resolve archived rows |
| `lib/domain/format.ts` (+ tests) | New | `formatArs`, `formatShortDate` |
| `lib/domain/` validation / budget-copy helpers (+ tests) | New | Pure input parsing and copy planning |
| `lib/` cookie helper for last-used member | New | Read/write of the per-device member cookie |
| `lib/db/schema.ts`, `drizzle/` | Unchanged | No migration |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Hard delete destroys a real transaction irrecoverably on a mis-tap | Med | Mandatory confirmation prompt; delete only from the edit sheet or an explicit row action, never a swipe; Neon history restore as last resort |
| Change exceeds the 400-line review budget (~1,300 lines) under `single-pr` | High | **A `size:exception` is required.** `sdd-tasks` MUST forecast the overage; the human decides the exception before `sdd-apply` starts |
| Optimistic row diverges from server truth (e.g. net rounding, rejected input) | Med | Server Action returns the persisted row; optimistic state reconciles on revalidation; net is never computed client-side for storage |
| Next.js version differs from training data (Server Actions, cookies, params APIs) | Med | Read `node_modules/next/dist/docs/` before design and apply, per `AGENTS.md` |
| Month scoping hides the date-range filter's cross-month use | Low | See open item below; spec MUST define the interaction |
| Last-used member cookie points to a member later archived | Low | Fall back to the first active member when the cookie's member is archived or missing |
| FAB lives in a client component under a server layout; sheet state wiring leaks client boundaries | Low | A single small context provider in the shell layout; pages remain Server Components |

**Q13 — date filters vs. selected month (defaulted on the user's delegation):** the date-from/date-to
filters narrow results *within* the selected month only; the month stepper always defines the outer
range. Values outside the selected month are clamped to it, and changing month clears the date filters.

## Rollback Plan

**No schema migration is part of this change**, so no expand-contract sequence is needed and
rollback carries no schema risk. Rollback is a plain revert of the change's commits plus Vercel
instant rollback to the previous deployment.

- **Data written during the change's lifetime stays valid after rollback.** New and edited
  transactions and budget rows use the change-1 schema and its checks, so the reverted app (and
  change 3) reads them normally.
- **Hard deletes are not reversible by rollback.** Recovering a deleted transaction requires a
  Neon history/branch restore within the plan's retention window. This is accepted under Q3.
- **Budget copy is additive** (fill-only-missing), so rollback never needs to undo overwritten
  values; at worst, copied rows remain and can be removed individually.
- The last-used member cookie is harmless if the reverted app ignores it.

## Dependencies

- Change 1 (`port-foundation`) archived and deployed: schema, repositories, `lib/domain/`, shell,
  and Vitest harness.
- Engram product decisions `sdd/port-ledger/product-decisions` (obs #997).
- Human decision on `size:exception` for the single PR before apply.

## Success Criteria

- [x] Tapping the FAB on any tab opens the add sheet; saving an expense of gross 33333 with 7%
      cashback persists `amount = 31000`, `gross = 33333`, `cashback_bps = 700`.
- [x] Income transactions cannot carry cashback, and their category set is exactly the 3 income
      categories.
- [x] Gross with decimals and cashback outside 0–100 or with more than 2 decimals are rejected
      server-side with a Spanish message.
- [x] The date/time field defaults to Buenos Aires now on create and is editable; the stored date
      matches the entered wall-clock value.
- [ ] "Quién" defaults to the last member used on this device, falling back to an active member.
- [ ] "Movimientos" opens on the current month; ‹ › moves across years and into future months;
      filters and sort are reflected in the URL and survive a reload.
- [x] Editing a transaction with an archived category or member shows that value selected.
- [ ] Deleting a transaction requires confirmation and removes the row permanently.
- [x] "Presupuesto" shows expense categories only; amounts must be > 0; removing a row leaves
      transactions untouched.
- [x] "Copiar presupuesto de {mes}" adds only categories missing from the current month and never
      changes an existing amount.
- [x] `formatArs`, `formatShortDate`, and the new validation/copy helpers have passing unit tests;
      `lib/domain/` still imports no React, Next.js, Drizzle, or `lib/db/`.
- [x] `pnpm test` and `pnpm build` pass; no migration file is added under `drizzle/`.
- [x] No UI copy is in English; no code, identifier, or comment is in Spanish.
