import { describe, expect, it } from "vitest";

import { checkCardOrderIds, mergeCardOrder, sameOrder } from "@/lib/domain/cardOrder";

const [a, b, c, d] = [1, 2, 3, 4];

describe("mergeCardOrder", () => {
  it("puts visible ids first, then the remaining stored ids", () => {
    expect(mergeCardOrder([c, a], [a, b, c, d])).toEqual([c, a, b, d]);
  });

  it("keeps stored ids that are not visible (archived positions)", () => {
    expect(mergeCardOrder([20], [10, 11, 20, 30])).toEqual([20, 10, 11, 30]);
    expect(mergeCardOrder([b], [100, 101, b, 102])).toEqual([b, 100, 101, 102]);
  });

  it("deduplicates both inputs, first occurrence wins", () => {
    expect(mergeCardOrder([a, a, b], [b, c, c, a, d, d])).toEqual([a, b, c, d]);
  });

  it("handles empty inputs", () => {
    expect(mergeCardOrder([], [])).toEqual([]);
    expect(mergeCardOrder([a, b], [])).toEqual([a, b]);
    expect(mergeCardOrder([], [b, a])).toEqual([b, a]);
  });

  it("does not mutate its inputs", () => {
    const visible = [c, a];
    const stored = [a, b, c, d];
    mergeCardOrder(visible, stored);
    expect(visible).toEqual([c, a]);
    expect(stored).toEqual([a, b, c, d]);
  });

  it("returns a permutation of the unique union", () => {
    const visible = [5, 3, 5, 9, 1];
    const stored = [9, 7, 3, 7, 2, 8];
    const merged = mergeCardOrder(visible, stored);
    const union = [...new Set([...visible, ...stored])];
    expect([...merged].sort((x, y) => x - y)).toEqual([...union].sort((x, y) => x - y));
    expect(new Set(merged).size).toBe(merged.length);
  });
});

describe("checkCardOrderIds", () => {
  const allowed = new Set([a, b, c]);

  it("accepts ids that are all allowed", () => {
    expect(checkCardOrderIds([c, a], allowed)).toBe(true);
    expect(checkCardOrderIds([], allowed)).toBe(true);
  });

  it("rejects any id that is not allowed", () => {
    expect(checkCardOrderIds([a, d], allowed)).toBe(false);
  });
});

describe("sameOrder", () => {
  it("compares element by element", () => {
    expect(sameOrder([a, b], [a, b])).toBe(true);
    expect(sameOrder([a, b], [b, a])).toBe(false);
    expect(sameOrder([a], [a, b])).toBe(false);
    expect(sameOrder([], [])).toBe(true);
  });
});
