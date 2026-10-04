# Transaction Entry Specification

## Purpose

Defines the add/edit bottom sheet and the create/update Server Action contract: field set,
type-driven category set, whole-peso and cashback validation, date/time handling, the per-device
last-used member cookie, and archived-value handling on edit. The stored net amount is always
computed server-side by `computeNetAmount`; the client never supplies it.

## Requirements

### Requirement: Sheet fields and entry points

The add/edit sheet MUST present these fields: type (expense/income), gross amount, cashback percent
(expense only), category, member ("Quién"), and date/time. The sheet MUST open in create mode from
the center FAB and in edit mode from a ledger row, with the edit fields pre-filled from the
persisted transaction.

#### Scenario: FAB opens the sheet in create mode

- GIVEN any shell route
- WHEN the center FAB is activated
- THEN the add/edit sheet MUST open in create mode with empty amount and type defaulting to expense

#### Scenario: Row opens the sheet in edit mode

- GIVEN a transaction row in "Movimientos"
- WHEN the row is activated
- THEN the sheet MUST open in edit mode with type, gross, cashback, category, member, and date/time
  pre-filled from the stored values

#### Scenario: Cashback field hidden for income

- GIVEN the sheet type is income
- WHEN the sheet is rendered
- THEN the cashback field MUST NOT be shown

### Requirement: Type-driven category set

The selectable categories MUST be only active categories whose `kind` matches the selected type:
18 expense categories for expense, exactly the 3 income categories for income. Switching type MUST
swap the set and MUST clear a category selection that does not belong to the new set.

#### Scenario: Expense type lists expense categories only

- GIVEN the default seed and type=expense
- WHEN the category picker is rendered
- THEN it MUST list the active `kind = 'expense'` categories and no `kind = 'income'` category

#### Scenario: Income type lists exactly the three income categories

- GIVEN the default seed and type=income
- WHEN the category picker is rendered
- THEN it MUST list exactly "Sueldo", "Regalo", "Otro"

#### Scenario: Switching type clears an incompatible category

- GIVEN type=expense with category "Supermercado" selected
- WHEN the type is switched to income
- THEN the selected category MUST be cleared and the income set shown

#### Scenario: Archived categories are not offered on create

- GIVEN an archived expense category
- WHEN the sheet is opened in create mode
- THEN the archived category MUST NOT appear in the picker

### Requirement: Whole-peso gross validation

Gross MUST be a whole number of pesos greater than 0. Plain digits and valid es-AR thousands
grouping with dots (`1.500`, `12.000.000`) MUST be accepted; the dots are stripped. A value with
decimals (including malformed grouping such as `1.5`, `1.50`, `1.5000`, `.500`, `1..500`) MUST be
rejected with a Spanish message and nothing persisted. Validation MUST run server-side regardless of any client
checks.

#### Scenario: Whole-peso gross accepted

- GIVEN gross=33333
- WHEN the create action is submitted with otherwise valid input
- THEN the transaction MUST be persisted with `gross = 33333`

#### Scenario: Thousands-grouped gross accepted

- GIVEN gross="12.000.000" (the entry input shows digits grouped with dots while typing)
- WHEN the create action is submitted with otherwise valid input
- THEN the transaction MUST be persisted with `gross = 12000000`

#### Scenario: Gross input groups digits while typing

- GIVEN the user types `12000000` in the gross input
- THEN the input MUST display `12.000.000`
- AND a value containing a comma MUST be left as typed so the validation message shows

#### Scenario: Decimal gross rejected

- GIVEN gross=100.50
- WHEN the create action is submitted
- THEN the action MUST return a Spanish validation error for the gross field
- AND no row MUST be written

#### Scenario: Zero, negative, or non-numeric gross rejected

- GIVEN gross is 0, -5, or not a number
- WHEN the create action is submitted
- THEN the action MUST return a Spanish validation error for the gross field
- AND no row MUST be written

