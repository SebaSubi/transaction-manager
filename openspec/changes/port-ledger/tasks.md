# Tasks: Port Ledger — Movimientos, Presupuesto, and the Add/Edit Sheet

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,800 (range 2,400-3,400; roughly 55% tests, 45% production, additions dominate) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes (by size), but a single PR is the accepted route |
| Suggested split | Single PR on `feat/port-ledger`, reviewed commit by commit (one work-unit commit per phase) |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

size:exception accepted by user: the human explicitly accepted ONE large PR, so no chain strategy is pending. Reviewers should read commit by commit; each commit below is an independent, green, revertable unit.

Line estimate per phase (additions + deletions, rough): P2 domain ~650, P3 repositories ~250, P4 auth/state/copy ~250, P5 view ~500, P6 actions ~650, P7-P8 components ~550, P9 wiring/CSS ~300, P1/P10/P11 ~0 (no files).

### Conventions for apply

- Skill to load in apply: `work-unit-commits` at `~/.claude/skills/work-unit-commits/SKILL.md` (plan commits as reviewable work units with tests and docs alongside the behavior; Conventional Commits; no AI attribution).
- TDD: `strict_tdd` is false (`openspec/config.yaml`), but this plan is written test-first: every "RED" task is written and observed failing before its GREEN task. Test command `pnpm test`; build `pnpm build`; lint `pnpm lint`; typecheck `pnpm exec tsc --noEmit`. Focused runs: `pnpm exec vitest run <path>` under `TZ=UTC` (as configured by `pnpm test`).
- Rule from `AGENTS.md`: read `node_modules/next/dist/docs/` before writing any Server Action, `cookies()` or `searchParams` code (task 1.2). Never write those from memory.
- Architecture guard: `lib/domain/architecture.test.ts` must stay green; `lib/domain` and `lib/view` import no React, Next, Drizzle or `lib/db/client` (`lib/view` may `import type` from repositories).
- No file may be added under `drizzle/` and `lib/db/schema.ts` stays unchanged.
- UI copy is Spanish (neutral, no voseo); code, identifiers and comments are English.
- Tasks that only read a path mark it `(read-only)`.

### Suggested Work Units (commit boundaries)

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 (Phase 2) | Pure domain additions + sanctioned message table. Commit: `feat(domain): add formatting, validation, budget copy plan and date helpers` | single PR | `pnpm exec vitest run lib/domain` | N/A: pure functions, covered by unit tests | `lib/domain/**` additions only; nothing consumes them yet |
| 2 (Phase 3) | Repository by-id reads, update/delete, budget delete and copy. Commit: `feat(db): add by-id reads, transaction update/delete and budget copy repositories` | single PR | `pnpm exec vitest run lib/db/repositories` | N/A: SQL deferred to preview (task 11.1); source-guard tests run in Node | `lib/db/repositories/**` additions only |
| 3 (Phase 4) | Session assertion, action state types, cookie constants, UI copy. Commit: `feat(auth): add assertSession and action state/copy modules` | single PR | `pnpm exec vitest run lib/auth lib/actions` | N/A: unit tests with mocked `next/headers` | `lib/auth/requireSession.ts`, `lib/actions/**`, `lib/members/**`, `lib/copy/**` |
| 4 (Phase 5) | Pure view models, query schema, overlay reducer, filter options. Commit: `feat(view): add ledger and budget view models and URL query schema` | single PR | `pnpm exec vitest run lib/view` | N/A: pure functions | `lib/view/**` |
| 5 (Phase 6) | Six Server Actions with auth, validation and revalidation. Commit: `feat(actions): add transaction and budget server actions` | single PR | `pnpm exec vitest run app/actions` | N/A: mocked repositories; real behavior verified on preview (task 11.1) | `app/actions/transactions.ts`, `app/actions/budgets.ts` and their tests |
| 6 (Phases 7-8) | Atoms, molecules, organisms with jsdom tests. Commit: `feat(ui): add entry sheet, ledger and budget components` | single PR | `pnpm exec vitest run components` | N/A: jsdom component tests; visual check on preview | `components/**` additions (BottomNav is modified in Phase 9) |
| 7 (Phase 9) | Wire layout, pages, screens, FAB, styles. Commit: `feat(shell): wire movimientos, presupuesto and the add sheet` | single PR | `pnpm exec vitest run app components/organisms/BottomNav.test.tsx` | `pnpm build` then `pnpm start` and open `/movimientos` and `/presupuesto` against a Neon dev branch | `app/(shell)/**`, `BottomNav`, `app/globals.css`; revert restores placeholders |
| 8 (Phase 10-11) | Final gates and manual preview verification (no commit unless fixes are needed) | single PR | `pnpm test && pnpm lint && pnpm exec tsc --noEmit && pnpm build` | Vercel preview deployment (task 11.1, BLOCKING ON USER) | N/A (verification only) |

