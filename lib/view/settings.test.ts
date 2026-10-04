import { describe, expect, it } from "vitest";

import { categoryColor } from "@/lib/domain/categories";
import { toSettingsCategoryView, toSettingsMemberView } from "@/lib/view/settings";

describe("settings views", () => {
  it("maps a category row to a view with a derived colour and no colourIndex", () => {
    const view = toSettingsCategoryView({
      id: 4,
      name: "Comida",
      kind: "expense",
      icon: "cake",
      colorIndex: 7,
    });
    expect(view).toEqual({ id: 4, name: "Comida", icon: "cake", color: categoryColor(7) });
    expect(view).not.toHaveProperty("colorIndex");
  });

  it("maps a member row to id and name only", () => {
    expect(toSettingsMemberView({ id: 2, name: "Ana" })).toEqual({ id: 2, name: "Ana" });
  });
});