### Requirement: Cashback validation and storage

Cashback applies to expenses only and MUST be a number from 0 to 100 inclusive with at most 2
decimal places. It MUST be stored as integer basis points (`cashback_bps`, percent x 100). An empty
cashback MUST be treated as 0.

#### Scenario: Cashback with decimals stored as basis points

- GIVEN an expense with cashback=7.25
- WHEN it is persisted
- THEN `cashback_bps` MUST equal 725

#### Scenario: Cashback bounds accepted

- GIVEN an expense with cashback=0, and another with cashback=100
- WHEN each is submitted
- THEN both MUST be accepted; the cashback=100 expense MUST persist with `amount = 0`

#### Scenario: Cashback above 100 or below 0 rejected

- GIVEN cashback=100.01 or cashback=-1
- WHEN the action is submitted
- THEN it MUST return a Spanish validation error for the cashback field
- AND no row MUST be written

#### Scenario: Cashback with more than 2 decimals rejected

- GIVEN cashback=7.255
- WHEN the action is submitted
- THEN it MUST return a Spanish validation error for the cashback field
- AND no row MUST be written

#### Scenario: Empty cashback treated as zero

- GIVEN an expense with gross=1000 and an empty cashback field
- WHEN it is persisted
- THEN `cashback_bps` MUST equal 0 and `amount` MUST equal 1000

### Requirement: Income forces cashback to zero

An income transaction MUST persist with `cashback_bps = 0` regardless of any cashback value
submitted, and its net MUST equal its gross.

#### Scenario: Income with submitted cashback is stored with zero

- GIVEN type=income, gross=50000, and a submitted cashback of 10
- WHEN the action persists the transaction
- THEN `cashback_bps` MUST equal 0 and `amount` MUST equal 50000

#### Scenario: Switching an expense to income on edit drops cashback

- GIVEN an expense with cashback 7 is opened for edit
- WHEN the type is changed to income, a valid income category chosen, and saved
- THEN the stored `cashback_bps` MUST be 0 and `amount` MUST equal `gross`

### Requirement: Net computed server-side

On create and update, the server MUST compute the stored `amount` with `computeNetAmount` from the
validated gross and cashback. The client MUST NOT supply or influence the stored net.

#### Scenario: Net matches the domain function

- GIVEN an expense with gross=33333 and cashback=7
- WHEN it is created
- THEN the stored row MUST have `amount = 31000`, `gross = 33333`, `cashback_bps = 700`

#### Scenario: Client-supplied net is ignored

- GIVEN a submission that includes an `amount` value inconsistent with gross and cashback
- WHEN the action runs
- THEN the stored `amount` MUST be the server-computed value

### Requirement: Date/time field

The sheet MUST show an editable date/time field. On create it MUST default to the current Buenos
Aires wall-clock time obtained from `nowInBuenosAires`. The stored `date` MUST equal the entered
wall-clock value with no timezone conversion. An invalid or empty date MUST be rejected with a
Spanish message.

#### Scenario: Default is Buenos Aires now

- GIVEN the UTC instant 2026-08-15T00:00:00Z
- WHEN the sheet opens in create mode
- THEN the date/time field MUST default to 2026-08-14 at 21:00

#### Scenario: Entered wall-clock value stored unchanged

- GIVEN the user enters 2026-08-10 at 09:30
- WHEN the transaction is saved
- THEN the stored `date` MUST be the wall-clock timestamp 2026-08-10T09:30 with no offset applied

#### Scenario: Invalid date rejected

- GIVEN the date/time field is empty or not a valid date
- WHEN the action is submitted
- THEN it MUST return a Spanish validation error for the date field
- AND no row MUST be written

### Requirement: Active category and member on create

On create, the server MUST verify the category is active, its `kind` matches the type, and the
member is active. Otherwise it MUST reject with a Spanish message and write nothing.

#### Scenario: Archived member rejected on create

