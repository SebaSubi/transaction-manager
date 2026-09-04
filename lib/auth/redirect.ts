/**
 * Post-login redirect target sanitization.
 *
 * Without this, the login screen becomes an open redirect: an attacker mails
 * `/login?next=https://evil.com`, the victim authenticates, and the app hands
 * them to the attacker's host carrying the trust of our origin.
 *
 * A candidate is accepted ONLY when it is a same-origin absolute path:
 * one leading `/`, not `//` (protocol-relative), not `/\` (browsers normalise
 * backslashes to `/`, so `/\evil.com` is protocol-relative too), and carrying
 * no scheme. Anything else falls back to the home route.
 */

export const DEFAULT_AUTHENTICATED_PATH = "/inicio";
export const LOGIN_PATH = "/login";

/**
 * C0 controls and space. Browsers strip these before parsing a URL, so
 * `/<TAB>/evil.com` would otherwise slip past the protocol-relative check.
 */
const CONTROL_OR_SPACE = /[\u0000-\u0020]/;

export function sanitizeNextPath(candidate: string | null | undefined): string {
  if (typeof candidate !== "string" || candidate === "") {
    return DEFAULT_AUTHENTICATED_PATH;
  }

  if (CONTROL_OR_SPACE.test(candidate)) return DEFAULT_AUTHENTICATED_PATH;

  if (!candidate.startsWith("/")) return DEFAULT_AUTHENTICATED_PATH;
  if (candidate.startsWith("//")) return DEFAULT_AUTHENTICATED_PATH;
  if (candidate.startsWith("/\\")) return DEFAULT_AUTHENTICATED_PATH;

  // A scheme before the first `/`, `?` or `#` — e.g. `/javascript:alert(1)`.
  if (/^\/[^/?#]*:/.test(candidate)) return DEFAULT_AUTHENTICATED_PATH;

  // Never bounce back to the login screen: that is a redirect loop.
  if (candidate === LOGIN_PATH || candidate.startsWith(`${LOGIN_PATH}?`)) {
    return DEFAULT_AUTHENTICATED_PATH;
  }

  return candidate;
}
