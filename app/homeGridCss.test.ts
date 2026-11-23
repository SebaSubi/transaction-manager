import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

function rule(selector: string): string {
  const pattern = new RegExp(`^${selector.replace(".", "\\.")} \\{([^}]*)\\}`, "gm");
  return [...css.matchAll(pattern)].map((match) => match[1]).join("\n");
}

describe("home budget grid CSS", () => {
  it("uses shrinkable columns so a wide card cannot push the grid past the viewport", () => {
    expect(rule(".home-grid")).toContain("repeat(2, minmax(0, 1fr))");
  });

  it("lets cards and long text shrink instead of overflowing", () => {
    expect(rule(".home-card")).toContain("min-width: 0");
    expect(rule(".home-card__name")).toContain("text-overflow: ellipsis");
    expect(rule(".home-card__spent")).toContain("overflow-wrap: anywhere");
  });
});
