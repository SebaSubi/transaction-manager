# Delta for data-persistence

No schema change and no migration are part of this delta; every operation uses existing columns
and tables.

## MODIFIED Requirements

### Requirement: Archive semantics (soft-delete)

Categories and members MUST carry a nullable `archived_at` timestamp. Archiving MUST NOT delete
or cascade-delete referencing rows. Restoring (unarchiving) MUST clear `archived_at` and MUST NOT
modify any other row.
(Previously: the requirement covered archiving only; restore was not defined.)

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

#### Scenario: Restoring clears archived_at

- GIVEN an archived category or member
- WHEN it is restored
- THEN `archived_at` MUST be null
- AND it MUST appear again in pickers and active listings

## ADDED Requirements

### Requirement: Category rename

The categories repository MUST provide a rename operation that updates only the `name` of a
category by id. It MUST NOT change the icon, color, kind, or `archived_at`, and MUST NOT modify
referencing rows. A rename colliding with the partial unique index on active names MUST fail
without any partial write.

#### Scenario: Rename updates only the name

- GIVEN a category with a name, icon, and color
- WHEN it is renamed to a free name
- THEN only `name` MUST change
- AND existing transactions and budgets MUST still resolve it under the new name

#### Scenario: Rename to an active duplicate fails

- GIVEN two active categories of the same kind named "A" and "B"
- WHEN "B" is renamed to "A"
- THEN the operation MUST fail and "B" MUST keep its name

### Requirement: Unarchive members and categories

The members and categories repositories MUST provide an unarchive operation by id that sets
`archived_at` to null. If an active row with the same name (same kind for categories) exists, the
operation MUST fail through the partial unique index with no partial write and the row MUST
remain archived.

#### Scenario: Restore succeeds when the name is free

- GIVEN an archived member and no active member with that name
- WHEN it is unarchived
- THEN the member MUST be active

#### Scenario: Restore blocked by an active duplicate name

- GIVEN an archived category "Comida" and an active category "Comida" of the same kind
- WHEN the archived one is unarchived
- THEN the operation MUST fail
- AND the archived category MUST remain archived

### Requirement: List archived rows

The members and categories repositories MUST provide reads that return only archived rows
(non-null `archived_at`). Expense-category listing for management MUST cover expense kind only.

#### Scenario: Only archived rows returned

- GIVEN two active and one archived member
- WHEN archived members are listed
- THEN only the archived member MUST be returned

#### Scenario: Archived expense categories only

- GIVEN an archived expense category and an archived income category
- WHEN archived expense categories are listed
- THEN only the expense category MUST be returned

### Requirement: Recent transactions read

The transactions repository MUST provide `listRecentTransactions(limit)` returning at most `limit`
transactions across all dates, ordered newest first by transaction date, with a deterministic
tiebreaker, and resolving archived categories and members like other reads.

#### Scenario: Limit and order

- GIVEN seven transactions on distinct dates
- WHEN `listRecentTransactions(5)` runs
- THEN exactly the five most recent MUST be returned, newest first

#### Scenario: Fewer than the limit

- GIVEN two transactions
- WHEN `listRecentTransactions(5)` runs
- THEN both MUST be returned

#### Scenario: Empty store

- GIVEN no transactions
- WHEN `listRecentTransactions(5)` runs
- THEN an empty list MUST be returned

### Requirement: Card order persistence via merge

Persisting a card order MUST write the result of `mergeCardOrder(visibleOrder, storedOrder)` through
the existing whole-order replace, so ids not in the visible order keep their stored relative
positions. The write MUST be atomic: a failure MUST leave the previous stored order unchanged.

#### Scenario: Non-visible categories keep their positions

- GIVEN stored order `[a, b, c, d]` where only `a`, `c` are budgeted this month
- WHEN the visible order `[c, a]` is persisted
- THEN the stored order MUST be `[c, a, b, d]`

#### Scenario: Empty stored order

- GIVEN no stored order and visible order `[a, b]`
- WHEN the visible order is persisted
- THEN the stored order MUST be `[a, b]`

#### Scenario: Failure leaves the order intact

- GIVEN a stored order and a write that fails
- WHEN persistence is attempted
- THEN the stored order MUST be unchanged
