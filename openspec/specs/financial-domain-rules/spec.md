# Financial Domain Rules Specification

## Purpose

Defines the pure domain functions in `lib/domain/`, ported from the prototype's `renderVals()`.
These functions MUST import no React and no database module. `lib/db/repositories/` and the
future screen slices (changes 2 and 3) MUST call them rather than reimplement any of this logic.

## Requirements

### Requirement: computeNetAmount — cashback net/gross math

`computeNetAmount` MUST apply cashback to expense transactions only, using
`net = max(0, round(gross * (1 - pct/100)))`, rounded to whole pesos exactly once.

#### Scenario: Expense with cashback reduces net below gross

- GIVEN an expense with gross=33333 and cashback=7
- WHEN computeNetAmount is called
- THEN the result MUST equal `round(33333 * 0.93)` = 31000

#### Scenario: Cashback result capped at zero, never negative

- GIVEN an expense with gross=1000 and cashback=150
- WHEN computeNetAmount is called
- THEN the result MUST be 0, never a negative number

#### Scenario: Income ignores cashback entirely

- GIVEN an income transaction with gross=50000 and cashback=10
- WHEN computeNetAmount is called
- THEN the result MUST equal 50000; cashback MUST have no effect

#### Scenario: Rounding happens exactly once

- GIVEN an expense with gross=100 and cashback=33
- WHEN computeNetAmount is called
- THEN the fractional intermediate value (67.0) MUST be rounded to an integer exactly once, and
  MUST NOT be re-rounded on read or display

### Requirement: spentForCategory and totalBalance consume net amounts

`spentForCategory` MUST sum NET amounts for a category within a given period.
`totalBalance` MUST sum NET income minus NET expense across ALL transactions ever recorded, not
only the currently selected month — this is deliberate, not a bug.

#### Scenario: spentForCategory sums net, not gross

- GIVEN two expenses in the same category with gross/net pairs (1000/930) and (2000/1860)
- WHEN spentForCategory is called for that category
- THEN the result MUST equal 930 + 1860 = 2790, never the sum of gross values

#### Scenario: totalBalance spans all history, not the selected month

- GIVEN transactions exist in both 2026-01 and 2026-08, and the currently selected month is
  2026-08
- WHEN totalBalance is called
- THEN it MUST include transactions from 2026-01 as well as 2026-08

#### Scenario: totalBalance nets income against expense

- GIVEN total income of 100000 and total net expense of 40000 across all history
- WHEN totalBalance is called
- THEN the result MUST equal 60000

### Requirement: budgetProgress — capped bar, uncapped label, over-budget color switch

`budgetProgress` MUST cap the progress bar percentage at 100 while the percentage label MUST
remain uncapped; the bar color MUST switch to the expense color when spent exceeds budgeted, and
stay the income color otherwise.

#### Scenario: Bar caps at 100% when overspent

- GIVEN budgeted=1000 and spent=1500
- WHEN budgetProgress is called
- THEN the bar percentage MUST be capped at 100

#### Scenario: Label is uncapped when overspent

- GIVEN budgeted=1000 and spent=1500
- WHEN budgetProgress is called
- THEN the label percentage MUST be 150, not capped

#### Scenario: Color switches to expense color when over budget

- GIVEN spent (1500) exceeds budgeted (1000)
- WHEN budgetProgress is called
- THEN the returned color MUST be the expense color, not the income color

#### Scenario: Color stays income color within budget

- GIVEN spent (800) does not exceed budgeted (1000)
- WHEN budgetProgress is called
- THEN the returned color MUST be the income color

### Requirement: Month-key helpers and half-open range

`monthKeyLabel` MUST convert a 'YYYY-MM' key to its Spanish label. `prevMonthKey` MUST compute
the previous month key, correctly rolling over January to the prior December. The month range
helper MUST produce a half-open `[start, nextMonthStart)` pair. Month filtering MUST NOT use
string prefix matching or `LIKE`.

#### Scenario: monthKeyLabel formats correctly

- GIVEN the key '2026-08'
- WHEN monthKeyLabel is called
- THEN the result MUST equal 'Agosto 2026'

#### Scenario: prevMonthKey rolls over the year boundary

- GIVEN the key '2026-01'
- WHEN prevMonthKey is called
- THEN the result MUST equal '2025-12'

#### Scenario: prevMonthKey within the same year

- GIVEN the key '2026-08'
- WHEN prevMonthKey is called
- THEN the result MUST equal '2026-07'

#### Scenario: Half-open month range excludes the next month's first instant

- GIVEN the key '2026-08'
- WHEN the month range helper is called
- THEN it MUST return start='2026-08-01T00:00' and nextMonthStart='2026-09-01T00:00'
- AND a transaction dated exactly at nextMonthStart MUST NOT be included in the range

