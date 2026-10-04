# Transaction Ledger Specification

## Purpose

Defines the "Movimientos" screen: month-scoped listing with a month stepper, filters, the 3-state
sort, list row rendering, empty states, edit entry, and hard delete behind a confirmation. URL
search params are the source of truth for month, filters, and sort.

## Requirements

### Requirement: Month scoping and default

"Movimientos" MUST list only transactions inside the selected month using the half-open range
`[start, nextMonthStart)`. With no month param it MUST show the current Buenos Aires month.

#### Scenario: Opens on the current month

- GIVEN no `month` search param and a Buenos Aires date in 2026-08
- WHEN "Movimientos" is requested
- THEN only transactions dated within 2026-08 MUST be listed
- AND the stepper MUST show "Agosto 2026"

#### Scenario: Boundary instant belongs to the next month

- GIVEN a transaction dated 2026-09-01T00:00 and the selected month 2026-08
- WHEN the list renders
- THEN that transaction MUST NOT be listed

#### Scenario: Invalid month param falls back

- GIVEN `month=garbage`
- WHEN the screen is requested
- THEN it MUST render the current month rather than error

### Requirement: Month stepper URL state

The ‹ / › stepper MUST move one month back or forward by rewriting the `month` search param, with no
fixed range: it MUST cross year boundaries and MUST allow future months. The selected month MUST
survive a reload.

#### Scenario: Stepping back across a year boundary

- GIVEN the selected month is 2026-01
- WHEN ‹ is activated
- THEN the URL month param MUST become 2025-12 and the list MUST show December 2025

#### Scenario: Stepping forward into a future month

- GIVEN the selected month is the current month
- WHEN › is activated
- THEN the URL month param MUST become the next month and its (possibly empty) list MUST render

#### Scenario: Month survives reload

- GIVEN the URL has `month=2026-03`
- WHEN the page is reloaded
- THEN March 2026 MUST remain selected

### Requirement: Filters

The screen MUST provide type, category, member, date-from, and date-to filters applied through
`filterTransactions`, combined as AND, and reflected in the URL. An unset filter MUST impose no
constraint. Filter state MUST survive a reload.

#### Scenario: Type filter

- GIVEN a month with both expense and income rows and `type=expense` in the URL
- WHEN the list renders
- THEN only expense rows MUST be shown

#### Scenario: Category and member combined

- GIVEN `category` and `member` params set
- WHEN the list renders
- THEN only rows matching both MUST be shown

#### Scenario: Filter state in the URL survives reload

- GIVEN a filter set via the controls
- WHEN the page is reloaded
- THEN the same filter MUST remain applied and its control MUST show it

#### Scenario: Archived category and member remain filterable

- GIVEN transactions referencing an archived category or member in the selected month
- WHEN filter options are built
- THEN those archived values MUST be selectable as filters, labeled as archived

### Requirement: Date filters narrow within the selected month

Date-from and date-to MUST narrow results only inside the selected month; the stepper always
defines the outer range. Values outside the selected month MUST be clamped to the month's first
and last day. Changing the month MUST clear both date filters while preserving the other filters
and the sort.

#### Scenario: Range within the month narrows results

- GIVEN month 2026-08, dateFrom=2026-08-05, dateTo=2026-08-10
- WHEN the list renders
- THEN only transactions dated 2026-08-05 through 2026-08-10 inclusive MUST be shown

#### Scenario: Out-of-month dates are clamped

- GIVEN month 2026-08, dateFrom=2026-07-20, dateTo=2026-09-15
- WHEN the list renders
- THEN the effective range MUST be 2026-08-01 through 2026-08-31 and no transaction outside August
  MUST appear

#### Scenario: Month change clears date filters only

- GIVEN month 2026-08 with `type=expense`, dateFrom, dateTo, and a sort set
- WHEN the stepper moves to 2026-09
- THEN dateFrom and dateTo MUST be cleared and `type` and sort MUST remain

#### Scenario: Date-to includes the whole last day

- GIVEN dateTo=2026-08-10 and a transaction at 2026-08-10T18:45
- WHEN the list renders
- THEN that transaction MUST be included

