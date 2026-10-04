# Delta for app-shell-navigation

## MODIFIED Requirements

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
