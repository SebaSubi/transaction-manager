# Tasks: Port Dashboard — Inicio and Perfil

> Inputs: `proposal.md`, `design.md` (authoritative for files, contracts and Spanish copy), `specs` deltas.
> Artifacts and code comments in English; UI copy in neutral Spanish exactly as listed in design.md.
> No schema change: nothing is added under `drizzle`.

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated authored changed lines (additions plus deletions, generated files excluded; `pnpm-lock.yaml` excluded) | about 4,300 (range 3,800 to 4,800) |
| Breakdown | domain and db helpers with tests about 700; repositories and `archiveReads.test.ts` about 200; actions with tests about 1,000; view and copy with tests about 450; components with tests about 1,350; pages and page tests about 300; CSS about 250 |
| Review budget | 400 changed lines per slice |
| Forecast versus budget | about 10 times over the budget |
| Delivery strategy | exception-ok |
| Decision | size:exception accepted by user. ONE large PR, no chain strategy, no stacked slices. |
| Mitigation | Work-unit commits (boundaries in the last section) so the reviewer can read the PR commit by commit; each commit is green on its own (`pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`). |

## Conventions for every task

- One task fits one apply session. Check a box only after its outcome and checks were observed.
- Strict TDD is off, but RED tests first is required where a task says so: write the test, run `pnpm test` and observe it fail for the right reason, then implement and observe it pass.
- Before writing any server action, cookie code, or client component, read the matching guides under `node_modules/next/dist/docs/01-app/` (see task 0.2). This is required by AGENTS.md.
- Build and install steps are called out explicitly: `pnpm add` (task 1.1) and `pnpm build` (task 8.4).
- Dummy environment for `pnpm build`: `DATABASE_URL='postgresql://u:p@ep-x-pooler.sa-east-1.aws.neon.tech/db?sslmode=require' APP_PASSWORD=x SESSION_SECRET=0123456789abcdef0123456789abcdef`.
- Domain modules under `lib/domain` import no React, Next, Drizzle, `lib/db`, or `@dnd-kit` (`architecture.test.ts` must stay green).
- Never write two backticked tokens separated by a slash in this file or in generated notes.

## Phase 0: Preparation

- [ ] 0.1 Confirm the working branch is `feat/port-dashboard` and run `pnpm test` once to record the baseline (all green before any edit). Spec: all.
- [ ] 0.2 Read, from `node_modules/next/dist/docs/01-app/`: `03-api-reference/04-functions/revalidatePath.md`, `03-api-reference/04-functions/cookies.md`, `03-api-reference/01-directives/use-client.md`, `02-guides/interactive-apps.md` (Step 5, optimistic drag), and `02-guides/data-security.md` (Server Actions section). Note any deprecation that affects design.md. Spec: all (AGENTS.md rule).

## Phase 1: Dependency install

- [x] 1.1 Run `pnpm add @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0` (exact pins, no caret). Confirm `package.json` shows exact versions and `pnpm-lock.yaml` changed. Do not import `@dnd-kit/utilities`. Spec: home-dashboard (reorder).
- [ ] 1.2 Verify the design.md open question against the installed typings in `node_modules/@dnd-kit/core` and `node_modules/@dnd-kit/sortable`: (a) the `aria-describedby` value is `DndDescribedBy-` plus the `DndContext` `id` prop; (b) `useSortable` accepts `attributes.roleDescription`; (c) whether `PointerSensor` can ignore touch pointers without a custom subclass (otherwise keep `MouseSensor` plus `TouchSensor`). Record the findings as a note at the top of the `SortableCategoryGrid.tsx` task (4.6) in this file. Spec: home-dashboard (accessibility).

## Phase 2: Domain foundation (RED tests first)