- GIVEN an archived member id is submitted on create
- WHEN the action runs
- THEN it MUST return a Spanish validation error and write nothing

#### Scenario: Category kind mismatch rejected

- GIVEN type=income and an expense-kind category id
- WHEN the action runs
- THEN it MUST return a Spanish validation error and write nothing

### Requirement: Last-used member cookie

On every successful create or update, the server MUST set a per-device cookie holding the
submitted member id. On opening the sheet in create mode, "Quién" MUST default to the cookie's
member when that member exists and is active; otherwise it MUST fall back to the first active
member. A missing cookie MUST also fall back to the first active member. Edit mode MUST pre-fill
the transaction's own member and MUST NOT use the cookie.

#### Scenario: Cookie member preselected

- GIVEN the cookie holds the id of an active member
- WHEN the sheet opens in create mode
- THEN "Quién" MUST be preselected to that member

#### Scenario: Cookie updated after a successful save

- GIVEN a member is chosen in the sheet
- WHEN the transaction is saved successfully
- THEN the last-used member cookie MUST hold that member's id

#### Scenario: Cookie not updated on a rejected save

- GIVEN a submission that fails validation
- WHEN the action returns the error
- THEN the cookie value MUST be unchanged

#### Scenario: Archived cookie member falls back to first active member

- GIVEN the cookie holds the id of a member who has since been archived
- WHEN the sheet opens in create mode
- THEN "Quién" MUST be preselected to the first active member

#### Scenario: No cookie falls back to first active member

- GIVEN no last-used member cookie exists, or it holds an unknown id
- WHEN the sheet opens in create mode
- THEN "Quién" MUST be preselected to the first active member

### Requirement: Archived category or member on edit

When editing a transaction whose category or member is archived, the sheet MUST show that value
selected, labeled as archived, and keep it in the picker. The user MAY switch to an active value;
once switched away, the archived value is not re-offered other than as the originally stored value.
Saving without changing an archived value MUST succeed.

#### Scenario: Archived category shown selected on edit

- GIVEN a transaction whose category is archived
- WHEN the sheet opens in edit mode
- THEN that category MUST be selected, labeled as archived

#### Scenario: Archived member shown selected on edit

- GIVEN a transaction whose member is archived
- WHEN the sheet opens in edit mode
- THEN that member MUST be selected, labeled as archived

#### Scenario: Saving an unchanged archived value succeeds

- GIVEN an edit of a transaction with an archived category where only the gross changes
- WHEN the update action runs
- THEN the update MUST succeed and the category MUST remain unchanged

#### Scenario: Switching to an active value

- GIVEN an edit with an archived category selected
- WHEN the user selects an active category of the same kind and saves
- THEN the transaction MUST persist with the active category

### Requirement: Update action

The update action MUST apply the same validation and server-side net computation as create to an
existing transaction id, returning the persisted row. An unknown id MUST return a Spanish error
with nothing written.

#### Scenario: Update recomputes net

- GIVEN a stored expense gross=1000 cashback 0
- WHEN it is updated to cashback=10
- THEN the stored `amount` MUST equal 900 and `cashback_bps` MUST equal 1000

#### Scenario: Update of a missing transaction

- GIVEN an id that does not exist (for example already deleted)
- WHEN the update action runs
- THEN it MUST return a Spanish error and write nothing

### Requirement: Action errors and success feedback

Server Actions MUST return per-field Spanish error messages on validation failure and MUST keep the
sheet open with entered values preserved. On success the sheet MUST close and affected routes MUST
be revalidated.

#### Scenario: Validation errors keep the sheet open

- GIVEN a submission with invalid gross
- WHEN the action returns the error
- THEN the sheet MUST remain open with the entered values intact and the error shown

#### Scenario: Success closes the sheet and refreshes lists

- GIVEN a valid submission
- WHEN the action succeeds
- THEN the sheet MUST close and the "Movimientos" list MUST reflect the change
