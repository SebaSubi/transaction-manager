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
"Perfil", plus a center floating action button (FAB).

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

### Requirement: Placeholder screens only

Each of the four tab routes MUST render an empty placeholder screen in this change; no screen
content, CRUD, filters, or the bottom sheet MUST be implemented.

#### Scenario: Tab route renders without error

- GIVEN a valid session
- WHEN a tab route (`inicio`, `presupuesto`, `movimientos`, `perfil`) is requested
- THEN the route MUST render successfully with placeholder content only

### Requirement: Shared shell layout

All four tab routes MUST share one layout (`app/(shell)/layout.tsx`) that provides the shell
chrome and bottom nav.

#### Scenario: Layout wraps every tab

- GIVEN any of the four tab routes
- WHEN rendered
- THEN the shared shell layout MUST wrap the page content and render the bottom nav