- [ ] 2.1 RED then GREEN: `lib/domain/cardOrder.test.ts` and `lib/domain/cardOrder.ts` with `mergeCardOrder`, `checkCardOrderIds`, `sameOrder`. Cover `[c,a]` plus `[a,b,c,d]` giving `[c,a,b,d]`; `[b]` plus `[x,y,b,z]` giving `[b,x,y,z]`; preserving the positions of archived categories that sit in stored but not in visible; duplicates in both inputs; empty inputs; inputs not mutated; the result is a permutation of the unique union. Spec: home-dashboard (card order).
- [ ] 2.2 RED then GREEN: `parseName` and `parseIdList` plus `NAME_MAX_LENGTH` in `lib/domain/validation.ts` and its test. `parseName`: trim, blank, non-string, exactly 40 code points accepted, 41 rejected, accented names counted by code point. `parseIdList`: non-array, `-1`, `1.5`, `{}`, `"1,2"`, duplicates removed, over max, empty. Spec: household-settings (name validation), home-dashboard.
- [ ] 2.3 RED then GREEN: `monthBalance` in `lib/domain/balance.ts` and test. Income minus expense using net amounts; half-open boundaries at month start and next-month start; rows outside the range ignored even when passed in; empty gives 0; negative result. Leave `totalBalance` untouched. Spec: financial-domain-rules.
- [ ] 2.4 RED then GREEN: `lib/domain/categoryIcons.ts` and test: 21 keys, `isCategoryIconKey` accepts only those keys (rejects `../x`, unmapped lucide names, non-strings). Spec: household-settings (icon picker).
- [ ] 2.5 RED then GREEN: `lib/domain/settings.ts` and test: `checkManagedCategory` (missing, income not managed, archived when active is needed) and `checkMemberArchivable` (archive, noop, missing, last active member). Spec: household-settings.
- [ ] 2.6 RED then GREEN: `monthNameOf` in `lib/domain/month.ts` and test. Spec: home-dashboard (balance label).
- [ ] 2.7 Add the new keys to `VALIDATION_MESSAGES` in `lib/domain/messages.ts` with the exact Spanish strings from design.md; add a test that `nameTooLong` contains `String(NAME_MAX_LENGTH)`. Spec: household-settings.

## Phase 3: Persistence layer

- [ ] 3.1 RED then GREEN: `lib/db/errors.test.ts` and `lib/db/errors.ts` with `isUniqueViolation` and the two constraint constants. Cases: direct `{code, constraint}`, nested `cause` (DrizzleQueryError shape), wrong constraint false, other code false, non-object false, cyclic cause terminates, and a source guard asserting both constraint names appear in `lib/db/schema.ts`. This is the duplicate-name 23505 mapping core. Spec: household-settings (duplicate names), data-persistence.
- [ ] 3.2 RED first: update `lib/db/repositories/archiveReads.test.ts`: add the new expectation kind `must-only-archived` (body contains `isNotNull(...)` on the archived column and does not match `isNull(`), and add the 5 EXPECTATIONS entries from design.md (`renameCategory` must-filter-archived; `unarchiveCategory`, `listArchivedCategories`, `unarchiveMember`, `listArchivedMembers` must-only-archived). Run `pnpm test` and observe the failure (functions missing). Spec: data-persistence.
- [ ] 3.3 GREEN: add `renameCategory`, `unarchiveCategory`, `listArchivedCategories` to `categories.repository.ts`; `unarchiveMember`, `listArchivedMembers` to `members.repository.ts`; one statement each, `RETURNING` where specified, kind predicate on rename and unarchive. `archiveReads.test.ts` goes green. Spec: data-persistence, household-settings.
- [ ] 3.4 Add `listRecentTransactions(limit = 5)` to `transactions.repository.ts` (order by date desc, id desc; clamped limit between 1 and 50, non-finite falls back to 5) and `getStoredCardOrder()` to `cardOrder.repository.ts` (no join, archived included, comment explains why). Spec: home-dashboard, data-persistence.

## Phase 4: Copy, view models, and presentational components

