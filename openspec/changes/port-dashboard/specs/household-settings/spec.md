# Household Settings Specification

## Purpose

Defines the "Perfil" screen: managing household members and expense categories, restoring archived
items, and switching the theme, plus the Server Action contracts behind them.

## Requirements

### Requirement: Action contract

Every Server Action for members and categories MUST call `assertSession` first, validate input
(names through the domain name validator), write only through repositories, map unique-index
violations to a Spanish message, make no partial write on failure, and revalidate the affected
routes (at least `/perfil`, plus `/inicio`, `/presupuesto`, and `/movimientos` where their data
changes). Actions MUST return a result carrying a Spanish message on failure.

#### Scenario: No session rejected

- GIVEN a request without a valid session
- WHEN any member or category action is invoked
- THEN it MUST be rejected and nothing MUST be written

#### Scenario: Invalid name rejected before the database

- GIVEN an empty or overlong name
- WHEN an add or rename action is invoked
- THEN it MUST return a Spanish validation message and MUST NOT touch the database

#### Scenario: Unique violation mapped

- GIVEN a unique-index violation raised by the repository
- WHEN the action catches it
- THEN it MUST return a Spanish duplicate-name message and change nothing

### Requirement: Members management

"Perfil" MUST list active members and MUST let a member add a new member by name (validated and
trimmed). Active member names MUST be unique. Archiving a member MUST be allowed even when the
member has transactions, MUST require confirmation, and MUST be blocked for the last active member
with a Spanish message. Historical transactions MUST keep showing the archived member's name.

#### Scenario: Add a member

- GIVEN a valid unused name
- WHEN the member adds it
- THEN it MUST appear in the active list

#### Scenario: Duplicate active member name

- GIVEN an active member "Ana"
- WHEN another member named "Ana" is added
- THEN the action MUST fail with a Spanish duplicate-name message and no member MUST be added

#### Scenario: Archive a member with transactions

- GIVEN an active member with transactions and another active member
- WHEN archive is confirmed
- THEN the member MUST leave the active list and move to "Archivadas"
- AND their transactions MUST keep displaying the member's name

#### Scenario: Last active member blocked

- GIVEN exactly one active member
- WHEN archiving that member is attempted
- THEN the action MUST fail with a Spanish message and the member MUST remain active

### Requirement: Expense category management

"Perfil" MUST manage expense categories only; income categories MUST NOT be listed or editable.
It MUST list active expense categories and MUST let a member add one with a validated name, an icon
picked from the 21 icons mapped in the category icon component, and a color chosen automatically
from `nextColorIndex`. A member MUST be able to rename a category (name only; icon and color MUST
NOT change). Archiving a category MUST be allowed even when it has a budget this month and MUST
require confirmation. Active expense category names MUST be unique.

#### Scenario: Add with picked icon and automatic color

- GIVEN a valid unused name and a selected icon
- WHEN the member adds the category
- THEN it MUST be created as an expense category with that icon and the color derived from
  `nextColorIndex`

#### Scenario: Icon picker offers exactly the mapped icons

- GIVEN the add form is open
- WHEN the icon picker is inspected
- THEN it MUST offer exactly the 21 icons mapped by the category icon component

#### Scenario: Icon required

- GIVEN the add form without a selected icon
- WHEN submitted
- THEN the action MUST fail with a Spanish message and nothing MUST be created

#### Scenario: Rename changes only the name

- GIVEN an active category
- WHEN the member renames it to a valid unused name
- THEN only the name MUST change, and ledger and budget views MUST show the new name

#### Scenario: Duplicate name on add or rename

- GIVEN an active expense category "Comida"
- WHEN a category is added or renamed to "Comida"
- THEN the action MUST fail with a Spanish duplicate-name message and change nothing

#### Scenario: Archive a category with a budget this month

- GIVEN an expense category budgeted this month
- WHEN archive is confirmed
- THEN the category MUST become archived and no budget or transaction row MUST be deleted

#### Scenario: Income categories not managed

- GIVEN income categories exist
- WHEN "Perfil" renders
- THEN none MUST appear in the category management list

### Requirement: Archivadas section

"Perfil" MUST include an "Archivadas" section listing archived members and archived expense
categories, each with a restore action. Restoring MUST make the item active again. Restoring when
an active row has the same name MUST fail with a Spanish message and keep the row archived. When
nothing is archived the section MUST show a Spanish empty message.

#### Scenario: Archived items listed

- GIVEN one archived member and one archived expense category
- WHEN "Perfil" renders
- THEN both MUST appear in "Archivadas" with a restore action

#### Scenario: Restore a member or category

- GIVEN an archived item with no active name clash
- WHEN the member restores it
- THEN it MUST return to its active list and leave "Archivadas"

#### Scenario: Restore blocked by duplicate active name

- GIVEN an archived category "Comida" and an active category "Comida"
- WHEN restore is attempted
- THEN the action MUST fail with a Spanish duplicate-name message and the category MUST stay
  archived

#### Scenario: Nothing archived

- GIVEN no archived members or categories
- WHEN "Perfil" renders
- THEN "Archivadas" MUST show a Spanish empty message

### Requirement: Archive confirmation

Archiving a member or a category MUST first open the shared confirmation dialog with Spanish copy,
and MUST proceed only on explicit confirmation. Cancelling MUST change nothing. Restore MUST NOT
require confirmation.

#### Scenario: Confirm archives

- GIVEN the archive confirmation dialog is open
- WHEN the member confirms
- THEN the archive action MUST run

#### Scenario: Cancel changes nothing

- GIVEN the archive confirmation dialog is open
- WHEN the member cancels
- THEN no action MUST run and the item MUST stay active

### Requirement: Theme switch on Perfil

"Perfil" MUST include the theme switch defined by the `theming` capability ("Oscuro", "Claro",
"Sistema").

#### Scenario: Theme switch present

- GIVEN "Perfil" renders
- WHEN its sections are inspected
- THEN the theme switch MUST be present with the current theme selected

### Requirement: Spanish copy

All user-facing copy and messages MUST be Spanish without voseo, defined in the domain messages
module where they are action results; code, identifiers, and comments MUST be English.

#### Scenario: Messages in Spanish

- GIVEN any failure returned by a member or category action
- WHEN the message is inspected
- THEN it MUST be Spanish and use no voseo forms