### Requirement: nowInBuenosAires — server "now" is Buenos Aires wall-clock

`nowInBuenosAires` MUST be the only permitted source of "now" server-side. It MUST return Buenos
Aires wall-clock time, never UTC; bare `new Date()` treated as local time MUST NOT be used
server-side.

#### Scenario: 21:00 Buenos Aires action does not record tomorrow's date

- GIVEN the actual UTC instant is 2026-08-15T00:00:00Z (21:00 on 2026-08-14 in Buenos Aires,
  UTC-3)
- WHEN nowInBuenosAires is called
- THEN the returned wall-clock date MUST be 2026-08-14, not 2026-08-15

#### Scenario: Buenos Aires offset is fixed, with no daylight-saving adjustment

- GIVEN any date in the year
- WHEN nowInBuenosAires computes the offset
- THEN it MUST apply a constant UTC-3 offset with no daylight-saving adjustment

### Requirement: filterTransactions

`filterTransactions` MUST filter by type, category, member, and date-from/date-to. An
empty/unset filter value MUST impose no constraint on that dimension.

#### Scenario: Empty filters return all transactions

- GIVEN no filter values are set
- WHEN filterTransactions is called
- THEN every transaction MUST be included in the result

#### Scenario: Type filter narrows results

- GIVEN a filter with type='expense'
- WHEN filterTransactions is called
- THEN only expense transactions MUST be included

#### Scenario: Combined filters apply as AND

- GIVEN filters with category='Supermercado' and member set to one household member
- WHEN filterTransactions is called
- THEN only transactions matching both the category AND the member MUST be included

#### Scenario: Date range filter bounds inclusion

- GIVEN dateFrom='2026-08-01' and dateTo='2026-08-15'
- WHEN filterTransactions is called
- THEN only transactions with a date within that range MUST be included

### Requirement: sortTransactions — 3-state cycle

`sortTransactions` MUST cycle through exactly three states in this fixed order: date descending,
then amount descending, then amount ascending, then back to date descending.

#### Scenario: Cycle advances from date-desc to amount-desc

- GIVEN the current sort state is 'date-desc'
- WHEN the sort toggle is invoked
- THEN the next state MUST be 'amount-desc'

#### Scenario: Cycle wraps back to the start

- GIVEN the current sort state is 'amount-asc'
- WHEN the sort toggle is invoked
- THEN the next state MUST be 'date-desc'

#### Scenario: Each state sorts correctly

- GIVEN state 'amount-desc'
- WHEN sortTransactions applies it
- THEN transactions MUST be ordered by amount from highest to lowest

### Requirement: orderCategories

`orderCategories` MUST honor a stored explicit order for known categories and MUST append any
category not present in the stored order at the end, in stable order.

#### Scenario: Stored order is respected

- GIVEN a stored order ['B', 'A', 'C'] and categories A, B, C
- WHEN orderCategories is called
- THEN the result MUST be [B, A, C]

#### Scenario: Unknown category appended at the end

- GIVEN a stored order ['A', 'B'] and categories A, B, D (D is unordered/new)
- WHEN orderCategories is called
- THEN the result MUST be [A, B, D], with D last

### Requirement: categoryColor — accent cycle

`categoryColor` MUST assign colors from a fixed accent cycle, indexed by the category's position
modulo the cycle length, and MUST use a separate, brighter cycle when dark mode is active.

#### Scenario: Color cycles by position modulo cycle length

- GIVEN a 6-color accent cycle and a category at index 7
- WHEN categoryColor is called in light mode
- THEN the result MUST equal the color at index `7 % 6` = 1

#### Scenario: Dark mode uses the brighter cycle

- GIVEN the same category index in dark mode
- WHEN categoryColor is called
- THEN the result MUST be drawn from the separate dark-mode accent cycle, not the light-mode cycle

### Requirement: greeting — time-based Spanish greeting

`greeting` MUST return 'Buenos días' before 12:00, 'Buenas tardes' before 19:00, and
'Buenas noches' otherwise, based on Buenos Aires wall-clock time.

#### Scenario: Morning greeting

- GIVEN the Buenos Aires wall-clock hour is 9
- WHEN greeting is called
- THEN the result MUST equal 'Buenos días'

#### Scenario: Afternoon greeting at the 12:00 boundary

- GIVEN the Buenos Aires wall-clock hour is 12
- WHEN greeting is called
- THEN the result MUST equal 'Buenas tardes'

#### Scenario: Evening greeting at the 19:00 boundary

- GIVEN the Buenos Aires wall-clock hour is 19
- WHEN greeting is called
- THEN the result MUST equal 'Buenas noches'

#### Scenario: Late-night greeting

