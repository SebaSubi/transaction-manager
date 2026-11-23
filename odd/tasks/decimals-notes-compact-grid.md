# decimals-notes-compact-grid

Branch: `feat/decimals-notes-compact-grid`

## Objective

Three user-requested updates:

1. Allow cents (decimals) in amounts.
2. Optional "Nota" (detail) on a transaction.
3. Home "Presupuesto del mes" grid shows both columns on a phone.

## Tasks

- [ ] T1 - Cents: store integer cents (bigint) everywhere, migration x100 with rollback, es-AR parsing/formatting, decimal keyboard.
- [ ] T2 - Optional note: nullable `description` (max 80, trimmed, empty -> null), migration + rollback, repository, EntrySheet input, shown in LedgerRow/RecentMovements.
- [ ] T3 - Home budget grid fits two columns at 360-430px (find root cause, keep drag-and-drop).

## Acceptance criteria

- T1: "1.500,50", "1500,5" and "1500.5" save as 150050 / 150050 / 150050 cents; "1.500" is 1500 pesos; more than 2 decimals is rejected; display is `$19.898` or `$19.898,50`; migration multiplies by 100, rollback divides by 100 with rounding.
- T2: note is optional, trimmed, max 80 chars, empty becomes null; additive migration; visible in ledger and recent movements.
- T3: no horizontal overflow of the grid at 360-430px; long names ellipsize.

## Route / TDD

Single delegated writer, direct route. TDD: not configured; functional checks only (vitest).

## Checks

`pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` (baseline on main: all green, 1011 tests).

## Progress

(commit hashes recorded as tasks finish)
