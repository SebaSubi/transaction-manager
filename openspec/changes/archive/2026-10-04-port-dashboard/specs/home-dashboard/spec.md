# Home Dashboard Specification

## Purpose

Defines the "Inicio" screen: a static greeting, the current-month balance, a reorderable grid of
this month's budgeted expense categories, and the last five movements.

## Requirements

### Requirement: Static greeting

The screen header MUST show the static text "¡Buenas!" with no member name and no time-of-day
logic.

#### Scenario: Greeting is constant

- GIVEN a valid session at any time of day
- WHEN "Inicio" renders
- THEN the header MUST read "¡Buenas!" with no name

### Requirement: Current-month balance card

The screen MUST show a balance card for the current Buenos Aires month only, computed as net income
minus net expense over the half-open range of that month. The card label MUST state the month. The
screen MUST NOT provide a month selector and MUST NOT show an all-time balance.

#### Scenario: Balance of the current month

- GIVEN in-month income net 200000 and in-month expense net 50000, and older transactions outside
  the month
- WHEN "Inicio" renders
- THEN the card MUST show 150000 formatted as ARS, ignoring the older transactions

#### Scenario: Month label

- GIVEN the current Buenos Aires month is October
- WHEN "Inicio" renders
- THEN the card label MUST name that month (for example "Balance de octubre")

#### Scenario: No month selector

- GIVEN "Inicio" is rendered
- WHEN its controls are inspected
- THEN no month stepper or selector MUST be present

#### Scenario: Month with no transactions

- GIVEN no transactions in the current month
- WHEN "Inicio" renders
- THEN the card MUST show a zero balance

### Requirement: Budgeted category grid

The screen MUST render a grid of exactly the active (non-archived) expense categories that have a
budget in the current month. Income categories, categories without a current-month budget, and
archived categories (even with a current-month budget, per Q11) MUST NOT appear. Each card MUST show the category icon, name, and
`budgetProgress` for the current month (capped bar, uncapped label, over-budget color). Cards MUST
be ordered by `orderCategories` over the stored card order, appending unknown categories at the
end.

#### Scenario: Only budgeted expense categories

- GIVEN expense categories A (budgeted this month), B (no budget this month), and an income
  category
- WHEN "Inicio" renders
- THEN only A MUST appear in the grid

#### Scenario: Progress matches the budgets screen

- GIVEN a category budgeted at 10000 with net spent 12000 this month
- WHEN "Inicio" renders
- THEN its bar MUST be capped at 100%, its label MUST show the uncapped 120%, and the over-budget
  color MUST be used

#### Scenario: Stored order respected

- GIVEN stored order `[c, a]` and budgeted categories a, b, c
- WHEN "Inicio" renders
- THEN the order MUST be c, a, b

#### Scenario: Archived category with a budget this month

- GIVEN an archived expense category that still has a budget this month
- WHEN "Inicio" renders
- THEN it MUST NOT appear in the grid (its budget row remains editable in "Presupuesto")

### Requirement: Drag-to-reorder

The grid MUST support reordering by pointer drag, touch press-and-hold (delay 180 ms, tolerance
8 px so scrolling is not hijacked), and keyboard. The grid MUST use a two-column sorting strategy,
announce drag start, move over, drop, and cancel in Spanish for screen readers, show the new order
optimistically, and use a stable drag-context id so server and client markup match. Cards MUST
suppress the native long-press callout and text selection on touch.

#### Scenario: Touch press-and-hold reorders

- GIVEN a touch device
- WHEN the member presses a card for at least 180 ms, then drags it to another position and releases
- THEN the grid MUST show the new order immediately

#### Scenario: Quick swipe scrolls instead of dragging

- GIVEN a touch device
- WHEN the member swipes over the grid without holding 180 ms
- THEN the page MUST scroll and no reorder MUST begin

#### Scenario: Keyboard reorder

- GIVEN a focused card
- WHEN the member activates it with the keyboard, moves it with arrow keys, and drops it
- THEN the grid MUST show the new order

#### Scenario: Spanish announcements

- GIVEN a screen reader and an active drag
- WHEN the drag starts, moves over another card, ends, or is cancelled
- THEN each event MUST be announced with Spanish text

#### Scenario: No hydration mismatch

- GIVEN server-rendered markup of the grid
- WHEN the client hydrates
- THEN no accessibility-attribute hydration mismatch MUST occur

### Requirement: Persisting the order

After a reorder the screen MUST persist the visible order through a reorder action that calls
`assertSession`, validates that every id is an active category of the household, deduplicates ids,
persists `mergeCardOrder(visibleOrder, storedOrder)`, and revalidates `/inicio`. Positions of
categories not currently visible MUST be preserved. On failure the screen MUST revert the
optimistic order and show a Spanish error message.

#### Scenario: Order survives reload

- GIVEN a reorder was persisted
- WHEN "Inicio" is reloaded
- THEN the grid MUST show the persisted order

#### Scenario: Non-visible categories keep positions

- GIVEN stored order `[a, b, c]` where b has no budget this month
- WHEN the member reorders the visible cards `[a, c]` to `[c, a]`
- THEN the stored order MUST be `[c, a, b]`

#### Scenario: No session rejected

- GIVEN a request without a valid session
- WHEN the reorder action is invoked
- THEN it MUST be rejected and nothing MUST be written

#### Scenario: Foreign, archived, or duplicate ids

- GIVEN a payload with an unknown id, an archived category id, or repeated ids
- WHEN the reorder action runs
- THEN unknown or archived ids MUST be rejected with no write, and repeated ids MUST be
  deduplicated before merging

#### Scenario: Failed save reverts

- GIVEN the save fails after an optimistic reorder
- WHEN the failure is returned
- THEN the grid MUST revert to the previous order and show a Spanish error message

### Requirement: Recent movements

The screen MUST list the five most recent movements across all dates, newest first, using the same
row rendering as the ledger. Activating a row MUST open the existing add/edit sheet in edit mode
for that transaction.

#### Scenario: Five newest shown

- GIVEN seven transactions
- WHEN "Inicio" renders
- THEN exactly the five most recent MUST be listed, newest first

#### Scenario: Tap opens the edit sheet

- GIVEN a listed movement
- WHEN the member taps it
- THEN the existing sheet MUST open in edit mode prefilled with that transaction

#### Scenario: Movements outside the current month included

- GIVEN the newest transactions are from the previous month
- WHEN "Inicio" renders
- THEN they MUST still be listed

### Requirement: Empty states

The screen MUST show Spanish empty states: when no category has a budget this month, the grid area
MUST explain that there are no budgeted categories and point to "Presupuesto"; when there are no
transactions, the movements area MUST show an empty message. Each empty state MUST NOT hide the
other sections.

#### Scenario: No budgeted categories

- GIVEN no budgets in the current month
- WHEN "Inicio" renders
- THEN the grid area MUST show a Spanish empty message and the balance and movements MUST still
  render

#### Scenario: No transactions

- GIVEN no transactions
- WHEN "Inicio" renders
- THEN the movements area MUST show a Spanish empty message and the balance MUST show zero