- GIVEN the Buenos Aires wall-clock hour is 23
- WHEN greeting is called
- THEN the result MUST equal 'Buenas noches'
### Requirement: formatArs — ARS currency formatting

`formatArs` MUST format an integer whole-peso amount for display in Argentine peso style: `$`
prefix, `.` thousands separator, no decimals. Negative values MUST show a leading minus. It MUST
NOT perform any rounding of already-integer input.

#### Scenario: Thousands grouping

- GIVEN the amount 1234567
- WHEN formatArs is called
- THEN the result MUST be "$1.234.567"

#### Scenario: Zero and small values

- GIVEN the amounts 0 and 999
- WHEN formatArs is called
- THEN the results MUST be "$0" and "$999"

#### Scenario: Negative amount

- GIVEN the amount -5000
- WHEN formatArs is called
- THEN the result MUST contain a leading minus and the grouped digits, for example "-$5.000"

### Requirement: formatShortDate — short Spanish date

`formatShortDate` MUST format a Buenos Aires wall-clock timestamp as a short Spanish day and month
label, without any timezone conversion.

#### Scenario: Wall-clock date is not shifted

- GIVEN the timestamp 2026-08-14T21:00
- WHEN formatShortDate is called
- THEN the day MUST be 14 (not 15) and the month MUST be the Spanish August label

#### Scenario: Single-digit day and January

- GIVEN the timestamp 2026-01-05T08:00
- WHEN formatShortDate is called
- THEN the result MUST show day 5 and the Spanish January label

### Requirement: Transaction input parsing

Pure helpers MUST parse and validate transaction input: gross as a whole peso > 0 (plain digits or
valid `\d{1,3}(\.\d{3})+` thousands grouping, dots stripped; any other `.` or `,` is rejected); cashback as 0 to
100 inclusive with at most 2 decimals converted to integer basis points (empty means 0); income
forcing cashback to 0; date as a valid wall-clock timestamp. Failures MUST return per-field
Spanish messages and MUST NOT throw.

#### Scenario: Gross parsing

- GIVEN inputs "33333", "100.5", "0", "abc"
- WHEN gross is parsed
- THEN "33333" MUST be accepted as 33333 and the others MUST each yield a gross error

#### Scenario: Thousands grouping accepted, decimals rejected

- GIVEN inputs "1.500", "12.000.000", "1.5", "1.50", "1,5", "1.5000", ".500", "1..500"
- WHEN gross (or a budget amount) is parsed
- THEN "1.500" and "12.000.000" MUST be accepted as 1500 and 12000000 and the rest MUST each be rejected

#### Scenario: Peso input display helpers

- GIVEN `formatPesoInput("12000000")`
- THEN it MUST return "12.000.000"
- AND `normalizePesoInput` MUST re-group digit-and-dot text, and MUST return text containing a comma
  or any other non-digit unchanged (never silently dropping it)

#### Scenario: Cashback to basis points

- GIVEN inputs "7", "7.25", "100", "100.01", "7.255", "-1", ""
- WHEN cashback is parsed for an expense
- THEN results MUST be 700, 725, 10000, error, error, error, and 0 respectively

#### Scenario: Income forces zero cashback

- GIVEN type income and cashback input "10"
- WHEN input is parsed
- THEN the cashback basis points MUST be 0

#### Scenario: Floating-point safety

- GIVEN cashback input "0.29" or "1.15"
- WHEN converted to basis points
- THEN the result MUST be exactly 29 and 115 (no float drift)

### Requirement: Budget amount validation

A pure helper MUST validate a budget amount as a whole peso strictly greater than 0, returning a
Spanish message otherwise.

#### Scenario: Valid and invalid amounts

- GIVEN inputs "1", "50000", "0", "-3", "1.5", ""
- WHEN validated
- THEN "1" and "50000" MUST be accepted and the others MUST each yield an error

### Requirement: Fill-only-missing budget copy planning

A pure helper MUST plan a budget copy: given source-month rows, target-month rows, and the set of
active expense category ids, it MUST return the rows to insert, being exactly those source rows
whose category has no target row and is an active expense category. It MUST NOT include existing
target categories, MUST NOT alter any amount, and MUST be idempotent when re-applied.

#### Scenario: Only absent categories planned

- GIVEN source {A:100, B:200, C:300} and target {B:999}, all active expense
- WHEN the copy is planned
- THEN the plan MUST be {A:100, C:300} and B MUST NOT appear

#### Scenario: Archived or non-expense categories skipped

- GIVEN a source row whose category is archived or income-kind
- WHEN the copy is planned
- THEN that row MUST NOT be in the plan

#### Scenario: Empty source

- GIVEN an empty source
- WHEN the copy is planned
- THEN the plan MUST be empty

