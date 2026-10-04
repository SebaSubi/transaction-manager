# Data Persistence Specification

## Purpose

Defines the Neon Postgres schema, migration workflow, money and timestamp representation
invariants, connection policy, archive semantics, and repository boundary for the transaction
manager.

## Requirements

### Requirement: Money representation

The system MUST store all money values as integer whole ARS pesos, never as floating-point or
`NUMERIC` types.

#### Scenario: Net amount stored as integer

- GIVEN a transaction write with gross=33333, cashback=7
- WHEN the transaction is persisted
- THEN the stored `amount` (net) column MUST be an integer with no fractional pesos

#### Scenario: Cashback stored as a rate, not money

- GIVEN a transaction with cashback=7
- WHEN the transaction is persisted
- THEN `cashback` MUST be stored as a percentage rate (`smallint`/`numeric`), not converted to a
  money amount

### Requirement: Timestamp representation

Transaction and budget timestamps MUST use `timestamp without time zone`, interpreted as Buenos
Aires wall-clock time throughout the app, never UTC-converted.

#### Scenario: Stored timestamp has no timezone offset

- GIVEN a transaction is written with a date
- WHEN the row is persisted
- THEN the `date` column type MUST be `timestamp without time zone`

### Requirement: Neon connection policy

The system MUST connect to Neon exclusively via the pooled/HTTP (`neon-http`) endpoint; a direct
connection string MUST NOT be used.

#### Scenario: Startup rejects a direct connection string

- GIVEN the configured connection string is a direct (non-pooled) Neon connection string
- WHEN the app starts
- THEN startup MUST fail with an assertion error identifying the misconfiguration

#### Scenario: Startup accepts a pooled connection string

- GIVEN the configured connection string is the pooled/HTTP Neon endpoint
- WHEN the app starts
- THEN startup MUST succeed

### Requirement: Schema and migration

The system MUST define `members`, `categories`, `transactions`, `budgets`, and `card_order`
tables via Drizzle schema (`lib/db/schema.ts`), with a first `drizzle-kit` migration checked into
the repo and a btree index on `transactions(date)`.

#### Scenario: First migration applies and reverts cleanly

- GIVEN a fresh empty Neon database
- WHEN the first migration is applied
- THEN all five tables and the `transactions(date)` index MUST exist
- AND reverting the migration MUST drop them without error

#### Scenario: user_id and member_id are distinct columns

- GIVEN the transactions table schema
- WHEN inspected
- THEN it MUST contain both a constant-default `user_id` column (auth-scoping) and a `member_id`
  column referencing `members` (household member), and these MUST NOT share a name or purpose

### Requirement: Archive semantics (soft-delete)

Categories and members MUST carry a nullable `archived_at` timestamp. Archiving MUST NOT delete
or cascade-delete referencing rows.

#### Scenario: Archiving a category sets archived_at

- GIVEN an active category with no `archived_at`
- WHEN it is archived
- THEN `archived_at` MUST be set to a non-null timestamp
- AND no transaction or budget row referencing it MUST be deleted or modified

#### Scenario: Archived rows excluded from pickers and new budget rows

- GIVEN a category with a non-null `archived_at`
- WHEN a picker or new-budget-row query runs
- THEN the archived category MUST NOT appear in the results

#### Scenario: Historical transactions still resolve an archived category or member

- GIVEN a transaction referencing an archived category or an archived member
- WHEN the transaction is read
- THEN the category/member MUST still resolve and display its label, marked as archived

#### Scenario: Last active member cannot be archived

- GIVEN exactly one active (non-archived) member remains
- WHEN archiving that member is attempted
- THEN the operation MUST be rejected and no `archived_at` value MUST be set

#### Scenario: Cascade delete does not exist

- GIVEN the schema for categories, members, transactions, and budgets
- WHEN foreign keys are inspected
- THEN none MUST use `ON DELETE CASCADE`; transactions/budgets referencing categories/members
  MUST use `ON DELETE RESTRICT`

### Requirement: Repository boundary

Only `lib/db/repositories/` MUST import Drizzle or touch the database; `lib/domain/` MUST NOT.

#### Scenario: Domain module has no DB import

- GIVEN any file under `lib/domain/`
- WHEN its imports are inspected
- THEN it MUST contain no import of Drizzle, `lib/db/`, React, or Next.js

### Requirement: Half-open month range query

The transactions repository MUST filter by month using a half-open range, never string-prefix
matching.

#### Scenario: Month query uses range, not LIKE

- GIVEN a request for transactions in month '2026-08'
- WHEN the repository query executes
- THEN it MUST filter with `date >= '2026-08-01' AND date < '2026-09-01'`
- AND it MUST NOT use `LIKE` or `startsWith`-style string matching

### Requirement: Seed data

The default (production) seed MUST insert 21 category rows — 18 with `kind = 'expense'` and 3 with
`kind = 'income'` ("Sueldo", "Regalo", "Otro") — and 2 household members, with no archived rows and
no transactions or budgets; the dev-only seed MUST additionally insert 20 fixture transactions and
budgets for two months, and MUST NOT run against production.

The two kinds are a single table discriminated by `kind`, not two tables. The source design keeps
`categories` and `incomeCategories` as separate fixed lists, and the add/edit sheet selects between
them by the transaction type, so both sets MUST exist from the first seed or income transactions
cannot be recorded at all.

#### Scenario: Fresh database default seed

- GIVEN a freshly migrated empty database
- WHEN the default seed runs
- THEN it MUST contain exactly 21 categories, of which exactly 18 have `kind = 'expense'`
- AND it MUST contain exactly 3 categories with `kind = 'income'`
- AND it MUST contain exactly 2 members
- AND it MUST contain zero transactions and zero budgets

#### Scenario: Income categories are available to the add sheet

- GIVEN the default seed has run
- WHEN the add/edit sheet is opened with the transaction type set to income
- THEN the selectable category set MUST be exactly the 3 `kind = 'income'` rows
- AND it MUST NOT include any `kind = 'expense'` row

#### Scenario: Dev seed adds fixtures on top of the default seed

- GIVEN the default seed has already run
- WHEN `pnpm db:seed:dev` runs
- THEN 20 fixture transactions and budgets for two months MUST be inserted
- AND this seed MUST NOT be invoked against the production database
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
