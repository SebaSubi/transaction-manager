# Delta for theming

## ADDED Requirements

### Requirement: Theme switch UI

The "Perfil" screen MUST provide a theme switch with exactly three options labelled "Oscuro",
"Claro", and "Sistema", built on the existing segmented control, reflecting the stored theme preference (not the resolved
theme) and invoking the `setTheme` action on change.

#### Scenario: Switch reflects the stored preference

- GIVEN the stored theme preference is 'light'
- WHEN "Perfil" renders
- THEN the "Claro" option MUST be shown as selected

#### Scenario: System preference shows "Sistema"

- GIVEN the stored theme preference is 'system' and the OS is in dark mode
- WHEN "Perfil" renders
- THEN the "Sistema" option MUST be shown as selected, not "Oscuro"

#### Scenario: Selecting an option changes the theme

- GIVEN "Perfil" is shown with a valid session
- WHEN the member selects "Oscuro"
- THEN `setTheme` MUST be invoked with 'dark'
- AND the dark theme MUST apply and persist across reloads with no flash of the wrong theme

#### Scenario: Only three options

- GIVEN the theme switch is rendered
- WHEN its options are inspected
- THEN exactly "Oscuro", "Claro", and "Sistema" MUST be present

### Requirement: setTheme requires a session

The `setTheme` action MUST call `assertSession` before any other effect. A request without a valid
session MUST be rejected and MUST NOT set the theme cookie.

#### Scenario: Request without a session is rejected

- GIVEN a request with no valid session cookie
- WHEN `setTheme` is invoked with 'dark'
- THEN the action MUST reject the request
- AND the theme cookie MUST NOT be set or changed

#### Scenario: Request with a session sets the cookie

- GIVEN a request with a valid session cookie
- WHEN `setTheme` is invoked with 'light'
- THEN the theme cookie MUST be set to 'light'

#### Scenario: Invalid value still rejected

- GIVEN a request with a valid session cookie
- WHEN `setTheme` is invoked with a value outside {'dark', 'light', 'system'}
- THEN the theme cookie MUST NOT be changed
