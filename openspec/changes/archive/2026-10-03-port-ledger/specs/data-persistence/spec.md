# Delta for Data Persistence

No schema change and no migration. Existing constraints (`cashback_bps` range, income-no-cashback,
`amount <= gross`, `budgets_month_category_uq`, `ON DELETE RESTRICT`) are relied upon unchanged.

## ADDED Requirements

### Requirement: Transaction update and hard delete

The transactions repository MUST provide `getTransactionById`, `updateTransaction`, and
`deleteTransaction`. Transactions MAY be hard-deleted; deleting a transaction MUST remove exactly
that row and MUST NOT affect categories, members, or budgets. Categories and members remain
archive-only and MUST NOT be hard-deleted by this change.

#### Scenario: Get by id

- GIVEN an existing transaction id
- WHEN `getTransactionById` runs
- THEN it MUST return that row, and MUST return nothing for an unknown id

#### Scenario: Update persists new values

- GIVEN an existing transaction
- WHEN `updateTransaction` runs with new gross, net, cashback bps, category, member, and date
- THEN the stored row MUST hold the new values and the persisted row MUST be returned

#### Scenario: Update of a missing row

- GIVEN an unknown id
- WHEN `updateTransaction` runs
- THEN it MUST report no row affected and write nothing

#### Scenario: Hard delete removes the row only

- GIVEN a transaction and a budget for the same category
- WHEN `deleteTransaction` runs for the transaction
- THEN the transaction row MUST no longer exist
- AND the category, member, and budget rows MUST be unchanged

#### Scenario: Deleting a missing row is not an error

- GIVEN an unknown or already-deleted id
- WHEN `deleteTransaction` runs
- THEN it MUST complete without error and report no row affected

#### Scenario: Categories and members still cannot be hard-deleted

- GIVEN the repository surface after this change
- WHEN inspected
- THEN no operation MUST hard-delete a category or member

### Requirement: Budget delete and fill-missing copy

The budgets repository MUST provide `deleteBudget` for a month and category, and a fill-missing
copy that inserts planned rows while skipping conflicts on the `(month, category)` unique index. The
copy MUST NOT update or delete existing rows.

#### Scenario: Delete a budget row

- GIVEN a budget row for 2026-08 and "Supermercado"
- WHEN `deleteBudget` runs
- THEN that row MUST be gone and other budget rows and all transactions MUST be unchanged

#### Scenario: Delete a missing budget row

- GIVEN no row for the month and category
- WHEN `deleteBudget` runs
- THEN it MUST complete without error

#### Scenario: Copy skips conflicts

- GIVEN a target month already holding Supermercado=80000 and a planned insert Supermercado=100000
- WHEN the fill-missing copy runs
- THEN the existing row MUST remain 80000 and no error MUST be raised

#### Scenario: Copy inserts missing rows in one operation

- GIVEN planned rows for categories absent from the target month
- WHEN the fill-missing copy runs
- THEN all planned rows MUST exist in the target month afterward

#### Scenario: Budget month scoping uses half-open or key semantics

- GIVEN budgets for months 2026-07 and 2026-08
- WHEN budgets are read for 2026-08
- THEN only rows of that month MUST be returned

### Requirement: By-id reads resolve archived rows

The categories and members repositories MUST provide by-id reads that return a row regardless of
archived state, with its archived marker, so edit and display of historical data resolve it. Picker
queries MUST continue to exclude archived rows.

#### Scenario: Archived category resolves by id

- GIVEN an archived category referenced by a transaction
- WHEN read by id
- THEN the row MUST be returned with its label and non-null `archived_at`

#### Scenario: Archived member resolves by id

- GIVEN an archived member referenced by a transaction
- WHEN read by id
- THEN the row MUST be returned with its label and non-null `archived_at`

#### Scenario: Picker queries still exclude archived rows

- GIVEN an archived category and an archived member
- WHEN the picker queries run
- THEN neither MUST appear in the results

### Requirement: Repository writes keep the boundary and invariants

New write operations MUST live only in `lib/db/repositories/`, MUST store money as whole pesos and
cashback as basis points, and MUST store dates as Buenos Aires wall-clock timestamps without
timezone conversion.

#### Scenario: Written date round-trips unchanged

- GIVEN a transaction written with wall-clock 2026-08-10T09:30
- WHEN it is read back
- THEN the date MUST equal 2026-08-10T09:30 with no offset shift

#### Scenario: Domain and actions do not import Drizzle

- GIVEN `lib/domain/` and the Server Actions under `app/actions/`
- WHEN their imports are inspected
- THEN neither MUST import Drizzle directly; database access MUST go through repositories