- [ ] 4.1 Add `HOME_COPY`, `PROFILE_COPY`, `ICON_LABELS` (21 keys), and announcement and label functions to `lib/copy/es.ts` with exact strings from design.md; add a test for the functions (positions, `Balance de octubre`). Spec: home-dashboard, household-settings, theming.
- [ ] 4.2 RED then GREEN: `lib/view/home.ts` and test (`buildHomeCards`: income excluded, unbudgeted excluded, archived with a budget excluded, stored order `[c,a]` over a,b,c gives c,a,b, progress capped and over-budget, colour via `categoryColor`; `moveId`). Spec: home-dashboard.
- [ ] 4.3 RED then GREEN: `lib/view/settings.ts` and test; extend `lib/actions/state.ts` with `NameField`, `NameFormState`, `MutationResult`, `INITIAL_NAME_FORM_STATE`. Spec: household-settings.
- [ ] 4.4 Modify `components/ui/CategoryIcon.tsx` to type its map as a record over `CategoryIconKey` (keeps the `Tag` fallback) and update its test (every key renders, unknown renders the fallback). Spec: household-settings (icon picker).
- [ ] 4.5 Molecules with jsdom tests: `HomeCategoryCard`, `IconPicker` (exactly 21 radios with Spanish labels; selection writes the hidden `icon` input), `RenameForm`, `SettingsRow`. Read `use-client.md` notes from task 0.2 before writing client components. Spec: home-dashboard, household-settings.
- [ ] 4.6 Organisms for Inicio with tests: `BalanceCard`, `RecentMovements` (reuses `LedgerList`, opens the existing edit sheet), `SortableCategoryCard`, `SortableCategoryGrid` (stable `DndContext` id `home-card-grid`, sensors per design.md, announcements, optimistic ids with `useOptimistic` plus `startTransition`, error alert line). Component test pins: cards in the given order, `aria-roledescription` with `categoría reordenable`, Spanish instructions in the DOM, and `renderToString` carrying `aria-describedby="DndDescribedBy-home-card-grid"`. Apply the findings from task 1.2. Spec: home-dashboard.
- [ ] 4.7 Add the touch CSS (`touch-action: manipulation`, user-select none, `-webkit-touch-callout: none`, tap highlight transparent; dragging card gets `touch-action: none`) and the grid, balance, settings, archived, and icon picker styles to `app/globals.css` using existing custom properties. Spec: home-dashboard (touch behavior).

## Phase 5: Server actions (RED tests first)

- [ ] 5.1 RED: write action tests before any action code, following the change-2 action-test pattern (`vi.mock` for `next/headers`, `next/cache`, and repositories). For EVERY new action and for `setTheme`: absent, tampered, or expired session makes `assertSession` throw `UnauthorizedError` and NO repository call, NO `cookies().set`, and NO `revalidatePath` happens. Files: `app/actions/cardOrder.test.ts`, `members.test.ts`, `categories.test.ts`, `setTheme.test.ts` (new). Spec: household-settings, theming, home-dashboard. Read `data-security.md` and `cookies.md` notes first (task 0.2).
- [ ] 5.2 RED, continued, in the same test files: invalid name, icon, or id returns its message with no repository call; duplicate name maps a 23505 error carrying the right constraint to the duplicate message for create member, create category, rename category, restore member, and restore category, with no `revalidatePath`; last active member (pure path and race path); income category id gives `categoryNotManaged` with no write; idempotent archive and restore return ok with no write; `createCategoryAction` passes kind expense, the picked icon, and `nextColorIndex(activeCount)`; reorder rejects `"1,2"`, `[1,"x"]`, `[-1]`, `[1.5]`, `{}`, and 10,000 ids, rejects archived, unknown, and income ids with `replaceCardOrder` not called, dedupes, calls `replaceCardOrder` once with `mergeCardOrder(visible, stored)` where stored includes an archived id, skips the write on identical order, and revalidates only `/inicio`. Run `pnpm test` and observe failures. Spec: all above.
- [ ] 5.3 GREEN: create `lib/actions/revalidate.ts` (`revalidateShellTabs`) and `app/actions/cardOrder.ts` (`reorderCardsAction`). Order: `assertSession`, parse, reference reads, pure validation, single write, `revalidatePath`. Spec: home-dashboard.
- [ ] 5.4 GREEN: `app/actions/members.ts` (create, archive, restore). Spec: household-settings.
- [ ] 5.5 GREEN: `app/actions/categories.ts` (create, rename, archive, restore). Spec: household-settings.
- [ ] 5.6 GREEN: modify `app/actions/setTheme.ts` so `await assertSession()` is the first statement; unchanged cookie options; no `revalidatePath`. Spec: theming.

## Phase 6: Perfil organisms and screens

- [ ] 6.1 Organisms with jsdom tests and mocked actions: `MemberSettings` (add form, archive opens `ConfirmDialog`, cancel calls nothing, confirm calls once, field errors), `CategorySettings` (add with `IconPicker`, `RenameForm` per row, archive confirm), `ArchivedSection` (both kinds, restore without confirmation, per-row error, empty message), `ThemeSwitch` (preference selected, three options, change calls `setTheme` with the mapped value, revert on rejection, `applyThemeToDocument`). Spec: household-settings, theming.
- [ ] 6.2 Screens with tests: `HomeScreen` (greeting, balance label, no month stepper, empty grid and empty recent states independently) and `ProfileScreen`. Spec: home-dashboard, household-settings, app-shell-navigation.

