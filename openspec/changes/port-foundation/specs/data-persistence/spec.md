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
