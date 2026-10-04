# Delta for financial-domain-rules

`totalBalance` and `greeting` are NOT modified; `greeting` is kept in place and unused.

## ADDED Requirements

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
