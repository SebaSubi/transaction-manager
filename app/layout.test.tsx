// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_BOOT_SCRIPT } from "@/lib/theme/bootScript";
import { installMatchMedia, type MatchMediaStub } from "@/test/stubs/matchMedia";

const cookieJar = vi.hoisted(() => ({ current: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.current.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

const { default: RootLayout } = await import("@/app/layout");

/**
 * Renders the root layout exactly as the server would and returns the HTML.
 * The point of the cookie design is that this string is already correct, so the
 * assertions below read the FIRST bytes of HTML, not a post-hydration DOM.
 */
async function serverRender(cookies: Record<string, string>): Promise<string> {
  cookieJar.current = new Map(Object.entries(cookies));
  const element = await RootLayout({ children: <p>contenido</p> });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  cookieJar.current = new Map();
});

describe("root layout: server-resolved initial theme", () => {
  it("renders the dark palette immediately when the cookie says 'dark'", async () => {
    const html = await serverRender({ tm_theme: "dark" });

    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('data-theme-pref="dark"');
  });

  it("renders the light palette immediately when the cookie says 'light'", async () => {
    const html = await serverRender({ tm_theme: "light" });

    expect(html).toContain('data-theme="light"');
    expect(html).toContain('data-theme-pref="light"');
  });

  it("defaults to the 'system' preference when no cookie is present", async () => {
    const html = await serverRender({});

    expect(html).toContain('data-theme-pref="system"');
    // No OS answer yet: the documented default guess is dark.
    expect(html).toContain('data-theme="dark"');
  });

  it.each(["blue", "", "DARK", "light "])(
    "falls back to 'system' for the invalid cookie value %o",
    async (value) => {
      const html = await serverRender({ tm_theme: value });
      expect(html).toContain('data-theme-pref="system"');
    },
  );

  it.each([
    ["1", "dark"],
    ["0", "light"],
  ])(
    "resolves 'system' against the OS answer tm_system_dark=%s as %s",
    async (systemDark, expected) => {
      const html = await serverRender({
        tm_theme: "system",
        tm_system_dark: systemDark,
      });

      expect(html).toContain(`data-theme="${expected}"`);
      expect(html).toContain('data-theme-pref="system"');
    },
  );

  it("ignores the OS answer when the preference is explicit", async () => {
    const html = await serverRender({ tm_theme: "light", tm_system_dark: "1" });
    expect(html).toContain('data-theme="light"');
  });

  it("ships the blocking boot script in the head so nothing flashes", async () => {
    const html = await serverRender({});

    // Inline and synchronous: no src, no defer, no async. A deferred script
    // would run AFTER first paint, which is the flash this design prevents.
    expect(html).toContain("<script>");
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).not.toMatch(/<script[^>]*\b(src|defer|async)\b/);
    expect(html.indexOf("<script>")).toBeLessThan(html.indexOf("<body>"));
  });
});

describe("theme boot script", () => {
  let matchMedia: MatchMediaStub;

  const runBootScript = () => {
    // Executes the shipped script text verbatim. Rewriting it in the test
    // would prove nothing about what actually reaches the browser.
    new Function(THEME_BOOT_SCRIPT)();
  };

  beforeEach(() => {
    document.cookie = "tm_system_dark=;path=/;max-age=0";
  });

  afterEach(() => {
    matchMedia.restore();
    delete document.documentElement.dataset.themePref;
    delete document.documentElement.dataset.theme;
  });

  it("corrects a wrong server guess before paint", () => {
    matchMedia = installMatchMedia(false);
    document.documentElement.dataset.themePref = "system";
    document.documentElement.dataset.theme = "dark";

    runBootScript();

    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("leaves a correct server guess untouched", () => {
    matchMedia = installMatchMedia(true);
    document.documentElement.dataset.themePref = "system";
    document.documentElement.dataset.theme = "dark";

    runBootScript();

    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("writes the OS answer back so the next server render already agrees", () => {
    matchMedia = installMatchMedia(false);
    document.documentElement.dataset.themePref = "system";
    document.documentElement.dataset.theme = "dark";

    runBootScript();

    expect(document.cookie).toContain("tm_system_dark=0");
  });

  it.each(["dark", "light"])(
    "does nothing when the preference is an explicit '%s'",
    (preference) => {
      matchMedia = installMatchMedia(preference === "light");
      document.documentElement.dataset.themePref = preference;
      document.documentElement.dataset.theme = preference;

      runBootScript();

      expect(document.documentElement.dataset.theme).toBe(preference);
      expect(document.cookie).not.toContain("tm_system_dark=");
    },
  );

  it("never throws, even where matchMedia does not exist", () => {
    matchMedia = installMatchMedia(true);
    matchMedia.restore();
    document.documentElement.dataset.themePref = "system";
    document.documentElement.dataset.theme = "dark";

    // A boot script that throws would abort before paint and strand the guess.
    expect(() => runBootScript()).not.toThrow();
    matchMedia = installMatchMedia(true);
  });
});
