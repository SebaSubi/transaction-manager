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
