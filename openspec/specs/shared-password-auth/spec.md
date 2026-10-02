# Shared Password Auth Specification

## Purpose

Defines the single shared-password middleware gate protecting every app route.

## Requirements

### Requirement: Route gating

Every app route MUST be gated by the middleware; no route MUST be reachable without a valid
session.

#### Scenario: Unauthenticated request redirects to the password screen

- GIVEN a request to any app route with no valid session cookie
- WHEN the middleware runs
- THEN the response MUST redirect to the password screen

#### Scenario: Valid session grants access

- GIVEN a request with a valid session cookie
- WHEN the middleware runs
- THEN the request MUST proceed to the requested route

### Requirement: Constant-time password comparison

The password check MUST use a constant-time comparison, never a short-circuiting string equality
check.

#### Scenario: Correct password grants access

- GIVEN the submitted password matches the configured shared password
- WHEN compared
- THEN a session MUST be created and the user granted access

#### Scenario: Incorrect password denied uniformly regardless of prefix match

- GIVEN the submitted password does not match, regardless of how many leading characters coincide
- WHEN compared
- THEN access MUST be denied, and the comparison MUST take equal time regardless of match length

### Requirement: Session cookie attributes

The session cookie MUST be `httpOnly`, `secure`, and carry a `sameSite` attribute.

#### Scenario: Cookie set on successful login

- GIVEN a correct password submission
- WHEN the session cookie is set
- THEN it MUST have `httpOnly=true`, `secure=true`, and a `sameSite` attribute set

#### Scenario: Cookie not readable by client JavaScript

- GIVEN a valid session cookie
- WHEN client-side JavaScript reads `document.cookie`
- THEN the session cookie value MUST NOT be present, per `httpOnly` enforcement

### Requirement: Password source

The shared password MUST be sourced from an environment variable, never hardcoded or committed
to the repository.

#### Scenario: Missing env var fails closed

- GIVEN the shared-password environment variable is unset
- WHEN the app starts or a login is attempted
- THEN the app MUST fail closed (deny access), never fail open
