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
