import { SYSTEM_DARK_COOKIE, THEME_MAX_AGE_SECONDS } from "@/lib/theme/cookies";

/**
 * The blocking boot script injected into `<head>` by `app/layout.tsx`.
 *
 * Runs BEFORE first paint, so `'system'` never flashes the wrong palette.
 *
 * The server can guess the OS preference (it defaults to dark) but cannot know
 * it. This script asks `matchMedia`, corrects `data-theme` if the guess was
 * wrong, and writes `tm_system_dark` so every subsequent server render is
 * already correct with no script correction at all (design §7).
 *
 * It lives here rather than inside `app/layout.tsx` so a test can execute it
 * against a jsdom document. A layout module may not export arbitrary values,
 * and an inline template literal cannot be exercised at all — an untested boot
 * script would leave the no-flash guarantee resting on manual observation.
 */
export const THEME_BOOT_SCRIPT = `
(function () {
  try {
    var root = document.documentElement;
    if (root.dataset.themePref !== 'system') return;
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var resolved = prefersDark ? 'dark' : 'light';
    if (root.dataset.theme !== resolved) root.dataset.theme = resolved;
    document.cookie = '${SYSTEM_DARK_COOKIE}=' + (prefersDark ? '1' : '0') + ';path=/;max-age=${THEME_MAX_AGE_SECONDS};samesite=lax';
  } catch (e) {}
})();
`.trim();
