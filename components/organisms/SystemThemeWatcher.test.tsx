// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installMatchMedia, type MatchMediaStub } from "@/test/stubs/matchMedia";

const { SystemThemeWatcher } = await import(
  "@/components/organisms/SystemThemeWatcher"
);

let matchMedia: MatchMediaStub;

beforeEach(() => {
  matchMedia = installMatchMedia(true);
  document.documentElement.dataset.themePref = "system";
  document.documentElement.dataset.theme = "dark";
  // jsdom keeps cookies for the whole file; clear the one under test.
  document.cookie = "tm_system_dark=;path=/;max-age=0";
});

afterEach(() => {
  cleanup();
  matchMedia.restore();
  delete document.documentElement.dataset.themePref;
  delete document.documentElement.dataset.theme;
});

describe("SystemThemeWatcher", () => {
  it("follows a live OS preference change with no page reload", () => {
    render(<SystemThemeWatcher />);
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => matchMedia.setPrefersDark(false));
    expect(document.documentElement.dataset.theme).toBe("light");

    act(() => matchMedia.setPrefersDark(true));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("records the new OS answer in the cookie the server reads", () => {
    render(<SystemThemeWatcher />);

    act(() => matchMedia.setPrefersDark(false));
    expect(document.cookie).toContain("tm_system_dark=0");

    act(() => matchMedia.setPrefersDark(true));
    expect(document.cookie).toContain("tm_system_dark=1");
  });

  it.each(["dark", "light"])(
    "ignores the OS when the preference is an explicit '%s'",
    (preference) => {
      document.documentElement.dataset.themePref = preference;
      document.documentElement.dataset.theme = preference;

      render(<SystemThemeWatcher />);
      act(() => matchMedia.setPrefersDark(preference === "light"));

      expect(document.documentElement.dataset.theme).toBe(preference);
    },
  );

  it("renders nothing into the document", () => {
    const { container } = render(<SystemThemeWatcher />);
    expect(container.innerHTML).toBe("");
  });

  it("unsubscribes from the media query on unmount", () => {
    const { unmount } = render(<SystemThemeWatcher />);
    expect(matchMedia.listenerCount()).toBe(1);

    unmount();
    expect(matchMedia.listenerCount()).toBe(0);
  });
});