### Requirement: Date filter clamping to the selected month

A pure helper MUST clamp date-from and date-to values to the selected month's first and last day,
and MUST return no constraint for an unset value. Its output MUST feed `filterTransactions`, whose
own behavior is unchanged.

#### Scenario: Clamp low and high

- GIVEN month 2026-08, dateFrom=2026-07-20 and dateTo=2026-09-15
- WHEN clamped
- THEN the result MUST be dateFrom=2026-08-01 and dateTo=2026-08-31

#### Scenario: In-range values unchanged

- GIVEN month 2026-08, dateFrom=2026-08-05 and dateTo=2026-08-10
- WHEN clamped
- THEN the values MUST be unchanged

#### Scenario: Unset values stay unset

- GIVEN no date filters
- WHEN clamped
- THEN both MUST remain unset

### Requirement: Month stepping helper

A pure helper MUST compute the next month key, symmetrical to `prevMonthKey`, rolling December to
the next January, with no fixed range.

#### Scenario: Rolls over the year

- GIVEN the key '2026-12'
- WHEN the next month is computed
- THEN the result MUST be '2027-01'

#### Scenario: Within the same year

- GIVEN the key '2026-08'
- WHEN the next month is computed
- THEN the result MUST be '2026-09'
### Requirement: mergeCardOrder — persist the visible order without losing other positions

`mergeCardOrder(visibleOrder, storedOrder)` MUST be pure and MUST return a list with the visible
ids first in their given order, followed by the stored ids that are not in the visible list, in
their stored relative order, with duplicates removed (first occurrence wins). It MUST NOT drop any
stored id.

#### Scenario: Visible subset first, remainder appended

- GIVEN visible order `[c, a]` and stored order `[a, b, c, d]`
- WHEN `mergeCardOrder` runs
- THEN the result MUST be `[c, a, b, d]`

#### Scenario: Non-visible ids keep their relative order

- GIVEN visible order `[b]` and stored order `[x, y, b, z]`
- WHEN `mergeCardOrder` runs
- THEN the result MUST be `[b, x, y, z]`

#### Scenario: Duplicates removed

- GIVEN visible order `[a, a, b]` and stored order `[b, c, a]`
- WHEN `mergeCardOrder` runs
- THEN the result MUST be `[a, b, c]`

#### Scenario: Empty inputs

- GIVEN an empty visible order and a stored order `[a, b]`
- WHEN `mergeCardOrder` runs
- THEN the result MUST be `[a, b]`
- AND with both inputs empty the result MUST be empty

### Requirement: Name validation

A pure name validator MUST trim leading and trailing whitespace, MUST reject an empty trimmed
name, and MUST reject a trimmed name longer than the maximum length defined by the domain. A valid
result MUST carry the trimmed name. Rejections MUST map to Spanish messages defined in the
domain messages module.

#### Scenario: Whitespace trimmed

- GIVEN the input "  Comida  "
- WHEN validated
- THEN the result MUST be valid with the name "Comida"

#### Scenario: Empty or blank rejected

- GIVEN the input "" or "   "
- WHEN validated
- THEN the result MUST be invalid with a Spanish message

#### Scenario: Overlong rejected

- GIVEN a trimmed input longer than the maximum length
- WHEN validated
- THEN the result MUST be invalid with a Spanish message

#### Scenario: Name at the maximum length accepted

- GIVEN a trimmed input exactly at the maximum length
- WHEN validated
- THEN the result MUST be valid

### Requirement: monthBalance — current-month net income minus net expense

`monthBalance(transactions, monthKey)` MUST be pure and MUST return the sum of net amounts of
income transactions minus the sum of net amounts of expense transactions whose date falls in the
half-open range of the given month. Transactions outside the range MUST be ignored. It MUST NOT
alter `totalBalance`.

#### Scenario: Income minus expense within the month

- GIVEN in-month income net amounts 100000 and 50000, and an in-month expense net amount 30000
- WHEN `monthBalance` runs
- THEN the result MUST be 120000

#### Scenario: Net amounts used for expenses

- GIVEN an in-month expense with gross 10000 and cashback 1000 (net 9000)
- WHEN `monthBalance` runs
- THEN the expense MUST contribute 9000

#### Scenario: Boundaries are half-open

- GIVEN a transaction at the first instant of the month and one at the first instant of the next
  month
- WHEN `monthBalance` runs
- THEN only the first MUST be counted

#### Scenario: Empty month is zero

- GIVEN no transactions in the month
- WHEN `monthBalance` runs
- THEN the result MUST be 0

#### Scenario: Negative balance

- GIVEN in-month expenses exceeding in-month income
- WHEN `monthBalance` runs
- THEN the result MUST be negative
