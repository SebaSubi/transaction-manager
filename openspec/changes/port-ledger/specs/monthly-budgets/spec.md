# Monthly Budgets Specification

## Purpose

Defines the "Presupuesto" screen: expense-only per-month budget rows with progress, amount
validation, add/edit/remove of rows, and fill-only-missing copy from the previous month. Budgets
are scoped per month; the selected month is URL state.

## Requirements

### Requirement: Month stepper and per-month scope

"Presupuesto" MUST show the budgets of the selected month only, defaulting to the current Buenos
Aires month, with the same ‹ / › stepper behavior as "Movimientos" (rewrites the `month` search
param, crosses years, allows future months, survives reload, invalid param falls back to current).

#### Scenario: Defaults to current month

- GIVEN no `month` param
- WHEN "Presupuesto" is requested
- THEN the current Buenos Aires month's budget rows MUST be shown

#### Scenario: Stepping changes the month and its rows

- GIVEN budgets exist for 2026-07 and 2026-08 and 2026-08 is selected
- WHEN ‹ is activated
- THEN the URL month MUST become 2026-07 and only July's rows MUST be shown

#### Scenario: Budgets are independent per month

- GIVEN "Supermercado" has amount 100000 in 2026-07 and none in 2026-08
- WHEN 2026-08 is selected
- THEN "Supermercado" MUST NOT appear as budgeted

### Requirement: Expense-only budgets

Budget rows MUST reference expense categories only. Income categories MUST NOT be offered or
accepted.

#### Scenario: Add-category picker excludes income and archived categories

- GIVEN the default seed and one archived expense category
- WHEN the add-row picker is opened
- THEN it MUST list only active expense categories not already budgeted in the selected month
- AND it MUST NOT list income categories or archived categories

#### Scenario: Server rejects an income category

- GIVEN an income-kind category id submitted to the upsert action
- WHEN the action runs
- THEN it MUST return a Spanish error and write nothing

### Requirement: Progress display

Each row MUST show the budgeted amount, the spent net amount for that category within the selected
month (via `spentForCategory`), and progress via `budgetProgress`: bar capped at 100, label
uncapped, over-budget color switch. Amounts MUST be formatted with `formatArs`.

#### Scenario: Within budget

- GIVEN budgeted 1000 and spent 800
- WHEN the row renders
- THEN the bar MUST show 80 with the income color and the label 80%

#### Scenario: Over budget

- GIVEN budgeted 1000 and spent 1500
- WHEN the row renders
- THEN the bar MUST be capped at 100, the label MUST read 150%, and the color MUST be the expense
  color

#### Scenario: Spent uses net within the month only

- GIVEN expenses in the category in both the selected month and another month
- WHEN spent is computed
- THEN only the selected month's net amounts MUST be summed

### Requirement: Budget amount validation

A budget amount MUST be a whole number of pesos greater than 0. Zero, negative, decimal, or
non-numeric amounts MUST be rejected server-side with a Spanish message and nothing persisted.

#### Scenario: Valid amount saved

- GIVEN an amount of 50000 for an active expense category in 2026-08
- WHEN the upsert action runs
- THEN a budget row for that month and category MUST exist with amount 50000

#### Scenario: Zero rejected

- GIVEN an amount of 0
- WHEN the upsert action runs
- THEN it MUST return a Spanish validation error and write nothing

#### Scenario: Decimal or negative rejected

- GIVEN an amount of 10.5 or -100
- WHEN the upsert action runs
- THEN it MUST return a Spanish validation error and write nothing

### Requirement: Add and edit rows

The user MUST be able to add a row for an active expense category not yet budgeted in the month and
edit an existing row's amount. Upserting for an existing month and category MUST update its amount
without creating a duplicate.

#### Scenario: Add a row

- GIVEN a category without a row in the selected month
- WHEN the user adds it with a valid amount
- THEN exactly one row for that month and category MUST exist

#### Scenario: Edit an amount

- GIVEN an existing row with amount 1000
- WHEN the user saves 2500
- THEN the row MUST hold 2500 and no duplicate row MUST exist

#### Scenario: Archived category with an existing row

- GIVEN a budget row whose category was archived after the row was created
- WHEN the screen renders
- THEN the row MUST still display with its label marked as archived and be editable and removable

### Requirement: Remove a row

Removing a budget row MUST always be allowed, MUST delete only that budget row, and MUST NOT touch
any transaction.

#### Scenario: Remove leaves transactions untouched

- GIVEN a budget row for "Supermercado" and expenses in that category
- WHEN the row is removed
- THEN the budget row MUST be gone and every transaction MUST remain unchanged

#### Scenario: Remove a missing row

- GIVEN a row already removed elsewhere
- WHEN the remove action runs
- THEN it MUST complete without error and the list MUST reconcile

### Requirement: Copy previous month fills only missing categories

The screen MUST offer "Copiar presupuesto de {mes}" where {mes} is the label of the previous month
(via `prevMonthKey` and `monthKeyLabel`). Copy MUST insert, into the selected month, a row for each
source-month category that has no row in the selected month, with the source amount. It MUST NOT
modify or delete any existing row of the selected month. Source rows whose category is archived
MUST be skipped. The action MUST be idempotent. When the source month has no rows, the action
MUST insert nothing and report a Spanish message.

#### Scenario: Copy fills missing categories

- GIVEN July has Supermercado=100000 and Transporte=50000, and August has none
- WHEN "Copiar presupuesto de Julio 2026" runs for August
- THEN August MUST contain Supermercado=100000 and Transporte=50000

#### Scenario: Existing rows are never overwritten

- GIVEN July has Supermercado=100000 and August has Supermercado=80000
- WHEN the copy runs for August
- THEN August's Supermercado MUST remain 80000

#### Scenario: Archived source categories are skipped

- GIVEN July has a row for a category that is now archived
- WHEN the copy runs for August
- THEN no August row MUST be created for that category

#### Scenario: Copy is idempotent

- GIVEN the copy already ran for August
- WHEN it runs again
- THEN the row set and amounts of August MUST be unchanged

#### Scenario: Empty source month

- GIVEN the previous month has no budget rows
- WHEN the copy action runs
- THEN nothing MUST be inserted and a Spanish message MUST explain there is nothing to copy

#### Scenario: January copies from the prior December

- GIVEN the selected month is 2026-01
- WHEN the copy control renders
- THEN its label MUST name "Diciembre 2025" and the source month MUST be 2025-12

### Requirement: Empty state

When the selected month has no budget rows, the screen MUST show a short neutral Spanish empty
message, the add-row control, and the copy control (when applicable). The stepper MUST remain
usable.

#### Scenario: Month without budgets

- GIVEN a selected month with zero budget rows
- WHEN the screen renders
- THEN an empty message, the add control, and the copy control MUST be shown

#### Scenario: All expense categories already budgeted

- GIVEN every active expense category has a row in the selected month
- WHEN the screen renders
- THEN the add-row control MUST be disabled or hidden