## Phase 1: Preflight and Documentation Reading

- [x] 1.1 Confirm the working tree is on `feat/port-ledger`, run `pnpm install --frozen-lockfile` explicitly (do not assume dependencies are installed), then run baseline `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` and record that they are green before any edit. No new dependency is added by this change.
- [x] 1.2 Read the Next.js docs required by `AGENTS.md` before writing any related code: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`, `.../03-file-conventions/page.md` (`searchParams` as a Promise), `.../04-functions/revalidatePath.md`, `.../04-functions/refresh.md`, `.../01-directives/use-server.md`, `01-app/02-guides/interactive-apps.md` and `01-app/02-guides/data-security.md` (Server Actions section) (all read-only). Note any divergence from design Decisions 2, 5, 7, 8, 9 and report it before proceeding.
- [x] 1.3 Read `openspec/changes/port-ledger/specs/*/spec.md` (read-only) and the existing `lib/domain/{month,time,transactions,budget,categories}.ts`, `lib/db/repositories/*.repository.ts`, `lib/auth/*.ts`, `app/actions/login.test.ts` (read-only, the mock pattern to copy) to confirm names, signatures and import zones before RED tests.

## Phase 2: Domain Core (pure, RED then GREEN)

Spec: `financial-domain-rules`, `transaction-entry`, `transaction-ledger`, `monthly-budgets`. Design Decisions 3, 6, 10.

- [x] 2.1 RED: extend `lib/domain/month.test.ts` with `nextMonthKey` (`2026-12` -> `2027-01`, `2026-08` -> `2026-09`, symmetry with `prevMonthKey`) and `monthAbbrev` (`1` -> `ene`, `8` -> `ago`, `12` -> `dic`). Run; observe failure.
- [x] 2.2 GREEN: add `nextMonthKey` and `monthAbbrev` (derived from `MONTHS_ES`, no new table) to `lib/domain/month.ts`. Update the header comment at `lib/domain/month.ts:3-5` so it no longer says `MONTHS_ES` is "the single permitted Spanish string table in `lib/domain/`" and instead names both sanctioned tables (`MONTHS_ES` and `VALIDATION_MESSAGES` in `lib/domain/messages.ts`) and why each exists (spec requires domain helpers to return Spanish messages).
- [x] 2.3 RED: extend `lib/domain/time.test.ts` with `toDateTimeLocalValue` (with `vi.setSystemTime('2026-08-15T00:00:00Z')` and `nowInBuenosAires()` -> `2026-08-14T21:00`) and `parseDateTimeLocal` (valid value, optional seconds dropped, `2026-02-30T10:00` -> null, `2026-13-01T10:00` -> null, empty/garbage -> null, entered wall-clock stored unchanged under `TZ=UTC`). Observe failure.
- [x] 2.4 GREEN: add `toDateTimeLocalValue` and `parseDateTimeLocal` to `lib/domain/time.ts` using the regex plus `wallClockFromParts` and a UTC-component round-trip check. Do not use `new Date(string)` or `Date.parse`.
- [x] 2.5 RED: create `lib/domain/format.test.ts` for `formatArs` (0, 999, 1234567, -5000 -> `-$5.000`, no rounding), `formatSignedArs` (`-$31.000` expense, `+$50.000` income), `formatShortDate` (`14 ago · 21:00` not shifted, `5 ene`), `formatPercent` (`700` -> `7`, `750` -> `7,5`, `725` -> `7,25`, `0` -> `0`). Observe failure.
- [x] 2.6 GREEN: create `lib/domain/format.ts` with manual thousands grouping (never `toLocaleString`) and UTC-component dates.
- [x] 2.7 RED: extend `lib/domain/transactions.test.ts` with `clampDateFilters(month, from, to)`: values outside the month clamp to month bounds, inside values pass through, unset stays unset, `from > to` handled per spec, output feeds `filterTransactions` unchanged. Observe failure.
- [x] 2.8 GREEN: add `clampDateFilters` to `lib/domain/transactions.ts`.
- [x] 2.9 RED: extend `lib/domain/budget.test.ts` with `planBudgetCopy`: only categories missing from the current month, keeps the source amount, skips archived and non-expense via the active-expense id set, idempotent (re-planning against the copied month returns `[]`), empty source returns `[]`. Observe failure.
- [x] 2.10 GREEN: add `PlannedBudgetRow` and `planBudgetCopy` to `lib/domain/budget.ts`.
- [x] 2.11 RED: create `lib/domain/members.test.ts` for `resolveDefaultMemberId` (valid active cookie id, cookie id archived/missing -> first active, non-numeric cookie -> first active, no active members -> `null`). Observe failure.
- [x] 2.12 GREEN: create `lib/domain/members.ts` with `resolveDefaultMemberId`.
- [x] 2.13 RED: create `lib/domain/validation.test.ts` (table-driven, no mocks) covering the design Decision 3 table exactly: `parseWholePesos` / gross (`33333` ok; `.`/`,` -> not-whole message; `0`, `-5`, `abc`, empty -> their own messages; `1000000000` -> too large), `parseCashbackBps` (empty -> 0; `7` -> 700; `0.29` -> 29; `1.15` -> 115; `7,5` -> 750; `7.255`, `100.01`, `-1`, `abc` rejected; `100` ok), `parseTransactionForm` (income forces cashback 0 even with a stale value, ignores a submitted `amount`, empty date rejected, takes no clock argument, invalid type, non-positive ids), `parseBudgetAmount` (`1.5`, `0`, `-3`, empty rejected), `parsePositiveId` (`'1; DROP'`, `-1`, `1.5`, `{}`, `undefined` -> null; `'7'` and `7` -> 7), `checkTransactionReferences` (missing category/member; kind mismatch; archived allowed only on update when the id equals the existing stored value; archived otherwise rejected), `checkBudgetCategory` (missing, income kind rejected, archived accepted only when a row exists this month). Observe failure.
- [x] 2.14 GREEN: create `lib/domain/messages.ts` with `VALIDATION_MESSAGES` (exact strings from the design "Validation and server errors" table, with a header comment explaining why this second Spanish table is sanctioned in the domain) and `lib/domain/validation.ts` implementing the Decision 3 contracts. Cashback conversion uses string arithmetic, never `percentToBps` (float).
- [x] 2.15 Run `pnpm exec vitest run lib/domain` and confirm `lib/domain/architecture.test.ts` is still green with the new files (no React/Next/Drizzle/`lib/db` imports).
- [x] 2.16 Commit unit 1: `feat(domain): add formatting, validation, budget copy plan and date helpers` (tests and the `month.ts` comment update in the same commit).

## Phase 3: Repository Additions

Spec: `data-persistence`. Design Decision 4. Single-statement writes only (`neon-http`, no transactions).

- [ ] 3.1 RED: extend `lib/db/repositories/archiveReads.test.ts` EXPECTATIONS table with `getCategoryById` (categories repository) and `getMemberById` (members repository) as `must-include-archived`, so the test fails until the functions exist, carry the `DO NOT ADD` comment and return `archived: archivedAt !== null`. Observe failure.
- [ ] 3.2 RED: create `lib/db/repositories/budgetCopy.test.ts` (source-level guard, same technique as `archiveReads.test.ts`): the body of `copyMissingBudgets` contains `.values(`, `onConflictDoNothing` with target `[budgets.userId, budgets.month, budgets.categoryId]` and `.returning(`, and contains none of `onConflictDoUpdate`, `.update(`, `.delete(`, `.select(`. Observe failure.
- [ ] 3.3 GREEN: add `getCategoryById(id, userId)` to `lib/db/repositories/categories.repository.ts` and `getMemberById(id, userId)` to `lib/db/repositories/members.repository.ts` (include archived rows; `DO NOT ADD` comment; `archived: archivedAt !== null`).
- [ ] 3.4 GREEN: add `getTransactionById`, `updateTransaction` (`UPDATE ... WHERE user_id AND id RETURNING`, null when vanished) and `deleteTransaction` (`DELETE ... RETURNING id`, boolean) to `lib/db/repositories/transactions.repository.ts`.
- [ ] 3.5 GREEN: add `deleteBudget(month, categoryId, userId)` (never touches `transactions`) and `copyMissingBudgets(rows, toMonth, updatedAt, userId)` (single multi-row `insert().values().onConflictDoNothing({ target }).returning({ categoryId })`, returns inserted count, returns 0 without SQL on an empty plan) to `lib/db/repositories/budgets.repository.ts`.
- [ ] 3.6 Run `pnpm exec vitest run lib/db/repositories` and `pnpm exec tsc --noEmit`; both green. Note that SQL behavior itself is not unit-tested here (no Neon test branch); it is verified in task 11.1.
- [ ] 3.7 Commit unit 2: `feat(db): add by-id reads, transaction update/delete and budget copy repositories`.

## Phase 4: Auth Guard, Action State, Cookie and UI Copy

Design Decisions 2, 8, 9. Read Next docs first (task 1.2 must be done).

- [ ] 4.1 RED (security hardening beyond the specs, Decision 9): create `lib/auth/requireSession.test.ts` mocking `next/headers`: `assertSession` resolves with a valid `tm_session`; throws `UnauthorizedError` for an absent, tampered (bad signature) and expired cookie; performs no database access (no repository import). Observe failure.
- [ ] 4.2 GREEN: create `lib/auth/requireSession.ts` (`UnauthorizedError`, `assertSession` using `cookies()` and the existing `verifySession`).
- [ ] 4.3 Create `lib/actions/state.ts` with `TransactionFormState`, `DeleteResult`, `BudgetFormState`, `BudgetMutationResult`, `CopyResult`, `INITIAL_TRANSACTION_FORM_STATE`, `INITIAL_BUDGET_FORM_STATE` exactly per the design "Interfaces / Contracts" (types live outside the `'use server'` modules, mirroring `lib/auth/loginState.ts`). Type-only and constants, verified by `pnpm exec tsc --noEmit`.
- [ ] 4.4 Create `lib/members/cookies.ts` (`LAST_MEMBER_COOKIE = 'tm_last_member'`, `LAST_MEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 365`).
- [ ] 4.5 Create `lib/copy/es.ts` with the exact Spanish UI strings from the design "Spanish UI Copy" tables (sheet, Movimientos, Presupuesto). Neutral Spanish, no voseo.
- [ ] 4.6 Run `pnpm exec vitest run lib/auth lib/actions` and `pnpm exec tsc --noEmit`; green.
- [ ] 4.7 Commit unit 3: `feat(auth): add assertSession and action state/copy modules`.

## Phase 5: View Models and URL Schema (pure)

Spec: `transaction-ledger`, `monthly-budgets`. Design Decisions 5, 7, 11. `lib/view` imports domain and `import type` repositories only.

- [ ] 5.1 RED: create `lib/view/ledger.test.ts`: `toLedgerRowView` (gross/cashback labels only for expense with cashback > 0; income has none; archived flags for category and member; `category.color === categoryColor(label.colorIndex)`; `edit` seed strings: gross, cashback via `formatPercent`, `dateValue` via `toDateTimeLocalValue`; no `Date` in the output). Create `lib/view/budgets.test.ts`: `toBudgetRowView` (same color derivation, `spentLabel` `gastado $800`, progress from `budgetProgress`, archived flag). Observe failure.
- [ ] 5.2 GREEN: create `lib/view/ledger.ts` and `lib/view/budgets.ts`.
- [ ] 5.3 RED: create `lib/view/ledgerOverlay.test.ts`: `reduceOverlay` for pending, remove, replace; `applyOverlay` dims pending rows, hides removed rows, swaps replaced rows with server-returned rows only; `EMPTY_OVERLAY` yields rows unchanged (base reset). Observe failure.
- [ ] 5.4 GREEN: create `lib/view/ledgerOverlay.ts`.
- [ ] 5.5 RED: create `lib/view/ledgerQuery.test.ts` and `lib/view/budgetQuery.test.ts`: `parseLedgerQuery` / `ledgerHref` round-trip (defaults omitted, garbage -> defaults, arrays -> first element, kebab `amount-desc` mapped to `amountDesc`, dates clamped to the month via `clampDateFilters`), `withMonth` clears from/to and keeps type/sort, `withSort`, `clearFilters` keeps month and sort; `parseBudgetMonth` falls back to the current month on an invalid param; `budgetHref`. Observe failure.
- [ ] 5.6 GREEN: create `lib/view/ledgerQuery.ts` and `lib/view/budgetQuery.ts`.
- [ ] 5.7 RED: create `lib/view/ledgerFilterOptions.test.ts` for `buildLedgerFilterOptions`: active-only month yields the active lists; an archived category/member referenced by the month's transactions is added and marked `archived: true`; archived entries not referenced by the month are NOT offered; duplicates by id collapsed; order is active in repository order then archived by name; **a URL filter id that matches no option is still applied by `filterTransactions` (empty filtered result) but is NOT added as an option** (assert both: option lists unchanged, and `filterTransactions` with that id returns no rows). Observe failure.
- [ ] 5.8 GREEN: create `lib/view/ledgerFilterOptions.ts` keeping the "unknown selected id is applied but not added as an option" rule.
- [ ] 5.9 Run `pnpm exec vitest run lib/view lib/domain/architecture.test.ts` green.
- [ ] 5.10 Commit unit 4: `feat(view): add ledger and budget view models and URL query schema`.

## Phase 6: Server Actions (RED tests first, then implementation)

Spec: `transaction-entry`, `transaction-ledger`, `monthly-budgets`. Design Decisions 2, 4, 8, 9 and the Threat Matrix. Pattern: `app/actions/login.test.ts` (`vi.mock('next/headers')`, `vi.mock('next/cache')`, `vi.mock('@/lib/db/repositories/...')`). Prerequisite: tasks 1.2 and 4.x done.

- [ ] 6.1 RED: create `app/actions/transactions.test.ts`, section "assertSession in every mutating action" (design Decision 9, hardening beyond specs): for each of `createTransactionAction`, `updateTransactionAction`, `deleteTransactionAction`, an absent, tampered and expired `tm_session` makes the action reject with `UnauthorizedError` and asserts NO repository mock was called, no cookie was set and `revalidatePath` was not called (including a valid-looking payload, simulating a direct POST).
- [ ] 6.2 RED: in `app/actions/budgets.test.ts`, section "assertSession in every mutating action": the same absent/tampered/expired cases for `upsertBudgetAction`, `removeBudgetAction`, `copyBudgetsAction`, with no repository mock called.
- [ ] 6.3 RED: `app/actions/transactions.test.ts` behavior and threat-matrix cases: invalid input returns `{ status: 'error', fieldErrors }` with no write and no cookie; success with gross 33333 and cashback 7 passes `amount = 31000` (from `computeNetAmount`), `gross = 33333`, `cashbackBps = 700` to the repository; a form carrying `amount=1` alongside gross/cashback stores the computed net; cookie `tm_last_member` set with the member id on create AND update, only after a successful write; `revalidatePath` called for `/movimientos`, `/presupuesto`, `/inicio`; returned `row` equals `toLedgerRowView` of the persisted row; create with an archived or foreign-kind category/member id -> field error, no write; update keeps an unchanged archived category/member (Q7) but rejects switching to another archived one; update with an untouched date keeps `existing.date` (seconds preserved); update of a vanished id -> `transactionNotFound`; `deleteTransactionAction('1; DROP')`, `-1`, `1.5`, `{}` rejected by `parsePositiveId` with no repository call; delete of an already-deleted id returns `{ status: 'deleted' }`; a thrown repository error maps to the generic Spanish `saveFailed` / `deleteFailed`. Observe all failing.
- [ ] 6.4 RED: `app/actions/budgets.test.ts` behavior: upsert rejects amount `0`, `-3`, `1.5`, empty; rejects an income category (`budgetCategoryNotExpense`); a new row requires an active category, an existing archived row is editable; `removeBudgetAction('x', 1)` and `copyBudgetsAction('2026-13')` rejected by `isMonthKey` with no query issued; remove never touches transactions and removing an already-removed row returns ok; copy with an empty plan returns `{ status: 'nothing' }` and `copyMissingBudgets` is NOT called; copy with a plan calls `copyMissingBudgets` once with exactly the planned rows (archived and non-expense source rows absent, existing months untouched) and maps the count to `copied`; successful actions revalidate `/presupuesto` and `/inicio`. Observe failing.
- [ ] 6.5 GREEN: create `app/actions/transactions.ts` (`'use server'`, async exports only) implementing the ten-step order from Decision 2 with `assertSession()` as the first statement, `readForm`, `parseTransactionForm`, reference reads, `checkTransactionReferences`, `computeNetAmount` as the only net computation, one-statement write, cookie set, `revalidatePath`, and the mapped persisted row. Confirm each cookies/revalidate call against the docs read in 1.2.
- [ ] 6.6 GREEN: create `app/actions/budgets.ts` (`'use server'`) with `upsertBudgetAction`, `removeBudgetAction`, `copyBudgetsAction` per Decisions 2 and 4, `assertSession()` first, `isMonthKey` re-validation of every `unknown` argument, and `nowInBuenosAires()` as the only clock.
- [ ] 6.7 Run `pnpm exec vitest run app/actions` and `pnpm exec tsc --noEmit`; green.
- [ ] 6.8 Commit unit 5: `feat(actions): add transaction and budget server actions`.

## Phase 7: Atoms and Molecules (components)

Design Decision 12. Presentational only; `'use client'` only where listed. jsdom tests use `// @vitest-environment jsdom`, `@testing-library/react`, mocked `next/link` / `next/navigation`.

- [ ] 7.1 Create atoms `components/ui/CategoryIcon.tsx` (static map of seeded lucide names, fallback `Tag`), `components/ui/ArchivedTag.tsx` (`(en archivo)`), `components/ui/FieldError.tsx` (`role="alert"`). Add a small `components/ui/CategoryIcon.test.tsx` asserting known name, unknown-name fallback.
- [ ] 7.2 Create server molecules `components/molecules/MonthStepper.tsx` (two `<Link>`s, aria "Mes anterior" / "Mes siguiente"), `SortToggle.tsx`, `LedgerRow.tsx` (button row, `onSelect`, dims on `pending`), `EmptyState.tsx`. Tests: stepper hrefs use `prevMonthKey` / `nextMonthKey` across a year boundary; `LedgerRow` renders formatted labels, gross and cashback tag only for expense with cashback, `(en archivo)` tag, `pending` dim, calls `onSelect`.
- [ ] 7.3 Create client molecules `SegmentedControl.tsx`, `AmountField.tsx` (`inputMode="numeric"`, `$` prefix), `CashbackField.tsx` (`inputMode="decimal"`, `%` suffix, preview note), `OptionGrid.tsx`, `MemberPicker.tsx`, `ConfirmDialog.tsx` (`role="alertdialog"`) under `components/molecules/`. Tests: `ConfirmDialog` cancel leaves the passed action uncalled; confirm calls it once; `OptionGrid` / `MemberPicker` render an injected archived option marked `(en archivo)` only when provided.
- [ ] 7.4 Create `components/molecules/BudgetRow.tsx` (`'use client'`; amount form submits on Enter/blur only when changed, × remove button with aria `Quitar {categoría}`, `ProgressBar` via `budgetProgress`) with a test for changed/unchanged submit and remove.
- [ ] 7.5 Run `pnpm exec vitest run components` and `pnpm lint` (new files only may fail on import zones; fix before continuing).

## Phase 8: Organisms and Sheet Provider

Design Decisions 1, 5, 6, 8, 12.

- [ ] 8.1 RED: create `components/organisms/EntrySheet.test.tsx` (inside a provider): type switch swaps the category set and clears an incompatible selected category; cashback field hidden for income; edit mode pre-fills from `row.edit` and shows an archived category/member marked `(en archivo)` only as the row's own stored value (not re-offered after switching away); create preselects `defaultMemberId` and uses `initialDateValue`; validation errors keep entered values and show Spanish messages; delete button opens `ConfirmDialog` and cancel does not call `deleteTransactionAction`; no active members shows `No hay personas activas.` and disables submit; Escape closes; cashback preview `Gasto final {net} · ahorro {saving}` uses `computeNetAmount` and is never submitted. Observe failure.
- [ ] 8.2 GREEN: create `components/organisms/EntrySheetProvider.tsx` (`'use client'`; `{ open, mode, editingRow }`, `openCreate()` computing `toDateTimeLocalValue(nowInBuenosAires())` in the event handler only, `openEdit`, `close`, `rememberMember`, `useOptimistic(EMPTY_OVERLAY, reduceOverlay)`, `useEntrySheet()` that throws outside the provider) and `components/organisms/EntrySheet.tsx` (`role="dialog" aria-modal`, `useActionState` for create/update, `startTransition` after `await`, overlay dispatch flows per Decision 5 table). Add a provider test that `useEntrySheet()` throws outside it.
- [ ] 8.3 RED then GREEN: `components/organisms/LedgerList.test.tsx` (overlay hides removed rows, dims pending rows, row click calls `openEdit`) then `LedgerList.tsx` (`applyOverlay(rows, overlay)` over `LedgerRow`s).
- [ ] 8.4 RED then GREEN: `components/organisms/LedgerFilters.test.tsx` (type chips, category/member selects with archived entries suffixed `(en archivo)`, from/to inputs with `min`/`max` set to the month bounds, interaction calls `router.replace(ledgerHref(...), { scroll: false })` inside `startTransition`, filters take the parsed `LedgerQuery` as a prop and do not call `useSearchParams`) then `LedgerFilters.tsx`.
- [ ] 8.5 RED then GREEN: tests then `BudgetList.tsx` (optimistic remove and amount over `BudgetRow`s, no client computation), `BudgetAddForm.tsx` (picker of active expense categories not budgeted this month + amount; hidden when none remain), `BudgetCopyButton.tsx` (calls `copyBudgetsAction`; renders `Se copió 1 categoría.` / `Se copiaron {n} categorías.` / `No hay categorías para copiar.`). Test: copy button is rendered even when the previous month is empty and then reports the "nothing" message.
- [ ] 8.6 Run `pnpm exec vitest run components` green.
- [ ] 8.7 Commit unit 6 (Phases 7-8 together, or as two commits if the diff is large): `feat(ui): add entry sheet, ledger and budget components`.

## Phase 9: Wiring (layout, pages, screens, FAB, styles)

Read Next docs first (task 1.2). Spec: `app-shell-navigation`, `transaction-ledger`, `monthly-budgets`.

- [ ] 9.1 RED: update `app/(shell)/layout.test.tsx` for the now-`async` layout: mock `next/headers` (cookies) and `@/lib/db/repositories/categories.repository` / `members.repository`; render with `render(await ShellLayout({ children }))`; assert children, `BottomNav` and the sheet render inside `EntrySheetProvider`, picker data and `defaultMemberId` (via `resolveDefaultMemberId`, cookie valid / archived / absent) reach the provider. Observe failure against the current sync layout.
- [ ] 9.2 RED: update `components/organisms/BottomNav.test.tsx` to render inside `EntrySheetProvider` (and add a failing case that the FAB opens the sheet via `openCreate()`; the nav tabs and active-state assertions stay). Observe failure.
- [ ] 9.3 GREEN: make `app/(shell)/layout.tsx` `async` (parallel `listActiveCategories()`, `listActiveMembers()`, `(await cookies()).get(LAST_MEMBER_COOKIE)`), wrapping `<main>`, `<BottomNav />` and `<EntrySheet />` in `EntrySheetProvider`. Modify `components/organisms/BottomNav.tsx` so the FAB calls `openCreate()` and remove the "inert chrome" comment.
- [ ] 9.4 Create `components/screens/LedgerScreen.tsx` and `components/screens/BudgetScreen.tsx` (layout composition only, no data access): title, `MonthStepper`, `SortToggle`, count (`1 movimiento` / `{n} movimientos`), `LedgerFilters`, `LedgerList`, empty states (`No hay movimientos en {Mes Año}.`, `Ningún movimiento coincide con los filtros.` with `Limpiar filtros`), budget copy control (`Copiar presupuesto de {Mes Año}`), `BudgetList`, `BudgetAddForm`, empty `Sin presupuesto para {Mes Año}.`.
- [ ] 9.5 Implement container `app/(shell)/movimientos/page.tsx` per the design Data Flow: `parseLedgerQuery(await searchParams, monthKeyOf(nowInBuenosAires()))`, `listTransactionsInRange(monthRange(q.month))`, `filterTransactions` then `sortTransactions`, resolve labels for the whole month (including archived) in parallel with active lists, `toLedgerRowView`, `buildLedgerFilterOptions`, render `LedgerScreen`.
- [ ] 9.6 Implement container `app/(shell)/presupuesto/page.tsx`: `parseBudgetMonth(await searchParams, ...)`, `prevMonthKey`, parallel `getBudgetsForMonth` (current and previous), `listTransactionsInRange(monthRange(month))`, `listActiveCategoriesByKind('expense')`, labels for budget category ids (archived rows still labeled), `spentForCategory` + `budgetProgress` via `toBudgetRowView`, render `BudgetScreen`.
- [ ] 9.7 Add styles to `app/globals.css` for the sheet, dialog, rows, filters and budget rows using existing custom properties only (no new colors, light and dark both).
- [ ] 9.8 Update or add page-level tests where the existing suite covers `app/(shell)/movimientos` / `presupuesto` placeholders (replace placeholder assertions); run `pnpm exec vitest run app components/organisms/BottomNav.test.tsx` green.
- [ ] 9.9 Run `pnpm exec tsc --noEmit` and `pnpm build` (explicit build, not implied) to confirm the dynamic pages compile with awaited `searchParams`.
- [ ] 9.10 Commit unit 7: `feat(shell): wire movimientos, presupuesto and the add sheet`.

## Phase 10: Final Verification Gates

- [ ] 10.1 Run `pnpm test` (full Vitest suite under `TZ=UTC`) and confirm all green, including `lib/domain/architecture.test.ts`, `archiveReads.test.ts`, `budgetCopy.test.ts`.
- [ ] 10.2 Run `pnpm lint` and confirm zero errors (ESLint import-zone rules hold for `lib/view`, `lib/domain`, `components`).
- [ ] 10.3 Run `pnpm exec tsc --noEmit` and confirm zero errors.
- [ ] 10.4 Run `pnpm build` and confirm a successful production build.
- [ ] 10.5 Confirm no file was added or changed under `drizzle/` and `lib/db/schema.ts` is untouched (read the working-tree diff names only; expected: none).
- [ ] 10.6 Tick the proposal Success Criteria that are provable by automated checks (net 31000 persisted shape, income no-cashback, validation messages, wall-clock date, filters in URL, unit tests passing, no Spanish identifiers); leave UI-dependent criteria for task 11.1.

## Phase 11: Manual Verification on a Vercel Preview (BLOCKING ON USER)

- [ ] 11.1 **BLOCKING ON USER.** On a Vercel preview deployment of `feat/port-ledger` (pointed at a Neon branch, not production data), the user verifies: (a) create an expense with gross 33333 and 7% cashback (expect 31.000 stored and shown with the cashback tag) and an income without cashback; (b) edit a transaction (including one with an archived category/member) and confirm values persist and the list reconciles; (c) delete a transaction through the confirmation dialog and confirm it is gone after reload; (d) in Presupuesto set a budget amount, add and remove a category row, and copy the previous month's budget (only missing categories added, existing amounts unchanged, repeating it reports nothing to copy); (e) check the month stepper across a year boundary and into a future month, and that filters (type, category, member, date range) and sort survive a reload and clear date filters when the month changes; (f) confirm "Quién" defaults to the last-used member on this device. Apply must not mark this task done without the user's explicit confirmation; this also covers the deferred repository SQL (`updateTransaction`, `deleteTransaction`, `copyMissingBudgets`).
- [ ] 11.2 Record the user's result (pass, or the list of defects). Any defect becomes a new task with its own RED test and fix commit before the PR is opened.

## Requirement Traceability

| Spec / design area | Tasks |
|--------------------|-------|
| `financial-domain-rules` (format, clamp, plan copy, validation, date helpers) | 2.1-2.15 |
| `data-persistence` (by-id reads, update/delete, budget delete/copy) | 3.1-3.6 |
| Auth hardening (Decision 9, beyond specs) | 4.1-4.2, 6.1-6.2 |
| `transaction-entry` (sheet, validation, cookie, archived-on-edit) | 2.13-2.14, 6.3, 6.5, 8.1-8.2 |
| `transaction-ledger` (month, filters, sort, delete, optimistic) | 5.1-5.8, 6.3, 8.3-8.4, 9.5 |
| `monthly-budgets` (rows, progress, copy) | 5.1-5.2, 6.4, 6.6, 8.5, 9.6 |
| `app-shell-navigation` (FAB, placeholder removal) | 9.1-9.3 |
