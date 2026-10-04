// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CATEGORY_ICON_KEYS } from "@/lib/domain/categoryIcons";

afterEach(cleanup);

function iconClass(name: string): string {
  const { container } = render(<CategoryIcon name={name} />);
  return container.querySelector("svg")?.getAttribute("class") ?? "";
}

describe("CategoryIcon", () => {
  it("renders the mapped icon for a seeded name", () => {
    expect(iconClass("shopping-cart")).toContain("lucide-shopping-cart");
  });

  it.each(CATEGORY_ICON_KEYS)("renders a mapped icon (not the fallback) for %s", (key) => {
    const cls = iconClass(key);
    expect(cls).toContain(`lucide-`);
    expect(cls).not.toContain("lucide-tag");
  });

  it("falls back to the Tag icon for an unknown name", () => {
    expect(iconClass("not-an-icon")).toContain("lucide-tag");
  });

  it("does not resolve inherited object keys as icons", () => {
    expect(iconClass("constructor")).toContain("lucide-tag");
  });
});
