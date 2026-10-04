import { describe, expect, it } from "vitest";

import { CATEGORY_ICON_KEYS, isCategoryIconKey } from "@/lib/domain/categoryIcons";

describe("category icons", () => {
  it("has exactly 21 unique keys", () => {
    expect(CATEGORY_ICON_KEYS).toHaveLength(21);
    expect(new Set(CATEGORY_ICON_KEYS).size).toBe(21);
  });

  it.each([...CATEGORY_ICON_KEYS])("accepts %s", (key) => {
    expect(isCategoryIconKey(key)).toBe(true);
  });

  it.each([["../x"], ["tag"], ["Home"], [""], [null], [undefined], [3], [{}], [["house"]]])(
    "rejects %j",
    (value) => {
      expect(isCategoryIconKey(value)).toBe(false);
    },
  );
});
