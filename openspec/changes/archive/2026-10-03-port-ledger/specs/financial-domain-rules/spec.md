# Delta for Financial Domain Rules

All additions below live in `lib/domain/`, MUST be pure, and MUST import no React, Next.js,
Drizzle, or `lib/db/`. Existing requirements are unchanged.

## ADDED Requirements

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