## Phase 7: Page containers and shell tests

- [ ] 7.1 RED then GREEN: `app/(shell)/inicio/page.test.ts` then `page.tsx` per the Inicio data flow in design.md (single month read, `monthBalance`, `buildHomeCards`, recent 5 mapped with `toLedgerRowView`). Spec: home-dashboard.
- [ ] 7.2 RED then GREEN: `app/(shell)/perfil/page.test.ts` then `page.tsx` (active and archived members and expense categories, `tm_theme` cookie preference via async `cookies()`). Spec: household-settings, theming.
- [ ] 7.3 Review the existing layout test and the `BottomNav` test; update them if the new Inicio and Perfil content or the spec deltas under app-shell-navigation affect their expectations (no weakening of existing assertions). Spec: app-shell-navigation.

## Phase 8: Final gates

- [ ] 8.1 `pnpm test` green.
- [ ] 8.2 `pnpm lint` green.
- [ ] 8.3 `pnpm exec tsc --noEmit` green.
- [ ] 8.4 `pnpm build` green, run with the dummy env vars from the Conventions section.
- [ ] 8.5 `git diff --stat main -- drizzle/` prints nothing (no migration). Also confirm `architecture.test.ts` and `archiveReads.test.ts` passed in 8.1.

## Phase 9: Manual verification on the Vercel preview (BLOCKING ON USER)

> Blocking on user. The agent cannot run this. The preview uses the PRODUCTION database (Neon preview branching is unavailable), so every record created here is real data and MUST be cleaned up afterward. Use clearly named test data such as names starting with "ZZ prueba".

- [ ] 9.1 Drag to reorder on a real phone: press and hold a card (about 180 ms) to lift it and drag; a quick swipe still scrolls the page; no iOS callout or text selection appears on long press; the order persists after reload and a failed save reverts with the Spanish message. Also check desktop mouse drag and keyboard reorder.
- [ ] 9.2 Inicio: the this-month balance equals income minus expense for the current month; the 5 recent movements are shown newest first, and tapping one opens the edit sheet.
- [ ] 9.3 Categories in Perfil: add with the icon picker, rename, archive (confirm dialog), and restore from Archivadas; the archived category disappears from the Inicio grid and returns with its previous position when restored.
- [ ] 9.4 Members in Perfil: add, archive, restore; archiving the last active member is blocked with the Spanish message.
- [ ] 9.5 Duplicate names: creating, renaming, or restoring into an existing active name shows the duplicate message and writes nothing.
- [ ] 9.6 Theme switch: Oscuro, Claro, Sistema change the palette immediately and persist after reload.
- [ ] 9.7 Cleanup on the production database: remove or archive all test members and categories, restore any real item that was archived for testing, and restore the original card order. Confirm the user reports completion before archive.

## Suggested work-unit commits (single PR, commit by commit review)

1. `chore(deps): add dnd-kit core and sortable` — 1.1, 1.2.
2. `feat(domain): add card order merge, month balance, name and icon rules` — 2.1 to 2.7 with tests.
3. `feat(db): add rename, unarchive, archived reads, recent and stored order` — 3.1 to 3.4 with `archiveReads.test.ts`.
4. `feat(actions): add dashboard and settings server actions, require session in setTheme` — 5.1 to 5.6 (RED tests included).
5. `feat(ui): add copy, view models and home dashboard components` — 4.1 to 4.7.
6. `feat(ui): add profile settings components and screens` — 6.1, 6.2.
7. `feat(app): wire Inicio and Perfil pages` — 7.1 to 7.3.
8. `chore: final gate fixes` — only if Phase 8 requires fixes.

Note on ordering: commit 4 depends on commits 2 and 3, and commit 5 depends on commit 2; commits 2, 3 may be applied in either order. Phase numbers show logical grouping; apply in commit order above, and each commit must pass `pnpm test`, `pnpm lint`, and `pnpm exec tsc --noEmit`.

## Parallelism

- Sequential: 0.x, then 1.1 before 4.6; 2.x before 3.x and 5.x; 3.x before 5.x; 5.x before 6.x and 7.x; 8.x after everything; 9.x after 8.x and a deployed preview.
- Parallel-safe once Phase 2 is done: Phase 3 and tasks 4.1 to 4.4 (disjoint files); 4.5 to 4.7 with Phase 5; 6.1 with 7.1.
