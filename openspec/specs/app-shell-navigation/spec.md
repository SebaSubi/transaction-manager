# App Shell Navigation Specification

## Purpose

Defines the mobile shell, bottom navigation, and route layout for the four app tabs.

## Requirements

### Requirement: 430px mobile shell

The app shell MUST render at a fixed maximum width of 430px.

#### Scenario: Shell width constraint

- GIVEN any app route inside the shell layout
- WHEN rendered
- THEN the shell container MUST have `max-width: 430px`

### Requirement: Bottom navigation with four tabs and center FAB

The bottom nav MUST present exactly four tabs labeled "Inicio", "Presupuesto", "Movimientos",
"Perfil", plus a center floating action button (FAB). The FAB MUST open the add transaction sheet
in create mode from any tab.
(Previously: the FAB was present but had no behavior.)

#### Scenario: All four tabs present in order

- GIVEN the shell layout renders
- WHEN the bottom nav is inspected
- THEN it MUST contain tabs labeled exactly "Inicio", "Presupuesto", "Movimientos", "Perfil", in
  that order
- AND a center FAB MUST be present between the nav items

#### Scenario: Each tab navigates to its route

- GIVEN the bottom nav is rendered
- WHEN a tab is activated
- THEN the app MUST navigate to that tab's corresponding route

#### Scenario: FAB opens the add sheet from any tab

- GIVEN any of the four tab routes is displayed
- WHEN the center FAB is activated
- THEN the add transaction sheet MUST open in create mode without navigating away from the current
  route

#### Scenario: Closing the sheet preserves the current route and URL state

- GIVEN the add sheet was opened from "Movimientos" with month, filter, and sort params set
- WHEN the sheet is dismissed without saving
- THEN the route and its search params MUST be unchanged

### Requirement: Shared shell layout

All four tab routes MUST share one layout (`app/(shell)/layout.tsx`) that provides the shell
chrome, the bottom nav, and the add/edit sheet host so the FAB and list rows open the same sheet.
(Previously: the layout provided only the shell chrome and bottom nav.)

#### Scenario: Layout wraps every tab

- GIVEN any of the four tab routes
- WHEN rendered
- THEN the shared shell layout MUST wrap the page content and render the bottom nav

#### Scenario: One sheet serves both entry points

- GIVEN the FAB and a ledger row both request the sheet
- WHEN each is activated
- THEN the same sheet host MUST open, in create and edit mode respectively

### Requirement: Tab screens

All four tabs MUST render functional screens: "Inicio" the home dashboard, "Movimientos" the
transaction ledger, "Presupuesto" the monthly budgets, and "Perfil" the household settings. No tab
MUST render placeholder content.
(Previously: "Inicio" and "Perfil" remained empty placeholder screens.)

#### Scenario: Inicio renders the dashboard

- GIVEN a valid session
- WHEN `inicio` is requested
- THEN the route MUST render the home dashboard with no placeholder content

#### Scenario: Perfil renders the household settings

- GIVEN a valid session
- WHEN `perfil` is requested
- THEN the route MUST render the household settings screen with no placeholder content

#### Scenario: Previously functional tabs are unchanged

- GIVEN a valid session
- WHEN `movimientos` or `presupuesto` is requested
- THEN the route MUST render the ledger or the budgets screen respectively, with no placeholder
  content

#### Scenario: No placeholder tab remains

- GIVEN a valid session
- WHEN each of the four tab routes is requested
- THEN none MUST render empty placeholder content
