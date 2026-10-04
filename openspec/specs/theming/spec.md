# Theming Specification

## Purpose

Defines dark/light/system theme resolution with no flash of the wrong theme on load.

## Requirements

### Requirement: Server-resolved initial theme

The initial theme MUST be resolved from a cookie during Server Component render, before client
paint, so no flash of the wrong theme occurs.

#### Scenario: Cookie present resolves immediately

- GIVEN a theme cookie set to 'dark'
- WHEN a Server Component renders the initial page
- THEN the initial HTML MUST already reflect the dark theme, with no client-side theme switch
  visible after hydration

#### Scenario: No cookie present defaults safely

- GIVEN no theme cookie is present
- WHEN a Server Component renders the initial page
- THEN the system MUST apply the defined default ('system') without a visible flash of an
  incorrect theme

### Requirement: System mode follows OS preference

When the resolved theme mode is 'system', the app MUST follow the OS-level
`prefers-color-scheme` setting.

#### Scenario: OS preference determines the rendered theme

- GIVEN the theme mode is 'system' and the OS reports `prefers-color-scheme: dark`
- WHEN the app renders
- THEN the dark palette MUST be applied

#### Scenario: OS preference change is followed live

- GIVEN the theme mode is 'system' and the app is already rendered
- WHEN the OS-level color scheme preference changes
- THEN the app MUST update to match without a page reload

### Requirement: Three theme values only

The theme MUST be one of exactly 'dark', 'light', or 'system'; no other value MUST be accepted.

#### Scenario: Invalid theme value rejected

- GIVEN a theme cookie value outside {'dark', 'light', 'system'}
- WHEN read
- THEN the system MUST fall back to the default ('system') rather than applying the invalid value
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
