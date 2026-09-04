import { describe, expect, it } from "vitest";

import {
  ACCENT_CYCLE_LENGTH,
  categoryColor,
  nextColorIndex,
  orderCategories,
} from "@/lib/domain/categories";

const A = { id: 1, name: "A" };
const B = { id: 2, name: "B" };
const C = { id: 3, name: "C" };
const D = { id: 4, name: "D" };

describe("orderCategories", () => {
  it("respects the stored order", () => {
    expect(orderCategories([A, B, C], [2, 1, 3])).toEqual([B, A, C]);
  });

  it("appends a category missing from the stored order, last and in input order", () => {
    expect(orderCategories([A, B, D], [1, 2])).toEqual([A, B, D]);
  });

  it("skips stored ids whose category is archived or unknown", () => {
    expect(orderCategories([A, C], [99, 3, 1])).toEqual([C, A]);
  });

  it("returns input order when the stored order is empty", () => {
    expect(orderCategories([A, B, C], [])).toEqual([A, B, C]);
  });

  it("ignores duplicate ids in the stored order", () => {
    expect(orderCategories([A, B], [2, 2, 1])).toEqual([B, A]);
  });

  it("does not mutate the input array", () => {
    const input = [A, B, C];
    orderCategories(input, [3, 2, 1]);
    expect(input).toEqual([A, B, C]);
  });
});

describe("categoryColor", () => {
  it("returns a CSS custom-property reference, never a hex literal", () => {
    const color = categoryColor(3);
    expect(color).toBe("var(--accent-3)");
    expect(color).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it("wraps by modulo at the cycle length", () => {
    expect(ACCENT_CYCLE_LENGTH).toBe(6);
    expect(categoryColor(7)).toBe("var(--accent-1)");
    expect(categoryColor(6)).toBe("var(--accent-0)");
    expect(categoryColor(11)).toBe("var(--accent-5)");
  });

  it("wraps negative indices into the cycle", () => {
    expect(categoryColor(-1)).toBe("var(--accent-5)");
  });
});

describe("nextColorIndex", () => {
  it("assigns the next slot in the cycle", () => {
    expect(nextColorIndex(0)).toBe(0);
    expect(nextColorIndex(5)).toBe(5);
  });

  it("wraps at the cycle length", () => {
    expect(nextColorIndex(6)).toBe(0);
    expect(nextColorIndex(18)).toBe(0);
    expect(nextColorIndex(20)).toBe(2);
  });
});