### Requirement: Three-state sort

The sort toggle MUST cycle date-desc, amount-desc, amount-asc, then date-desc, via
`sortTransactions`, with the state held in the URL. The default MUST be date-desc. Amount sorting
MUST use the net amount.

#### Scenario: Default is date descending

- GIVEN no sort param
- WHEN the list renders
- THEN rows MUST be ordered newest first

#### Scenario: Toggle advances the cycle

- GIVEN the current sort is date-desc
- WHEN the toggle is activated
- THEN the URL sort MUST become amount-desc and rows MUST be ordered by net amount high to low

#### Scenario: Sort survives month change and reload

- GIVEN sort=amount-asc
- WHEN the month changes or the page reloads
- THEN the sort MUST remain amount-asc

### Requirement: Row rendering

Each row MUST show the category label, member label, the formatted date via `formatShortDate`, and
the net amount via `formatArs`, signed or colored by type. Expense rows with cashback MUST also
show the gross amount. Archived category or member labels MUST be marked as archived.

#### Scenario: Expense row with cashback

- GIVEN an expense with gross 33333 and net 31000
- WHEN the row renders
- THEN it MUST show the net 31000 via `formatArs` and the gross 33333 as secondary information

#### Scenario: Income row

- GIVEN an income of 50000
- WHEN the row renders
- THEN it MUST show 50000 styled as income and no cashback information

#### Scenario: Archived category label

- GIVEN a row whose category is archived
- WHEN the row renders
- THEN the category label MUST still display, marked as archived

### Requirement: Empty states

The screen MUST show a short neutral Spanish message when no transactions exist for the selected
month and when filters match nothing, distinguishing the two. The empty state MUST NOT hide the
stepper or filters.

#### Scenario: Month with no transactions

- GIVEN a selected month with zero transactions and no filters
- WHEN the screen renders
- THEN an empty-month message MUST be shown and the stepper MUST remain usable

#### Scenario: Filters match nothing

- GIVEN a month with transactions and filters that exclude all of them
- WHEN the screen renders
- THEN a no-results-for-filters message MUST be shown with a way to clear the filters

### Requirement: Edit from the list

Activating a row MUST open the add/edit sheet in edit mode. A successful save MUST update the row,
applied optimistically and reconciled with the persisted row on revalidation.

#### Scenario: Edit reflected in the list

- GIVEN a row opened in the sheet and its gross changed
- WHEN the save succeeds
- THEN the list MUST show the persisted amounts

#### Scenario: Rejected edit reverts optimistic state

- GIVEN an optimistic update that the server rejects
- WHEN the action returns an error
- THEN the row MUST revert to its persisted values and the error MUST be shown

### Requirement: Hard delete with confirmation

Deleting a transaction MUST be a hard delete that requires an explicit confirmation prompt in
Spanish. Delete MUST be reachable only from the edit sheet or an explicit row action, never a
swipe gesture or a single accidental tap. Cancelling MUST leave the transaction untouched.
Confirming MUST permanently remove the row; no undo or soft delete exists.

#### Scenario: Delete requires confirmation

- GIVEN a transaction opened in the sheet
- WHEN the delete control is activated
- THEN a confirmation prompt MUST appear and nothing MUST be deleted yet

#### Scenario: Cancel keeps the transaction

- GIVEN the confirmation prompt is shown
- WHEN the user cancels
- THEN the transaction MUST remain in the database and the list

#### Scenario: Confirm removes permanently

- GIVEN the confirmation prompt is shown
- WHEN the user confirms
- THEN the row MUST be deleted from the database, removed from the list, and the sheet closed

#### Scenario: Deleting an already-deleted row

- GIVEN a transaction deleted elsewhere
- WHEN the delete action runs for its id
- THEN it MUST return without data loss and the list MUST reconcile to the server state

#### Scenario: Deletion changes balance-driving totals

- GIVEN a deleted transaction
- WHEN `totalBalance` and category spent values are next computed
- THEN the deleted transaction MUST NOT contribute
