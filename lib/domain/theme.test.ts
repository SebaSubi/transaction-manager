import { describe, expect, it } from "vitest";

import { isThemePreference, resolveTheme } from "@/lib/domain/theme";

describe("isThemePreference", () => {
  it.each(["dark", "light", "system"])("accepts %s", (value) => {
    expect(isThemePreference(value)).toBe(true);
  });

  it.each([["blue"], [""], ["SYSTEM"], [null], [undefined], [1], [{}]])(
    "rejects %s",
    (value) => {
      expect(isThemePreference(value)).toBe(false);
    },
  );
});

describe("resolveTheme", () => {
  it("follows the OS preference when set to system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("ignores the OS preference for an explicit choice", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });
});
