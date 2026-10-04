// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CategoryIcon } from "@/components/ui/CategoryIcon";

afterEach(cleanup);

function iconClass(name: string): string {
  const { container } = render(<CategoryIcon name={name} />);
  return container.querySelector("svg")?.getAttribute("class") ?? "";
}

describe("CategoryIcon", () => {
  it("renders the mapped icon for a seeded name", () => {
    expect(iconClass("shopping-cart")).toContain("lucide-shopping-cart");
  });

  it("falls back to the Tag icon for an unknown name", () => {
    expect(iconClass("not-an-icon")).toContain("lucide-tag");
  });

  it("does not resolve inherited object keys as icons", () => {
    expect(iconClass("constructor")).toContain("lucide-tag");
  });
});
